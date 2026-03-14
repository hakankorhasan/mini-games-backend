import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateLevels } from "./utils/laserPuzzle";

/**
 * seedLaserPuzzleLevels
 *
 * HTTP endpoint that batch-generates Laser Puzzle levels
 * and stores them in Firestore.
 *
 * GET/POST /seedLaserPuzzleLevels?count=200&startFrom=1
 *
 * Query params:
 *   count     — number of levels to generate (default: 200, max: 500)
 *   startFrom — starting level number (default: 1)
 */
export const seedLaserPuzzleLevels = functions
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onRequest(async (req, res) => {
        try {
            const count = Math.min(
                parseInt(req.query.count as string, 10) || 200,
                500
            );
            const startFrom = parseInt(req.query.startFrom as string, 10) || 1;

            functions.logger.info(
                `Generating ${count} Laser Puzzle levels starting from ${startFrom}`
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
                        .collection("laserPuzzleLevels")
                        .doc(`level_${level.levelNumber}`);
                    batch.set(ref, {
                        levelNumber: level.levelNumber,
                        gridSize: level.gridSize,
                        difficulty: level.difficulty,
                        lives: level.lives,
                        cells: level.cells,
                        solution: level.solution,
                    });
                }

                await batch.commit();
            }

            functions.logger.info(
                `Successfully seeded ${levels.length} Laser Puzzle levels`
            );

            res.status(200).json({
                success: true,
                count: levels.length,
                startFrom,
                levels: levels.map((l) => ({
                    levelNumber: l.levelNumber,
                    gridSize: l.gridSize,
                    difficulty: l.difficulty,
                })),
            });
        } catch (error) {
            functions.logger.error("seedLaserPuzzleLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });
