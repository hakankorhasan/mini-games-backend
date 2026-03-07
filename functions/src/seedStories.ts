import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { allStories } from "./data/storyData";

/**
 * seedStories
 *
 * One-shot HTTPS callable function that batch-writes all story
 * documents into the `gameStories` Firestore collection.
 *
 * Call once from Firebase Console or via HTTP to populate the data.
 * Subsequent calls will overwrite existing documents (idempotent).
 *
 * Returns: { success: true, count: number }
 */
export const seedStories = functions.https.onCall(
    async (_data: unknown, context: functions.https.CallableContext) => {
        // Optional: restrict to admin users only
        // if (!context.auth) {
        //     throw new functions.https.HttpsError(
        //         "unauthenticated",
        //         "Authentication required."
        //     );
        // }

        const db = admin.firestore();
        const batch = db.batch();

        for (const story of allStories) {
            const ref = db.collection("gameStories").doc(story.id);
            batch.set(ref, story);
        }

        await batch.commit();

        return {
            success: true,
            count: allStories.length,
        };
    }
);
