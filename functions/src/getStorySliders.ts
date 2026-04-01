import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Endpoint returns the list of story mode sliders from the 'storySliders' collection.
 * They are returned sorted by 'order' ascending.
 */
export const getStorySliders = functions.https.onRequest(async (_req, res) => {
    try {
        const db = admin.firestore();
        const snapshot = await db.collection("storySliders")
            .orderBy("order", "asc")
            .get();

        const sliders: any[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            sliders.push({
                id: doc.id,
                ...data
            });
        });

        res.status(200).json({ success: true, count: sliders.length, sliders });
    } catch (error: any) {
        functions.logger.error("Error fetching story sliders", error);
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});
