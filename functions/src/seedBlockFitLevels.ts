import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateLevels, TOTAL_BLOCK_FIT_LEVELS } from "./utils/blockFitGenerator";

/**
 * seedBlockFitLevels
 *
 * HTTP POST endpoint — generates and stores all Block Fit levels.
 *
 * POST /seedBlockFitLevels?count=200&startFrom=1
 *
 * Query params:
 *   count     — number of levels to generate (default: 200, max: 500)
 *   startFrom — starting level number (default: 1)
 *
 * Firestore path: blockFitLevels/level_{N}
 */
export const seedBlockFitLevels = functions
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
            const count = Math.min(
                parseInt(req.query.count as string, 10) || TOTAL_BLOCK_FIT_LEVELS,
                500
            );
            const startFrom = parseInt(req.query.startFrom as string, 10) || 1;

            functions.logger.info(
                `Generating ${count} Block Fit levels starting from ${startFrom}`
            );

            const levels = generateLevels(startFrom, count);

            // Batch write to Firestore (max 500 per batch)
            const db = admin.firestore();
            const batchSize = 500;

            for (let i = 0; i < levels.length; i += batchSize) {
                const batch = db.batch();
                const chunk = levels.slice(i, i + batchSize);

                for (const level of chunk) {
                    const ref = db
                        .collection("blockFitLevels")
                        .doc(`level_${level.levelNumber}`);
                    batch.set(ref, level);
                }

                await batch.commit();
            }

            functions.logger.info(
                `Successfully seeded ${levels.length} Block Fit levels`
            );

            res.status(200).json({
                success: true,
                message: `${levels.length} Block Fit levels generated.`,
                count: levels.length,
                startFrom,
                levels: levels.map((l) => ({
                    levelNumber: l.levelNumber,
                    difficulty: l.difficulty,
                    targetScore: l.targetScore,
                    difficultyValue: l.difficultyValue,
                })),
            });
        } catch (error) {
            functions.logger.error("seedBlockFitLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });
