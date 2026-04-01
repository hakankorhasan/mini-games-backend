import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * getStarBattleLevels
 *
 * HTTP GET endpoint:
 *   GET /getStarBattleLevels?level=5       -> full level data (gameplay)
 *   GET /getStarBattleLevels?page=1&pageSize=20 -> lightweight list (level selection)
 */
export const getStarBattleLevels = functions.https.onRequest(
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

            // -- Single level mode --
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
                    .collection("starBattleLevels")
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
                    beaconsPerUnit: rawData.beaconsPerUnit,
                    difficulty: rawData.difficulty,
                    difficultyValue: rawData.difficultyValue,
                    regions: JSON.parse(rawData.regionsJson),
                    solution: JSON.parse(rawData.solutionJson),
                    regionColors: rawData.regionColors,
                };

                res.status(200).json({
                    success: true,
                    level,
                });
                return;
            }

            // -- Level list mode --
            const page = parseInt(String(req.query.page || "1"), 10);
            const pageSize = parseInt(String(req.query.pageSize || "20"), 10);
            const offset = (page - 1) * pageSize;

            const snapshot = await db
                .collection("starBattleLevels")
                .orderBy("levelNumber", "asc")
                .offset(offset)
                .limit(pageSize)
                .select(
                    "levelNumber",
                    "gridSize",
                    "beaconsPerUnit",
                    "difficulty",
                    "difficultyValue"
                )
                .get();

            const levels = snapshot.docs.map((doc) => doc.data());

            // Since we know the max is 500 from generator logic, but let's query count to be safe
            const totalSnapshot = await db.collection("starBattleLevels").count().get();
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
            functions.logger.error("getStarBattleLevels error:", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);
