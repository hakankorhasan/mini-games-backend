import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateLevels } from "./utils/starBattleGenerator";
import { StarBattleLevel } from "./types/starBattleTypes";

/**
 * Convert a StarBattleLevel to Firestore-safe format.
 * Firestore doesn't support nested arrays natively, so we convert:
 *   - regions: number[][] -> string (JSON)
 *   - solution: boolean[][] -> string (JSON)
 */
function toFirestoreFormat(level: StarBattleLevel): Record<string, unknown> {
    return {
        levelNumber: level.levelNumber,
        gridSize: level.gridSize,
        beaconsPerUnit: level.beaconsPerUnit,
        difficulty: level.difficulty,
        difficultyValue: level.difficultyValue,
        regionsJson: JSON.stringify(level.regions),
        solutionJson: JSON.stringify(level.solution),
        regionColors: level.regionColors,
    };
}

/**
 * seedStarBattleLevels
 *
 * HTTP POST endpoint — generates and stores Star Battle levels.
 *
 * POST /seedStarBattleLevels?count=500&startFrom=1
 * 
 * Generates 500 progressive levels with B=1 and B=2 modes.
 */
export const seedStarBattleLevels = functions
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
            const count = Math.min(parseInt(req.query.count as string, 10) || 500, 500);
            const startFrom = parseInt(req.query.startFrom as string, 10) || 1;

            functions.logger.info(`Generating ${count} Star Battle levels starting from ${startFrom}`);

            const levels = generateLevels(startFrom, count);

            const db = admin.firestore();
            let batch = db.batch();
            let batchCount = 0;
            let totalSeeded = 0;

            for (const level of levels) {
                const ref = db
                    .collection("starBattleLevels")
                    .doc(`level_${level.levelNumber}`);

                batch.set(ref, toFirestoreFormat(level));
                batchCount++;
                totalSeeded++;

                // Max 500 writes per batch
                if (batchCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                    functions.logger.info(`Committed batch at ${totalSeeded} levels`);
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            functions.logger.info(`Star Battle seeding complete: ${totalSeeded} levels`);

            res.status(200).json({
                success: true,
                message: `${totalSeeded} Star Battle levels generated.`,
                levelsGenerated: levels.length,
            });
        } catch (error) {
            functions.logger.error("seedStarBattleLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });
