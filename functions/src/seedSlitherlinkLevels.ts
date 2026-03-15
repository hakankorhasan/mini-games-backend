import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateLevel, TOTAL_SLITHERLINK_LEVELS } from "./utils/slitherlinkGenerator";

/**
 * seedSlitherlinkLevels
 *
 * HTTP POST endpoint — generates and stores all Slitherlink levels.
 *
 * POST /seedSlitherlinkLevels
 *
 * Firestore path: slitherlinkLevels/level_{N}
 */
export const seedSlitherlinkLevels = functions
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .https.onRequest(async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use POST.",
            });
            return;
        }

        try {
            const db = admin.firestore();
            let batch = db.batch();
            let batchCount = 0;
            let totalSeeded = 0;
            const failedLevels: number[] = [];

            for (let lvl = 1; lvl <= TOTAL_SLITHERLINK_LEVELS; lvl++) {
                let level = null;
                for (let attempt = 0; attempt < 10; attempt++) {
                    level = generateLevel(lvl);
                    if (level) break;
                }

                if (!level) {
                    failedLevels.push(lvl);
                    functions.logger.warn(
                        `Failed to generate slitherlink level ${lvl} after 10 attempts`
                    );
                    continue;
                }

                const ref = db
                    .collection("slitherlinkLevels")
                    .doc(`level_${lvl}`);

                batch.set(ref, level);
                batchCount++;
                totalSeeded++;

                if (batchCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                    functions.logger.info(
                        `Committed batch at ${totalSeeded} levels`
                    );
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            functions.logger.info(
                `Slitherlink seeding complete: ${totalSeeded} levels`
            );

            res.status(200).json({
                success: true,
                message: `${totalSeeded} slitherlink levels generated.`,
                totalLevels: TOTAL_SLITHERLINK_LEVELS,
                failed: failedLevels.length > 0 ? failedLevels : undefined,
            });
        } catch (error) {
            functions.logger.error("seedSlitherlinkLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });
