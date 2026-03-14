import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * getLaserPuzzleLevels — HTTP endpoint (GET)
 *
 * Two modes:
 *   GET /getLaserPuzzleLevels?level=5       → full level data (gameplay)
 *   GET /getLaserPuzzleLevels?page=1&pageSize=20 → lightweight list (level selection)
 */
export const getLaserPuzzleLevels = functions.https.onRequest(
    async (req, res) => {
        // CORS
        res.set("Access-Control-Allow-Origin", "*");
        if (req.method === "OPTIONS") {
            res.set("Access-Control-Allow-Methods", "GET");
            res.set("Access-Control-Allow-Headers", "Content-Type");
            res.status(204).send("");
            return;
        }

        const db = admin.firestore();
        const levelParam = req.query.level;

        try {
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
                    .collection("laserPuzzleLevels")
                    .doc(`level_${levelNumber}`)
                    .get();

                if (!doc.exists) {
                    res.status(404).json({
                        success: false,
                        error: `Level ${levelNumber} not found.`,
                    });
                    return;
                }

                res.json({
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

            const snapshot = await db
                .collection("laserPuzzleLevels")
                .orderBy("levelNumber", "asc")
                .offset((page - 1) * pageSize)
                .limit(pageSize)
                .select("levelNumber", "gridSize", "difficulty", "lives")
                .get();

            const levels = snapshot.docs.map((doc) => doc.data());

            const totalSnapshot = await db
                .collection("laserPuzzleLevels")
                .count()
                .get();
            const totalLevels = totalSnapshot.data().count;

            res.json({
                success: true,
                page,
                pageSize,
                totalLevels,
                totalPages: Math.ceil(totalLevels / pageSize),
                levels,
            });
        } catch (error) {
            functions.logger.error("getLaserPuzzleLevels error:", error);
            res.status(500).json({
                success: false,
                error: "Internal server error.",
            });
        }
    }
);
