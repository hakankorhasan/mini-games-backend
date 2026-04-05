import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * getArrowPuzzleLevels
 *
 * HTTP GET endpoint — returns Arrow Puzzle level data.
 *
 * Two modes:
 *
 * 1. Single level (for gameplay):
 *    GET /getArrowPuzzleLevels?level=5
 *    → Returns full level data WITH streams, solution
 *
 * 2. Level list (for level selection screen):
 *    GET /getArrowPuzzleLevels?page=1&pageSize=20
 *    → Returns lightweight list (levelNumber, difficulty, difficultyScore, streamCount)
 */
export const getArrowPuzzleLevels = functions.https.onRequest(
    async (req, res) => {
        // CORS
        res.set("Access-Control-Allow-Origin", "*");
        if (req.method === "OPTIONS") {
            res.set("Access-Control-Allow-Methods", "GET");
            res.set("Access-Control-Allow-Headers", "Content-Type");
            res.status(204).send("");
            return;
        }

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
                    .collection("arrowPuzzleLevels")
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
                .collection("arrowPuzzleLevels")
                .orderBy("levelNumber", "asc")
                .offset(offset)
                .limit(pageSize)
                .select(
                    "levelNumber",
                    "difficulty",
                    "difficultyScore",
                    "grid"
                )
                .get();

            const levels = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    levelNumber: data.levelNumber,
                    difficulty: data.difficulty,
                    difficultyScore: data.difficultyScore,
                    grid: data.grid,
                };
            });

            const totalSnapshot = await db
                .collection("arrowPuzzleLevels")
                .count()
                .get();
            const totalLevels = totalSnapshot.data().count;

            res.status(200).json({
                success: true,
                page,
                pageSize,
                totalLevels,
                totalPages: Math.ceil(totalLevels / pageSize),
                levels,
            });
        } catch (error) {
            functions.logger.error("getArrowPuzzleLevels error:", error);
            res.status(500).json({
                success: false,
                error: "Internal server error.",
            });
        }
    }
);
