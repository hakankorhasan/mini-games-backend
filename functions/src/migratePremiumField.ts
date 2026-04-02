/**
 * migratePremiumField
 *
 * One-time migration: Adds the default `premium` field to all existing
 * user documents that don't have it yet.
 *
 * Usage: Call POST /migratePremiumField (no body needed)
 * This is idempotent — safe to run multiple times.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const migratePremiumField = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const db = admin.firestore();
        const usersSnapshot = await db.collection("users").get();

        let updated = 0;
        let skipped = 0;
        const batch = db.batch();

        for (const doc of usersSnapshot.docs) {
            const data = doc.data();

            // Skip users who already have the premium field
            if (data.premium && typeof data.premium === "object" && "removeAds" in data.premium) {
                skipped++;
                continue;
            }

            // Add default premium field
            batch.update(doc.ref, {
                premium: {
                    removeAds: false,
                    storyMode: false,
                    ultimateBundle: false,
                    purchases: [],
                    lastVerifiedAt: null,
                },
            });
            updated++;

            // Firestore batch limit is 500
            if (updated % 450 === 0) {
                await batch.commit();
                functions.logger.info(`Committed batch of ${updated} users...`);
            }
        }

        // Commit remaining
        if (updated % 450 !== 0) {
            await batch.commit();
        }

        functions.logger.info(`Premium field migration complete`, { updated, skipped });

        res.status(200).json({
            success: true,
            message: `Migration complete. Updated: ${updated}, Skipped (already had premium): ${skipped}`,
            updated,
            skipped,
            total: usersSnapshot.size,
        });
    } catch (error) {
        functions.logger.error("migratePremiumField failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
