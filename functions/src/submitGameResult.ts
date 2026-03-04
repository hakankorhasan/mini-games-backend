import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { calculateRatingChange } from "./utils/rating";
import { getTier } from "./utils/tiers";
import { validateGameResult } from "./utils/validation";

/**
 * submitGameResult
 *
 * Client calls this after completing a game round.
 * Validates input, calculates rating change, and atomically
 * updates user doc + writes match log.
 *
 * Input:
 *  { gameId: string, difficulty: number, correct: boolean, responseTime: number }
 *
 * Returns:
 *  { newRating: number, ratingChange: number, tier: string }
 */
export const submitGameResult = functions.https.onCall(
    async (data: {
        gameId: string;
        difficulty: number;
        correct: boolean;
        responseTime: number;
    }, context: functions.https.CallableContext) => {
        // 1. Auth check
        const uid = context.auth?.uid;
        if (!uid) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required."
            );
        }

        const { gameId, difficulty, correct, responseTime } = data;

        // 2. Anti-cheat validation
        const validation = validateGameResult({
            gameId,
            difficulty,
            correct,
            responseTime,
        });
        if (!validation.valid) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                validation.reason || "Invalid input."
            );
        }

        const db = admin.firestore();
        const userRef = db.collection("users").doc(uid);
        const gameStatsRef = userRef.collection("gameStats").doc(gameId);

        // 3. Transaction: read current rating → calculate → write
        const result = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new functions.https.HttpsError(
                    "not-found",
                    "User document not found."
                );
            }

            const userData = userDoc.data()!;
            const currentRating = userData.rating || 1000;

            // Calculate rating change
            const { newRating, ratingChange } = calculateRatingChange({
                currentRating,
                difficulty,
                correct,
                responseTime,
            });

            const tier = getTier(newRating);

            // Update user doc
            transaction.update(userRef, {
                rating: newRating,
                tier: tier,
                gamesPlayed: admin.firestore.FieldValue.increment(1),
                correctAnswers: correct
                    ? admin.firestore.FieldValue.increment(1)
                    : admin.firestore.FieldValue.increment(0),
                lastActive: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Update per-game stats
            const gameStatsDoc = await transaction.get(gameStatsRef);
            if (gameStatsDoc.exists) {
                const gsData = gameStatsDoc.data()!;
                const oldTotal = gsData.avgResponseTime * gsData.gamesPlayed;
                const newGamesPlayed = gsData.gamesPlayed + 1;
                const newAvg = (oldTotal + responseTime) / newGamesPlayed;

                transaction.update(gameStatsRef, {
                    rating: newRating,
                    gamesPlayed: admin.firestore.FieldValue.increment(1),
                    correct: correct
                        ? admin.firestore.FieldValue.increment(1)
                        : admin.firestore.FieldValue.increment(0),
                    avgResponseTime: newAvg,
                });
            } else {
                transaction.set(gameStatsRef, {
                    rating: newRating,
                    gamesPlayed: 1,
                    correct: correct ? 1 : 0,
                    avgResponseTime: responseTime,
                });
            }

            return { newRating, ratingChange, tier };
        });

        // 4. Write match result log (outside transaction for perf)
        await db.collection("matchResults").add({
            uid,
            gameId,
            difficulty,
            correct,
            responseTime,
            ratingChange: result.ratingChange,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return result;
    }
);
