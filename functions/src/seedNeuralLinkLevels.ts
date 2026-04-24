import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateLevel, TOTAL_NEURAL_LINK_LEVELS } from "./utils/neuralLinkGenerator";

/**
 * seedNeuralLinkLevels
 *
 * HTTP POST endpoint — generates and stores all Neural Link levels.
 * Firestore path: neuralLinkLevels/level_{N}
 */
export const seedNeuralLinkLevels = functions
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onRequest(async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({ success: false, error: "Use POST." });
            return;
        }

        try {
            const db = admin.firestore();
            let batch = db.batch();
            let batchCount = 0;
            let totalSeeded = 0;
            const failedLevels: number[] = [];

            const startFrom = parseInt(req.query.startFrom as string) || 1;
            const endAt = parseInt(req.query.endAt as string) || TOTAL_NEURAL_LINK_LEVELS;

            for (let lvl = startFrom; lvl <= endAt; lvl++) {
                let level = null;
                for (let attempt = 0; attempt < 10; attempt++) {
                    level = generateLevel(lvl);
                    if (level) break;
                }

                if (!level) {
                    failedLevels.push(lvl);
                    functions.logger.warn(`Failed neural link level ${lvl}`);
                    continue;
                }

                const ref = db.collection("neuralLinkLevels").doc(`level_${lvl}`);
                // Serialize nested arrays as JSON for Firestore
                batch.set(ref, {
                    levelNumber: level.levelNumber,
                    gridSize: level.gridSize,
                    flowCount: level.flowCount,
                    deadNeuronCount: level.deadNeuronCount,
                    difficulty: level.difficulty,
                    difficultyValue: level.difficultyValue,
                    endpointsJson: JSON.stringify(level.endpoints),
                    deadCellsJson: JSON.stringify(level.deadCells),
                    solutionJson: JSON.stringify(level.solution),
                });
                batchCount++;
                totalSeeded++;

                if (batchCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                    functions.logger.info(`Committed batch at ${totalSeeded} levels`);
                }
            }

            if (batchCount > 0) await batch.commit();

            res.status(200).json({
                success: true,
                message: `${totalSeeded} neural link levels generated.`,
                totalLevels: TOTAL_NEURAL_LINK_LEVELS,
                failed: failedLevels.length > 0 ? failedLevels : undefined,
            });
        } catch (error) {
            functions.logger.error("seedNeuralLinkLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });
