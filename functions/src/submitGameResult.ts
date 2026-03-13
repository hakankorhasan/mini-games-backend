import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { calculateRatingChange } from "./utils/rating";
import { getTier } from "./utils/tiers";
import { calculateGlobalScore } from "./utils/globalScore";
import { validateGameResult } from "./utils/validation";
import { getCoefficient } from "./utils/gameCoefficients";

/**
 * submitGameResult
 *
 * HTTP POST endpoint — client calls this after completing a game round.
 * Uses deviceId-based identification (no Firebase Auth required).
 *
 * Per game+level, there is a SINGLE best-score record. When the player
 * replays a level:
 *  - If new score > previous best → update record, add DELTA to globalScore
 *  - If new score ≤ previous best → no update, return improved: false
 *
 * Additionally maintains:
 *  - users/{deviceId}/gameStats/{gameId} → per-game aggregated stats
 *  - users/{deviceId}.weightedGlobalScore → Σ(bestScore × coefficient)
 *
 * POST /submitGameResult
 * Body: { deviceId, gameId, level, difficulty, correct, responseTime, isStoryMode? }
 *
 * Returns:
 *  { success, improved, newRating, ratingChange, tier, scoreGained, newStreak,
 *    previousBest?, weightedGlobalScore?, gameStats?, message? }
 */
export const submitGameResult = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { deviceId, gameId, level, difficulty, correct, responseTime, isStoryMode } = req.body;

        // 1. DeviceId validation
        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }

        // 2. Anti-cheat validation
        const validation = validateGameResult({
            gameId,
            difficulty,
            correct,
            responseTime,
        });
        if (!validation.valid) {
            res.status(400).json({
                success: false,
                error: validation.reason || "Invalid input.",
            });
            return;
        }

        // Validate level
        if (typeof level !== "number" || level < 1 || !Number.isInteger(level)) {
            res.status(400).json({
                success: false,
                error: "level must be a positive integer.",
            });
            return;
        }

        const db = admin.firestore();
        const userRef = db.collection("users").doc(deviceId);
        const gameStatsRef = userRef.collection("gameStats").doc(gameId);
        // Single record per device+game+level
        const matchResultRef = db.collection("matchResults").doc(`${deviceId}_${gameId}_lvl_${level}`);

        // 3. Transaction: read → compare → write (if improved)
        const result = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const gameStatsDoc = await transaction.get(gameStatsRef);
            const existingMatchDoc = await transaction.get(matchResultRef);

            // ── Calculate new score ──
            const currentRating = userDoc.exists
                ? (userDoc.data()!.rating || 1000)
                : 1000;

            const { newRating, ratingChange } = calculateRatingChange({
                currentRating,
                difficulty,
                correct,
                responseTime,
            });

            const tier = getTier(newRating);

            let scoreGained = 0;
            let newStreak = userDoc.exists
                ? (userDoc.data()!.currentStreak || 0)
                : 0;
            let bestStreak = userDoc.exists
                ? (userDoc.data()!.bestStreak || 0)
                : 0;

            if (!isStoryMode) {
                const globalResult = calculateGlobalScore({
                    difficulty,
                    correct,
                    responseTime,
                    currentStreak: newStreak,
                });
                scoreGained = globalResult.scoreGained;
                newStreak = globalResult.newStreak;
                bestStreak = Math.max(bestStreak, newStreak);
            }

            // ── Compare with previous best ──
            const previousBestScore = existingMatchDoc.exists
                ? (existingMatchDoc.data()!.scoreGained || 0)
                : 0;
            const previousBestRating = existingMatchDoc.exists
                ? (existingMatchDoc.data()!.ratingChange || 0)
                : 0;

            const improved = scoreGained > previousBestScore;

            // ── Get current gameStats for this game ──
            const currentGameBest = gameStatsDoc.exists
                ? (gameStatsDoc.data()!.bestScore || 0)
                : 0;
            const currentGameGamesPlayed = gameStatsDoc.exists
                ? (gameStatsDoc.data()!.gamesPlayed || 0)
                : 0;
            const currentGameTotalScore = gameStatsDoc.exists
                ? (gameStatsDoc.data()!.totalScore || 0)
                : 0;

            // ── Get coefficient for this game ──
            const coefficient = getCoefficient(gameId);

            // ── Auto-create user if first time ──
            if (!userDoc.exists) {
                const weightedScore = Math.round(scoreGained * coefficient);

                transaction.set(userRef, {
                    username: `Player_${deviceId.substring(0, 6)}`,
                    rating: newRating,
                    seasonRating: 1000,
                    tier: tier,
                    country: "",
                    gamesPlayed: 1,
                    correctAnswers: correct ? 1 : 0,
                    globalScore: scoreGained,
                    weightedGlobalScore: isStoryMode ? 0 : weightedScore,
                    currentStreak: newStreak,
                    bestStreak: bestStreak,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastActive: admin.firestore.FieldValue.serverTimestamp(),
                });

                // First play ever — always save the match result
                transaction.set(matchResultRef, {
                    deviceId,
                    gameId,
                    level,
                    difficulty,
                    correct,
                    responseTime,
                    ratingChange,
                    scoreGained,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Create gameStats for this game
                if (!isStoryMode) {
                    const newAvg = scoreGained;
                    transaction.set(gameStatsRef, {
                        gameId,
                        bestScore: scoreGained,
                        weightedScore,
                        gamesPlayed: 1,
                        totalScore: scoreGained,
                        avgScore: newAvg,
                        lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }

                return {
                    improved: true,
                    newRating,
                    ratingChange,
                    tier,
                    scoreGained,
                    newStreak,
                    previousBest: 0,
                    weightedGlobalScore: isStoryMode ? 0 : weightedScore,
                    gameStats: isStoryMode ? null : {
                        gameId,
                        bestScore: scoreGained,
                        coefficient,
                        weightedScore,
                        gamesPlayed: 1,
                    },
                };
            }

            // ── If NOT improved: only update streak, gamesPlayed ──
            if (!improved) {
                const updateData: Record<string, unknown> = {
                    gamesPlayed: admin.firestore.FieldValue.increment(1),
                    lastActive: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (!isStoryMode) {
                    updateData.currentStreak = newStreak;
                    updateData.bestStreak = bestStreak;
                }
                transaction.update(userRef, updateData);

                // Update gameStats gamesPlayed & avgScore even if not improved
                if (!isStoryMode) {
                    const newGamesPlayed = currentGameGamesPlayed + 1;
                    const newTotalScore = currentGameTotalScore + scoreGained;
                    const newAvg = Math.round((newTotalScore / newGamesPlayed) * 100) / 100;

                    if (gameStatsDoc.exists) {
                        transaction.update(gameStatsRef, {
                            gamesPlayed: newGamesPlayed,
                            totalScore: newTotalScore,
                            avgScore: newAvg,
                            lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    } else {
                        transaction.set(gameStatsRef, {
                            gameId,
                            bestScore: scoreGained,
                            weightedScore: Math.round(scoreGained * coefficient),
                            gamesPlayed: 1,
                            totalScore: scoreGained,
                            avgScore: scoreGained,
                            lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                }

                return {
                    improved: false,
                    newRating: currentRating, // rating stays the same
                    ratingChange: 0,
                    tier: getTier(currentRating),
                    scoreGained,
                    newStreak,
                    previousBest: previousBestScore,
                    weightedGlobalScore: userDoc.data()!.weightedGlobalScore || 0,
                    message: "Önceki en iyi skorunuzu geçemediniz!",
                };
            }

            // ── IMPROVED: update everything ──
            const scoreDelta = scoreGained - previousBestScore;
            const ratingDelta = ratingChange - previousBestRating;

            // Calculate new game best and weighted scores
            const newGameBest = Math.max(currentGameBest, scoreGained);
            const newGameWeightedScore = Math.round(newGameBest * coefficient);
            const oldGameWeightedScore = Math.round(currentGameBest * coefficient);
            const weightedScoreDelta = newGameWeightedScore - oldGameWeightedScore;

            const updateData: Record<string, unknown> = {
                rating: currentRating + ratingDelta,
                tier: getTier(currentRating + ratingDelta),
                gamesPlayed: admin.firestore.FieldValue.increment(1),
                correctAnswers: correct
                    ? admin.firestore.FieldValue.increment(1)
                    : admin.firestore.FieldValue.increment(0),
                lastActive: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (!isStoryMode) {
                updateData.globalScore = admin.firestore.FieldValue.increment(scoreDelta);
                updateData.weightedGlobalScore = admin.firestore.FieldValue.increment(weightedScoreDelta);
                updateData.currentStreak = newStreak;
                updateData.bestStreak = bestStreak;
            }

            transaction.update(userRef, updateData);

            // Update the match result record with new best values
            transaction.set(matchResultRef, {
                deviceId,
                gameId,
                level,
                difficulty,
                correct,
                responseTime,
                ratingChange,
                scoreGained,
                createdAt: existingMatchDoc.exists
                    ? existingMatchDoc.data()!.createdAt
                    : admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Update gameStats for this game
            if (!isStoryMode) {
                const newGamesPlayed = currentGameGamesPlayed + 1;
                const newTotalScore = currentGameTotalScore + scoreGained;
                const newAvg = Math.round((newTotalScore / newGamesPlayed) * 100) / 100;

                if (gameStatsDoc.exists) {
                    transaction.update(gameStatsRef, {
                        bestScore: newGameBest,
                        weightedScore: newGameWeightedScore,
                        gamesPlayed: newGamesPlayed,
                        totalScore: newTotalScore,
                        avgScore: newAvg,
                        lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } else {
                    transaction.set(gameStatsRef, {
                        gameId,
                        bestScore: scoreGained,
                        weightedScore: Math.round(scoreGained * coefficient),
                        gamesPlayed: 1,
                        totalScore: scoreGained,
                        avgScore: scoreGained,
                        lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }

            const finalRating = currentRating + ratingDelta;
            const currentWeightedGlobal = userDoc.data()!.weightedGlobalScore || 0;

            return {
                improved: true,
                newRating: finalRating,
                ratingChange: ratingDelta,
                tier: getTier(finalRating),
                scoreGained,
                newStreak,
                previousBest: previousBestScore,
                weightedGlobalScore: currentWeightedGlobal + weightedScoreDelta,
                gameStats: {
                    gameId,
                    bestScore: newGameBest,
                    coefficient,
                    weightedScore: newGameWeightedScore,
                    gamesPlayed: currentGameGamesPlayed + 1,
                },
            };
        });

        functions.logger.info(
            `Game result: device=${deviceId} game=${gameId} lvl=${level} ` +
            `improved=${result.improved} score=${result.scoreGained} prev=${result.previousBest}`
        );

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        functions.logger.error("submitGameResult failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
