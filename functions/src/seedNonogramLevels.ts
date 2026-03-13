import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateLevels } from "./utils/nonogram";
import { NonogramLevel } from "./types/nonogramTypes";

/**
 * Convert a NonogramLevel to Firestore-safe format.
 * Firestore does not support nested arrays (array of arrays),
 * so we convert:
 *   - solution: boolean[][] → boolean[] (flattened row-major)
 *   - rowClues: number[][] → Record<string, number[]> (map with string keys)
 *   - colClues: number[][] → Record<string, number[]>
 */
function toFirestoreFormat(level: NonogramLevel): Record<string, unknown> {
    const rowCluesMap: Record<string, number[]> = {};
    level.rowClues.forEach((clue, i) => {
        rowCluesMap[String(i)] = clue;
    });

    const colCluesMap: Record<string, number[]> = {};
    level.colClues.forEach((clue, i) => {
        colCluesMap[String(i)] = clue;
    });

    return {
        levelNumber: level.levelNumber,
        gridSize: level.gridSize,
        fillFraction: level.fillFraction,
        solution: level.solution.flat(),          // 2D → 1D
        rowClues: rowCluesMap,                     // array[] → map
        colClues: colCluesMap,                     // array[] → map
    };
}

/**
 * seedNonogramLevels
 *
 * HTTP endpoint that batch-generates Nonogram levels
 * and stores them in Firestore.
 *
 * GET/POST /seedNonogramLevels?count=100&startFrom=1
 *
 * Query params:
 *   count     — number of levels to generate (default: 100, max: 500)
 *   startFrom — starting level number (default: 1)
 *
 * Subsequent calls with same level numbers will overwrite (idempotent).
 */
export const seedNonogramLevels = functions
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onRequest(async (req, res) => {
        try {
            const count = Math.min(
                parseInt(req.query.count as string, 10) || 100,
                500
            );
            const startFrom = parseInt(req.query.startFrom as string, 10) || 1;

            functions.logger.info(
                `Generating ${count} Nonogram levels starting from ${startFrom}`
            );

            // Generate all levels
            const levels = generateLevels(startFrom, count);

            // Batch write to Firestore (max 500 per batch)
            const db = admin.firestore();
            const batchSize = 500;

            for (let i = 0; i < levels.length; i += batchSize) {
                const batch = db.batch();
                const chunk = levels.slice(i, i + batchSize);

                for (const level of chunk) {
                    const ref = db
                        .collection("nonogramLevels")
                        .doc(`level_${level.levelNumber}`);
                    batch.set(ref, toFirestoreFormat(level));
                }

                await batch.commit();
            }

            functions.logger.info(
                `Successfully seeded ${levels.length} Nonogram levels`
            );

            res.status(200).json({
                success: true,
                count: levels.length,
                startFrom,
                levels: levels.map((l) => ({
                    levelNumber: l.levelNumber,
                    gridSize: l.gridSize,
                    fillFraction: l.fillFraction,
                })),
            });
        } catch (error) {
            functions.logger.error("seedNonogramLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });
