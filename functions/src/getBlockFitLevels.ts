import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { TOTAL_BLOCK_FIT_LEVELS } from "./utils/blockFitGenerator";

/**
 * getBlockFitLevels
 *
 * HTTP GET endpoint — returns Block Fit level data.
 *
 * Two modes:
 *
 * 1. Single level (for gameplay):
 *    GET /getBlockFitLevels?level=5
 *    → Returns full level data WITH prefill, blockPool
 *
 * 2. Level list (for level selection screen):
 *    GET /getBlockFitLevels?page=1&pageSize=20
 *    → Returns lightweight list (levelNumber, difficulty, targetScore)
 */
export const getBlockFitLevels = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "GET") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use GET.",
            });
            return;
        }

        try {
            const db = admin.firestore();
            const levelParam = req.query.level;

            // ── Single level mode ──
            if (levelParam) {
                const levelNumber = parseInt(String(levelParam), 10);
                if (isNaN(levelNumber) || levelNumber < 1) {
                    res.status(400).json({
                        success: false,
                        error: "level must be a positive integer.",
                    });
                    return;
                }

                const doc = await db
                    .collection("blockFitLevels")
                    .doc(`level_${levelNumber}`)
                    .get();

                if (!doc.exists) {
                    res.status(404).json({
                        success: false,
                        error: `Level ${levelNumber} not found.`,
                    });
                    return;
                }

                res.status(200).json({
                    success: true,
                    level: doc.data(),
                });
                return;
            }

            // ── Level list mode ──
            const page = Math.max(
                1,
                parseInt(String(req.query.page ?? 1), 10)
            );
            const pageSize = Math.min(
                50,
                Math.max(1, parseInt(String(req.query.pageSize ?? 20), 10))
            );
            const offset = (page - 1) * pageSize;

            const snapshot = await db
                .collection("blockFitLevels")
                .orderBy("levelNumber", "asc")
                .offset(offset)
                .limit(pageSize)
                .select(
                    "levelNumber",
                    "gridSize",
                    "difficulty",
                    "difficultyValue",
                    "targetScore"
                )
                .get();

            const levels = snapshot.docs.map((doc) => doc.data());

            res.status(200).json({
                success: true,
                page,
                pageSize,
                totalLevels: TOTAL_BLOCK_FIT_LEVELS,
                totalPages: Math.ceil(TOTAL_BLOCK_FIT_LEVELS / pageSize),
                levels,
            });
        } catch (error) {
            functions.logger.error("getBlockFitLevels error:", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);
