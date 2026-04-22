import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getTierByScore } from "./utils/tiers";

export const syncAllTiers = functions.https.onRequest(async (req, res) => {
    try {
        const db = admin.firestore();
        const usersSnapshot = await db.collection("users").get();
        let updatedCount = 0;
        
        let batch = db.batch();
        let batchCount = 0;
        const BATCH_LIMIT = 400;

        for (const doc of usersSnapshot.docs) {
            const data = doc.data();
            const currentTier = data.tier;
            const score = data.weightedGlobalScore || 0;
            const expectedTier = getTierByScore(score);
            
            if (currentTier !== expectedTier) {
                batch.update(doc.ref, { tier: expectedTier });
                batchCount++;
                updatedCount++;
                
                if (batchCount >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            }
        }
        
        if (batchCount > 0) {
            await batch.commit();
        }

        res.status(200).send(`Successfully synced tier for ${updatedCount} users.`);
    } catch (e) {
        functions.logger.error("Error during tier sync", e);
        res.status(500).send(String(e));
    }
});
