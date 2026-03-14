import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * saveLaserPuzzleProgress
 *
 * Callable function — saves user progress for Laser Puzzle.
 * Called after completing a level.
 *
 * Payload:
 *   { currentLevel: number, completedLevel: number }
 */
export const saveLaserPuzzleProgress = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Must be logged in."
            );
        }

        const uid = context.auth.uid;
        const { currentLevel, completedLevel } = data;

        if (typeof currentLevel !== "number" || typeof completedLevel !== "number") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "currentLevel and completedLevel must be numbers."
            );
        }

        const db = admin.firestore();
        const ref = db.collection("laserPuzzleProgress").doc(uid);

        await db.runTransaction(async (tx) => {
            const doc = await tx.get(ref);
            const existing = doc.data();

            const completedLevels: number[] = existing?.completedLevels ?? [];
            if (!completedLevels.includes(completedLevel)) {
                completedLevels.push(completedLevel);
            }

            tx.set(
                ref,
                {
                    currentLevel,
                    completedLevels,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
        });

        return { success: true, currentLevel };
    }
);

/**
 * getLaserPuzzleProgress
 *
 * Callable function — returns user progress for Laser Puzzle.
 */
export const getLaserPuzzleProgress = functions.https.onCall(
    async (_data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Must be logged in."
            );
        }

        const uid = context.auth.uid;
        const db = admin.firestore();
        const doc = await db.collection("laserPuzzleProgress").doc(uid).get();

        if (!doc.exists) {
            return {
                success: true,
                progress: { currentLevel: 1, completedLevels: [] },
            };
        }

        return { success: true, progress: doc.data() };
    }
);
