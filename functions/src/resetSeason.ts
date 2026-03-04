import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getTier } from "./utils/tiers";

/**
 * resetSeason
 *
 * Can be triggered by Cloud Scheduler (pubsub) or called manually.
 * Resets all users' season ratings with soft-reset formula:
 *
 *   newRating = 1000 + (oldRating - 1000) * 0.5
 *
 * Also creates a new season document and deactivates the previous one.
 */

// Scheduled version (every 30 days on the 1st at midnight UTC)
export const resetSeasonScheduled = functions.pubsub
    .schedule("0 0 1 * *") // 1st of every month at 00:00 UTC
    .timeZone("UTC")
    .onRun(async () => {
        await performSeasonReset();
    });

// Manual trigger version (for admin/testing)
export const resetSeasonManual = functions.https.onCall(
    async (_data: unknown, context: functions.https.CallableContext) => {
        if (!context.auth?.uid) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required."
            );
        }

        // TODO: Add admin check here in production
        // For now, any authenticated user can trigger (development only)

        await performSeasonReset();
        return { success: true, message: "Season reset completed." };
    }
);

async function performSeasonReset(): Promise<void> {
    const db = admin.firestore();

    // 1. Deactivate current active season
    const activeSeasons = await db
        .collection("seasons")
        .where("isActive", "==", true)
        .get();

    const batch = db.batch();

    activeSeasons.docs.forEach((doc) => {
        batch.update(doc.ref, {
            isActive: false,
            endDate: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    // 2. Create new season
    const newSeasonRef = db.collection("seasons").doc();
    batch.set(newSeasonRef, {
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        endDate: null,
        isActive: true,
    });

    await batch.commit();

    // 3. Reset all user season ratings (batch in groups of 500)
    const usersSnapshot = await db.collection("users").get();
    const batchSize = 500;

    for (let i = 0; i < usersSnapshot.docs.length; i += batchSize) {
        const userBatch = db.batch();
        const chunk = usersSnapshot.docs.slice(i, i + batchSize);

        chunk.forEach((doc) => {
            const oldRating = doc.data().rating || 1000;
            // Soft reset: pull everyone toward 1000
            const newSeasonRating = Math.round(1000 + (oldRating - 1000) * 0.5);
            const tier = getTier(newSeasonRating);

            userBatch.update(doc.ref, {
                seasonRating: newSeasonRating,
                tier: tier,
            });
        });

        await userBatch.commit();
    }

    functions.logger.info(
        `Season reset completed. ${usersSnapshot.docs.length} users updated.`
    );
}
