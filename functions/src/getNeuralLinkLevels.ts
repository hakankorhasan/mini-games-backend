import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { TOTAL_NEURAL_LINK_LEVELS } from "./utils/neuralLinkGenerator";

/**
 * getNeuralLinkLevels
 *
 * GET /getNeuralLinkLevels?level=5       → full level data
 * GET /getNeuralLinkLevels?page=1&pageSize=20 → lightweight list
 */
export const getNeuralLinkLevels = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "GET") {
            res.status(405).json({ success: false, error: "Use GET." });
            return;
        }

        try {
            const db = admin.firestore();
            const levelParam = req.query.level;

            // ── Single level ──
            if (levelParam) {
                const levelNumber = parseInt(String(levelParam), 10);
                if (isNaN(levelNumber) || levelNumber < 1) {
                    res.status(400).json({ success: false, error: "level must be a positive integer." });
                    return;
                }

                const doc = await db
                    .collection("neuralLinkLevels")
                    .doc(`level_${levelNumber}`)
                    .get();

                if (!doc.exists) {
                    res.status(404).json({ success: false, error: `Level ${levelNumber} not found.` });
                    return;
                }

                const rawData = doc.data()!;
                const level = {
                    levelNumber: rawData.levelNumber,
                    gridSize: rawData.gridSize,
                    flowCount: rawData.flowCount,
                    deadNeuronCount: rawData.deadNeuronCount,
                    difficulty: rawData.difficulty,
                    difficultyValue: rawData.difficultyValue,
                    endpoints: JSON.parse(rawData.endpointsJson),
                    deadCells: JSON.parse(rawData.deadCellsJson),
                    solution: JSON.parse(rawData.solutionJson),
                };

                res.status(200).json({ success: true, level });
                return;
            }

            // ── Level list ──
            const page = parseInt(String(req.query.page || "1"), 10);
            const pageSize = parseInt(String(req.query.pageSize || "20"), 10);
            const offset = (page - 1) * pageSize;

            const snapshot = await db
                .collection("neuralLinkLevels")
                .orderBy("levelNumber", "asc")
                .offset(offset)
                .limit(pageSize)
                .select("levelNumber", "gridSize", "flowCount", "deadNeuronCount", "difficulty", "difficultyValue")
                .get();

            const levels = snapshot.docs.map((doc) => doc.data());

            res.status(200).json({
                success: true,
                page,
                pageSize,
                totalLevels: TOTAL_NEURAL_LINK_LEVELS,
                totalPages: Math.ceil(TOTAL_NEURAL_LINK_LEVELS / pageSize),
                levels,
            });
        } catch (error) {
            functions.logger.error("getNeuralLinkLevels error:", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);
