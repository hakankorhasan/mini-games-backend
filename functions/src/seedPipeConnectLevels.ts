import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateLevel, TOTAL_PIPE_LEVELS } from "./utils/pipeGenerator";

/**
 * seedPipeConnectLevels
 *
 * HTTP POST endpoint — generates and stores all pipe connect levels.
 *
 * POST /seedPipeConnectLevels
 *
 * Firestore path: pipeConnectLevels/level_{N}
 */
export const seedPipeConnectLevels = functions
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
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
            let failedLevels: number[] = [];

            for (let lvl = 1; lvl <= TOTAL_PIPE_LEVELS; lvl++) {
                let level = null;
                // Try multiple times per level (generation can fail)
                for (let attempt = 0; attempt < 5; attempt++) {
                    level = generateLevel(lvl);
                    if (level) break;
                }

                if (!level) {
                    failedLevels.push(lvl);
                    functions.logger.warn(
                        `Failed to generate pipe level ${lvl} after 5 attempts`
                    );
                    continue;
                }

                const ref = db
                    .collection("pipeConnectLevels")
                    .doc(`level_${lvl}`);

                // Flatten for Firestore (avoid nested entity limit)
                const firestoreData = {
                    levelNumber: level.levelNumber,
                    gridSize: level.gridSize,
                    lives: level.lives,
                    difficulty: level.difficulty,
                    difficultyValue: level.difficultyValue,
                    sourceRow: level.sourceRow,
                    sourceCol: level.sourceCol,
                    sinkRow: level.sinkRow,
                    sinkCol: level.sinkCol,
                    sourceDirection: level.sourceDirection,
                    sinkDirection: level.sinkDirection,
                    // Serialize complex nested data as JSON strings
                    cellsJson: JSON.stringify(level.cells),
                    solutionJson: JSON.stringify(level.solution),
                };

                batch.set(ref, firestoreData);
                batchCount++;
                totalSeeded++;

                if (batchCount >= 499) {
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
                `Pipe Connect seeding complete: ${totalSeeded} levels`
            );

            res.status(200).json({
                success: true,
                message: `${totalSeeded} pipe connect levels generated.`,
                totalLevels: TOTAL_PIPE_LEVELS,
                failed: failedLevels.length > 0 ? failedLevels : undefined,
            });
        } catch (error) {
            functions.logger.error("seedPipeConnectLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });
