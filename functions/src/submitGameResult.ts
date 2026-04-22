import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { calculateRatingChange } from "./utils/rating";
import { getTierByScore } from "./utils/tiers";
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
 *  - users/{deviceId}.weightedGlobalScore → cumulative Σ(scoreGained × coefficient)
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
        const { deviceId, gameId, level, difficulty, correct, responseTime, isStoryMode, hintsUsed } = req.body;

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
                ? (userDoc.data()!.rating || 0)
                : 0;

            const { newRating, ratingChange } = calculateRatingChange({
                currentRating,
                difficulty,
                correct,
                responseTime,
            });

            const tier = getTierByScore(0); // New user, no weighted score yet

            let scoreGained = 0;
            let newStreak = gameStatsDoc.exists
                ? (gameStatsDoc.data()!.currentStreak || 0)
                : 0;
            let bestStreak = gameStatsDoc.exists
                ? (gameStatsDoc.data()!.bestStreak || 0)
                : 0;

            if (!isStoryMode) {
                // Define replay: if they've successfully beaten this exactly level before, it's a replay.
                const isSuccessfulReplay = existingMatchDoc.exists && existingMatchDoc.data()!.correct === true;

                const globalResult = calculateGlobalScore({
                    level,
                    difficulty,
                    correct,
                    responseTime,
                    currentStreak: newStreak,
                    hintsUsed: typeof hintsUsed === "number" ? hintsUsed : 0,
                    gameId,
                    isReplay: isSuccessfulReplay,
                    level,
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

            // ── Cumulative weighted score for this play ──
            const playWeightedScore = isStoryMode ? 0 : Math.round(scoreGained * coefficient);

            // ── Auto-create user if first time ──
            if (!userDoc.exists) {
                transaction.set(userRef, {
                    username: `Player_${deviceId.substring(0, 6)}`,
                    rating: newRating,
                    seasonRating: 0,
                    tier: getTierByScore(playWeightedScore),
                    country: "",
                    gamesPlayed: 1,
                    correctAnswers: correct ? 1 : 0,
                    globalScore: scoreGained,
                    weightedGlobalScore: playWeightedScore,
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
                    transaction.set(gameStatsRef, {
                        gameId,
                        bestScore: scoreGained,
                        weightedScore: playWeightedScore,
                        gamesPlayed: 1,
                        totalScore: scoreGained,
                        avgScore: scoreGained,
                        currentStreak: newStreak,
                        bestStreak: bestStreak,
                        lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }

                return {
                    improved: true,
                    previousRating: 0,
                    newRating,
                    ratingChange,
                    tier,
                    scoreGained,
                    newStreak,
                    previousBest: 0,
                    previousGlobalScore: 0,
                    globalScoreChange: scoreGained,
                    weightedGlobalScore: playWeightedScore,
                    gameStats: isStoryMode ? null : {
                        gameId,
                        bestScore: scoreGained,
                        coefficient,
                        weightedScore: playWeightedScore,
                        gamesPlayed: 1,
                    },
                };
            }

            // ── If NOT improved: update streak, gamesPlayed, and cumulative weighted score ──
            if (!improved) {
                const updateData: Record<string, unknown> = {
                    gamesPlayed: admin.firestore.FieldValue.increment(1),
                    lastActive: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (!isStoryMode) {
                    // Always add to weighted score (cumulative)
                    updateData.weightedGlobalScore = admin.firestore.FieldValue.increment(playWeightedScore);
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
                            weightedScore: admin.firestore.FieldValue.increment(playWeightedScore),
                            avgScore: newAvg,
                            currentStreak: newStreak,
                            bestStreak: bestStreak,
                            lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    } else {
                        transaction.set(gameStatsRef, {
                            gameId,
                            bestScore: scoreGained,
                            weightedScore: playWeightedScore,
                            gamesPlayed: 1,
                            totalScore: scoreGained,
                            avgScore: scoreGained,
                            currentStreak: newStreak,
                            bestStreak: bestStreak,
                            lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                }

                const currentWeighted = userDoc.data()!.weightedGlobalScore || 0;
                const currentGlobalScore = userDoc.data()!.globalScore || 0;
                const currentGameWeightedScore = gameStatsDoc.exists
                    ? (gameStatsDoc.data()!.weightedScore || 0)
                    : 0;

                return {
                    improved: false,
                    previousRating: currentRating,
                    newRating: currentRating,
                    ratingChange: 0,
                    tier: getTierByScore(currentWeighted + playWeightedScore),
                    scoreGained,
                    newStreak,
                    previousBest: previousBestScore,
                    previousGlobalScore: currentGlobalScore,
                    globalScoreChange: 0,
                    weightedGlobalScore: currentWeighted + playWeightedScore,
                    gameStats: isStoryMode ? null : {
                        gameId,
                        bestScore: Math.max(currentGameBest, scoreGained),
                        coefficient,
                        weightedScore: currentGameWeightedScore + playWeightedScore,
                        gamesPlayed: currentGameGamesPlayed + 1,
                    },
                };
            }

            // ── IMPROVED: update everything ──
            const scoreDelta = scoreGained - previousBestScore;
            const ratingDelta = ratingChange - previousBestRating;
            const newGameBest = Math.max(currentGameBest, scoreGained);
            const currentWeightedGlobal = userDoc.data()!.weightedGlobalScore || 0;
            const currentGlobalScore = userDoc.data()!.globalScore || 0;

            const updateData: Record<string, unknown> = {
                rating: currentRating + ratingDelta,
                tier: getTierByScore(currentWeightedGlobal + playWeightedScore),
                gamesPlayed: admin.firestore.FieldValue.increment(1),
                correctAnswers: correct
                    ? admin.firestore.FieldValue.increment(1)
                    : admin.firestore.FieldValue.increment(0),
                lastActive: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (!isStoryMode) {
                updateData.globalScore = admin.firestore.FieldValue.increment(scoreDelta);
                // Cumulative: add this play's weighted score
                updateData.weightedGlobalScore = admin.firestore.FieldValue.increment(playWeightedScore);
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
                        weightedScore: admin.firestore.FieldValue.increment(playWeightedScore),
                        gamesPlayed: newGamesPlayed,
                        totalScore: newTotalScore,
                        avgScore: newAvg,
                        currentStreak: newStreak,
                        bestStreak: bestStreak,
                        lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } else {
                    transaction.set(gameStatsRef, {
                        gameId,
                        bestScore: scoreGained,
                        weightedScore: playWeightedScore,
                        gamesPlayed: 1,
                        totalScore: scoreGained,
                        avgScore: scoreGained,
                        currentStreak: newStreak,
                        bestStreak: bestStreak,
                        lastPlayedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }

            const finalRating = currentRating + ratingDelta;

            return {
                improved: true,
                previousRating: currentRating,
                newRating: finalRating,
                ratingChange: ratingDelta,
                tier: getTierByScore(currentWeightedGlobal + playWeightedScore),
                scoreGained,
                newStreak,
                previousBest: previousBestScore,
                previousGlobalScore: currentGlobalScore,
                globalScoreChange: scoreDelta,
                weightedGlobalScore: currentWeightedGlobal + playWeightedScore,
                gameStats: {
                    gameId,
                    bestScore: newGameBest,
                    coefficient,
                    weightedScore: playWeightedScore,
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
