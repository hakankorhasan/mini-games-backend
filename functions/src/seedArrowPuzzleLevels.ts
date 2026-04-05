import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateLevels, TOTAL_ARROW_PUZZLE_LEVELS } from "./utils/arrowPuzzleGenerator";

/**
 * seedArrowPuzzleLevels
 *
 * HTTP POST endpoint — generates and stores Arrow Puzzle levels.
 *
 * POST /seedArrowPuzzleLevels?count=50&startFrom=1
 *
 * Query params:
 *   count     — number of levels to generate (default: 50, max: 100)
 *   startFrom — starting level number (default: 1)
 *
 * Firestore path: arrowPuzzleLevels/level_{N}
 *
 * Note: Arrow Puzzle generation is CPU-intensive (DFS solver per level).
 * Keep batch sizes small (~50) to stay within Cloud Function limits.
 */
export const seedArrowPuzzleLevels = functions
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
            const count = Math.min(
                parseInt(req.query.count as string, 10) || 50,
                100
            );
            const startFrom = parseInt(req.query.startFrom as string, 10) || 1;

            functions.logger.info(
                `Generating ${count} Arrow Puzzle levels starting from ${startFrom}`
            );

            const levels = generateLevels(startFrom, count);

            if (levels.length === 0) {
                res.status(500).json({
                    success: false,
                    error: "Failed to generate any levels. Try with different parameters.",
                });
                return;
            }

            // Batch write to Firestore (max 500 per batch)
            const db = admin.firestore();
            const batchSize = 500;

            for (let i = 0; i < levels.length; i += batchSize) {
                const batch = db.batch();
                const chunk = levels.slice(i, i + batchSize);

                for (const level of chunk) {
                    const ref = db
                        .collection("arrowPuzzleLevels")
                        .doc(`level_${level.levelNumber}`);
                    batch.set(ref, {
                        levelNumber: level.levelNumber,
                        gameType: level.gameType,
                        difficulty: level.difficulty,
                        difficultyScore: level.difficultyScore,
                        grid: level.grid,
                        activeCells: level.activeCells,
                        shapeName: level.shapeName,
                        streams: level.streams,
                        solution: level.solution,
                    });
                }

                await batch.commit();
            }

            functions.logger.info(
                `Successfully seeded ${levels.length} Arrow Puzzle levels`
            );

            res.status(200).json({
                success: true,
                message: `${levels.length} Arrow Puzzle levels generated (requested ${count}).`,
                count: levels.length,
                startFrom,
                totalPossible: TOTAL_ARROW_PUZZLE_LEVELS,
                levels: levels.map((l) => ({
                    levelNumber: l.levelNumber,
                    difficulty: l.difficulty,
                    difficultyScore: l.difficultyScore,
                    streamCount: l.streams.length,
                    solutionLength: l.solution.length,
                })),
            });
        } catch (error) {
            functions.logger.error("seedArrowPuzzleLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });
