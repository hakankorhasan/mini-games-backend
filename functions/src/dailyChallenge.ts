import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
    generateDailyPuzzles,
    getTodayUTC,
    getSecondsUntilNextDay,
    DailyPuzzleEntry,
} from "./utils/dailyPuzzleGenerator";
import {
    StreakData,
    updateStreak,
    calculateDailyBonus,
    isStreakAlive,
} from "./utils/streakCalculator";
import { calculateGlobalScore } from "./utils/globalScore";

// ═══════════════════════════════════════════════════════════════
//  getDailyChallenge
//
//  GET /getDailyChallenge?deviceId=xxx
//
//  Returns today's 5 puzzles + user's progress + streak info.
//  If no puzzles exist for today, generates them (lazy).
// ═══════════════════════════════════════════════════════════════

export const getDailyChallenge = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;
        if (!deviceId) {
            res.status(400).json({ success: false, error: "deviceId query parameter is required." });
            return;
        }

        const todayDate = getTodayUTC();
        const db = admin.firestore();

        // ── 1. Get or create today's puzzles ──
        const dailyRef = db.collection("dailyChallenges").doc(todayDate);
        let dailyDoc = await dailyRef.get();

        let puzzles: DailyPuzzleEntry[];

        if (dailyDoc.exists) {
            puzzles = dailyDoc.data()!.puzzles as DailyPuzzleEntry[];
        } else {
            // Lazy generation: create today's puzzles
            puzzles = generateDailyPuzzles(todayDate);
            await dailyRef.set({
                date: todayDate,
                puzzles,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            functions.logger.info(`Daily challenge generated for ${todayDate}`);
        }

        // ── 2. Get user's daily progress ──
        const progressRef = db.collection("dailyProgress").doc(deviceId);
        const progressDoc = await progressRef.get();

        let progress = {
            completedPuzzles: [] as number[],
            puzzleResults: {} as Record<string, unknown>,
            totalScore: 0,
            allCompleted: false,
        };

        if (progressDoc.exists) {
            const data = progressDoc.data()!;
            // Check if progress is for today
            if (data.currentDate === todayDate) {
                progress = {
                    completedPuzzles: data.completedPuzzles || [],
                    puzzleResults: data.puzzleResults || {},
                    totalScore: data.totalScore || 0,
                    allCompleted: data.allCompleted || false,
                };
            }
            // If progress is from a previous day, return fresh progress
        }

        // ── 3. Get streak info ──
        const streakRef = db.collection("dailyStreaks").doc(deviceId);
        const streakDoc = await streakRef.get();

        let streak = {
            currentStreak: 0,
            bestStreak: 0,
            lastCompletedDate: null as string | null,
            totalDaysCompleted: 0,
            totalPuzzlesSolved: 0,
        };

        if (streakDoc.exists) {
            const data = streakDoc.data()!;
            streak = {
                currentStreak: data.currentStreak || 0,
                bestStreak: data.bestStreak || 0,
                lastCompletedDate: data.lastCompletedDate || null,
                totalDaysCompleted: data.totalDaysCompleted || 0,
                totalPuzzlesSolved: data.totalPuzzlesSolved || 0,
            };

            // If streak is broken (last completion > 1 day ago), show 0
            if (!isStreakAlive(streak.lastCompletedDate, todayDate)) {
                streak.currentStreak = 0;
            }
        }

        res.status(200).json({
            success: true,
            date: todayDate,
            puzzles,
            progress,
            streak: {
                currentStreak: streak.currentStreak,
                bestStreak: streak.bestStreak,
                totalDaysCompleted: streak.totalDaysCompleted,
                totalPuzzlesSolved: streak.totalPuzzlesSolved,
            },
            nextResetIn: getSecondsUntilNextDay(),
        });
    } catch (error) {
        functions.logger.error("getDailyChallenge failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ═══════════════════════════════════════════════════════════════
//  submitDailyPuzzle
//
//  POST /submitDailyPuzzle
//  Body: { deviceId, puzzleIndex, correct, responseTime, gameId, difficulty }
//
//  Records a single puzzle result. When 5/5 completed,
//  updates streak and adds bonus to global score.
// ═══════════════════════════════════════════════════════════════

export const submitDailyPuzzle = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { deviceId, puzzleIndex, correct, responseTime, gameId, difficulty } = req.body;

        // ── Validate inputs ──
        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }
        if (typeof puzzleIndex !== "number" || puzzleIndex < 1 || puzzleIndex > 5) {
            res.status(400).json({ success: false, error: "puzzleIndex must be 1-5." });
            return;
        }
        if (typeof correct !== "boolean") {
            res.status(400).json({ success: false, error: "correct must be a boolean." });
            return;
        }
        if (typeof responseTime !== "number" || responseTime < 0) {
            res.status(400).json({ success: false, error: "responseTime must be a non-negative number." });
            return;
        }
        if (!gameId || typeof gameId !== "string") {
            res.status(400).json({ success: false, error: "gameId is required." });
            return;
        }
        if (typeof difficulty !== "number" || difficulty < 1) {
            res.status(400).json({ success: false, error: "difficulty must be a positive number." });
            return;
        }

        const todayDate = getTodayUTC();
        const db = admin.firestore();

        // ── Verify today's challenge exists ──
        const dailyRef = db.collection("dailyChallenges").doc(todayDate);
        const dailyDoc = await dailyRef.get();

        if (!dailyDoc.exists) {
            res.status(400).json({
                success: false,
                error: "Today's challenge not found. Call getDailyChallenge first.",
            });
            return;
        }

        const dailyPuzzles = dailyDoc.data()!.puzzles as DailyPuzzleEntry[];

        // Verify puzzleIndex matches the expected gameId
        const expectedPuzzle = dailyPuzzles.find((p) => p.puzzleIndex === puzzleIndex);
        if (!expectedPuzzle) {
            res.status(400).json({ success: false, error: `Puzzle index ${puzzleIndex} not found.` });
            return;
        }
        if (expectedPuzzle.gameId !== gameId) {
            res.status(400).json({
                success: false,
                error: `Puzzle ${puzzleIndex} expects gameId "${expectedPuzzle.gameId}", got "${gameId}".`,
            });
            return;
        }

        // ── Get/create user's daily progress ──
        const progressRef = db.collection("dailyProgress").doc(deviceId);

        const result = await db.runTransaction(async (transaction) => {
            const progressDoc = await transaction.get(progressRef);

            let completedPuzzles: number[] = [];
            let puzzleResults: Record<string, {
                score: number;
                responseTime: number;
                correct: boolean;
                gameId: string;
                difficulty: number;
                completedAt: string;
            }> = {};
            let totalScore = 0;

            if (progressDoc.exists) {
                const data = progressDoc.data()!;
                if (data.currentDate === todayDate) {
                    completedPuzzles = data.completedPuzzles || [];
                    puzzleResults = data.puzzleResults || {};
                    totalScore = data.totalScore || 0;
                }
                // If progress is from a different day, start fresh
            }

            // ── Check duplicate submission ──
            if (completedPuzzles.includes(puzzleIndex)) {
                return {
                    duplicate: true,
                    puzzleScore: 0,
                    totalDailyScore: totalScore,
                    completedCount: completedPuzzles.length,
                    allCompleted: completedPuzzles.length >= 5,
                };
            }

            // ── Calculate puzzle score ──
            const { scoreGained } = calculateGlobalScore({
                level: difficulty * 5, // Approximate level for Daily Challenge puzzles
                difficulty,
                correct,
                responseTime,
                currentStreak: 0,  // Daily challenge has its own streak logic
                gameId,
            });

            const puzzleScore = scoreGained;
            totalScore += puzzleScore;
            completedPuzzles.push(puzzleIndex);
            completedPuzzles.sort((a, b) => a - b);

            puzzleResults[String(puzzleIndex)] = {
                score: puzzleScore,
                responseTime,
                correct,
                gameId,
                difficulty,
                completedAt: new Date().toISOString(),
            };

            const allCompleted = completedPuzzles.length >= 5;

            // ── Write progress ──
            transaction.set(progressRef, {
                currentDate: todayDate,
                completedPuzzles,
                puzzleResults,
                totalScore,
                allCompleted,
                completedAt: allCompleted
                    ? admin.firestore.FieldValue.serverTimestamp()
                    : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
                duplicate: false,
                puzzleScore,
                totalDailyScore: totalScore,
                completedCount: completedPuzzles.length,
                allCompleted,
            };
        });

        // ── Duplicate check ──
        if (result.duplicate) {
            res.status(400).json({
                success: false,
                error: `Puzzle ${puzzleIndex} already submitted today.`,
                totalDailyScore: result.totalDailyScore,
                completedCount: result.completedCount,
            });
            return;
        }

        // ── If all 5 completed: update streak + add bonus ──
        let streakInfo = {
            currentStreak: 0,
            bestStreak: 0,
            totalDaysCompleted: 0,
            totalPuzzlesSolved: 0,
        };
        let bonusScore = 0;

        const streakRef = db.collection("dailyStreaks").doc(deviceId);

        if (result.allCompleted) {
            // Update streak
            const streakDoc = await streakRef.get();

            const currentStreakData: StreakData = streakDoc.exists
                ? {
                    currentStreak: streakDoc.data()!.currentStreak || 0,
                    bestStreak: streakDoc.data()!.bestStreak || 0,
                    lastCompletedDate: streakDoc.data()!.lastCompletedDate || null,
                    totalDaysCompleted: streakDoc.data()!.totalDaysCompleted || 0,
                    totalPuzzlesSolved: streakDoc.data()!.totalPuzzlesSolved || 0,
                }
                : {
                    currentStreak: 0,
                    bestStreak: 0,
                    lastCompletedDate: null,
                    totalDaysCompleted: 0,
                    totalPuzzlesSolved: 0,
                };

            const { updatedStreak } = updateStreak(currentStreakData, todayDate);

            // Calculate bonus based on new streak
            bonusScore = calculateDailyBonus(updatedStreak.currentStreak);

            // Update totalPuzzlesSolved
            updatedStreak.totalPuzzlesSolved += 5;

            await streakRef.set({
                ...updatedStreak,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            streakInfo = {
                currentStreak: updatedStreak.currentStreak,
                bestStreak: updatedStreak.bestStreak,
                totalDaysCompleted: updatedStreak.totalDaysCompleted,
                totalPuzzlesSolved: updatedStreak.totalPuzzlesSolved,
            };

            // ── Add bonus + daily total to user's global score ──
            const userRef = db.collection("users").doc(deviceId);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                const totalDailyWithBonus = result.totalDailyScore + bonusScore;
                await userRef.update({
                    weightedGlobalScore: admin.firestore.FieldValue.increment(
                        Math.round(totalDailyWithBonus * 1.5)  // Daily challenge coefficient: 1.5x
                    ),
                    lastActive: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            functions.logger.info(
                `Daily challenge complete: device=${deviceId} streak=${updatedStreak.currentStreak} ` +
                `score=${result.totalDailyScore} bonus=${bonusScore}`
            );
        } else {
            // Fetch current streak for response (without updating)
            const streakDoc = await streakRef.get();
            if (streakDoc.exists) {
                const data = streakDoc.data()!;
                streakInfo = {
                    currentStreak: isStreakAlive(data.lastCompletedDate, todayDate)
                        ? data.currentStreak || 0
                        : 0,
                    bestStreak: data.bestStreak || 0,
                    totalDaysCompleted: data.totalDaysCompleted || 0,
                    totalPuzzlesSolved: data.totalPuzzlesSolved || 0,
                };
            }

            // Increment totalPuzzlesSolved for single puzzle
            await streakRef.set({
                totalPuzzlesSolved: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        const response: Record<string, unknown> = {
            success: true,
            puzzleScore: result.puzzleScore,
            totalDailyScore: result.totalDailyScore,
            completedCount: result.completedCount,
            allCompleted: result.allCompleted,
            streak: streakInfo,
        };

        if (result.allCompleted) {
            response.bonusScore = bonusScore;
            response.finalScore = result.totalDailyScore + bonusScore;
        }

        res.status(200).json(response);
    } catch (error) {
        functions.logger.error("submitDailyPuzzle failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ═══════════════════════════════════════════════════════════════
//  getDailyProgress
//
//  GET /getDailyProgress?deviceId=xxx
//
//  Returns user's progress for today's daily challenge.
// ═══════════════════════════════════════════════════════════════

export const getDailyProgress = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;
        if (!deviceId) {
            res.status(400).json({ success: false, error: "deviceId query parameter is required." });
            return;
        }

        const todayDate = getTodayUTC();
        const db = admin.firestore();
        const progressRef = db.collection("dailyProgress").doc(deviceId);
        const progressDoc = await progressRef.get();

        if (!progressDoc.exists || progressDoc.data()!.currentDate !== todayDate) {
            res.status(200).json({
                success: true,
                date: todayDate,
                completedPuzzles: [],
                puzzleResults: {},
                totalScore: 0,
                allCompleted: false,
            });
            return;
        }

        const data = progressDoc.data()!;
        res.status(200).json({
            success: true,
            date: todayDate,
            completedPuzzles: data.completedPuzzles || [],
            puzzleResults: data.puzzleResults || {},
            totalScore: data.totalScore || 0,
            allCompleted: data.allCompleted || false,
        });
    } catch (error) {
        functions.logger.error("getDailyProgress failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ═══════════════════════════════════════════════════════════════
//  getDailyStreak
//
//  GET /getDailyStreak?deviceId=xxx
//
//  Returns user's streak statistics.
// ═══════════════════════════════════════════════════════════════

export const getDailyStreak = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;
        if (!deviceId) {
            res.status(400).json({ success: false, error: "deviceId query parameter is required." });
            return;
        }

        const todayDate = getTodayUTC();
        const db = admin.firestore();
        const streakRef = db.collection("dailyStreaks").doc(deviceId);
        const streakDoc = await streakRef.get();

        if (!streakDoc.exists) {
            res.status(200).json({
                success: true,
                currentStreak: 0,
                bestStreak: 0,
                totalDaysCompleted: 0,
                totalPuzzlesSolved: 0,
                lastCompletedDate: null,
                streakAlive: false,
            });
            return;
        }

        const data = streakDoc.data()!;
        const lastCompletedDate = data.lastCompletedDate || null;
        const alive = isStreakAlive(lastCompletedDate, todayDate);

        res.status(200).json({
            success: true,
            currentStreak: alive ? (data.currentStreak || 0) : 0,
            bestStreak: data.bestStreak || 0,
            totalDaysCompleted: data.totalDaysCompleted || 0,
            totalPuzzlesSolved: data.totalPuzzlesSolved || 0,
            lastCompletedDate,
            streakAlive: alive,
        });
    } catch (error) {
        functions.logger.error("getDailyStreak failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
