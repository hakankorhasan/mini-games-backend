import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { TOTAL_SLITHERLINK_LEVELS } from "./utils/slitherlinkGenerator";

/**
 * getSlitherlinkLevels
 *
 * HTTP GET endpoint:
 *   GET /getSlitherlinkLevels?level=5       → full level data (gameplay)
 *   GET /getSlitherlinkLevels?page=1&pageSize=20 → lightweight list (level selection)
 */
export const getSlitherlinkLevels = functions.https.onRequest(
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
                    .collection("slitherlinkLevels")
                    .doc(`level_${levelNumber}`)
                    .get();

                if (!doc.exists) {
                    res.status(404).json({
                        success: false,
                        error: `Level ${levelNumber} not found.`,
                    });
                    return;
                }

                const rawData = doc.data()!;

                // Parse JSON-serialized nested arrays
                const level = {
                    levelNumber: rawData.levelNumber,
                    gridSize: rawData.gridSize,
                    difficulty: rawData.difficulty,
                    difficultyValue: rawData.difficultyValue,
                    clues: JSON.parse(rawData.cluesJson),
                    solution: JSON.parse(rawData.solutionJson),
                };

                res.status(200).json({
                    success: true,
                    level,
                });
                return;
            }

            // ── Level list mode ──
            const page = parseInt(String(req.query.page || "1"), 10);
            const pageSize = parseInt(
                String(req.query.pageSize || "20"),
                10
            );
            const offset = (page - 1) * pageSize;

            const snapshot = await db
                .collection("slitherlinkLevels")
                .orderBy("levelNumber", "asc")
                .offset(offset)
                .limit(pageSize)
                .select(
                    "levelNumber",
                    "gridSize",
                    "difficulty",
                    "difficultyValue"
                )
                .get();

            const levels = snapshot.docs.map((doc) => doc.data());

            res.status(200).json({
                success: true,
                page,
                pageSize,
                totalLevels: TOTAL_SLITHERLINK_LEVELS,
                totalPages: Math.ceil(TOTAL_SLITHERLINK_LEVELS / pageSize),
                levels,
            });
        } catch (error) {
            functions.logger.error("getSlitherlinkLevels error:", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);
