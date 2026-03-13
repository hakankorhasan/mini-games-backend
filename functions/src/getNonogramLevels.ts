import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Convert Firestore-safe format back to client-friendly nested arrays.
 * Firestore stores:
 *   - solution as flat boolean[] → reconstruct to boolean[][] using gridSize
 *   - rowClues/colClues as Record<string, number[]> → reconstruct to number[][]
 */
function fromFirestoreFormat(data: FirebaseFirestore.DocumentData): Record<string, unknown> {
    const gridSize = data.gridSize as number;

    // Reconstruct solution: flat boolean[] → boolean[][]
    const flatSolution = data.solution as boolean[];
    const solution: boolean[][] = [];
    for (let r = 0; r < gridSize; r++) {
        solution.push(flatSolution.slice(r * gridSize, (r + 1) * gridSize));
    }

    // Reconstruct clues: map → array (ordered by key)
    const rowCluesMap = data.rowClues as Record<string, number[]>;
    const rowClues: number[][] = [];
    for (let i = 0; i < gridSize; i++) {
        rowClues.push(rowCluesMap[String(i)]);
    }

    const colCluesMap = data.colClues as Record<string, number[]>;
    const colClues: number[][] = [];
    for (let i = 0; i < gridSize; i++) {
        colClues.push(colCluesMap[String(i)]);
    }

    return {
        levelNumber: data.levelNumber,
        gridSize,
        fillFraction: data.fillFraction,
        solution,
        rowClues,
        colClues,
    };
}

/**
 * getNonogramLevels
 *
 * HTTP GET endpoint — returns Nonogram level data.
 *
 * Two modes:
 *
 * 1. Level list (for level selection screen):
 *    GET /getNonogramLevels?page=1&pageSize=20
 *    → Returns lightweight list (levelNumber, gridSize) WITHOUT solutions
 *
 * 2. Single level (for gameplay):
 *    GET /getNonogramLevels?level=5
 *    → Returns full level data WITH solution, rowClues, colClues
 */
export const getNonogramLevels = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({
            success: false,
            error: "Method not allowed. Use GET.",
        });
        return;
    }

    try {
        const db = admin.firestore();
        const levelParam = req.query.level as string | undefined;

        // ── Single level mode ──
        if (levelParam) {
            const levelNumber = parseInt(levelParam, 10);
            if (isNaN(levelNumber) || levelNumber < 1) {
                res.status(400).json({
                    success: false,
                    error: "level must be a positive integer.",
                });
                return;
            }

            const doc = await db
                .collection("nonogramLevels")
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
                level: fromFirestoreFormat(doc.data()!),
            });
            return;
        }

        // ── Level list mode ──
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(
            50,
            Math.max(1, parseInt(req.query.pageSize as string, 10) || 20)
        );

        const snapshot = await db
            .collection("nonogramLevels")
            .orderBy("levelNumber", "asc")
            .offset((page - 1) * pageSize)
            .limit(pageSize)
            .select("levelNumber", "gridSize", "fillFraction")
            .get();

        const levels = snapshot.docs.map((doc) => doc.data());

        // Get total count for pagination info
        const totalSnapshot = await db
            .collection("nonogramLevels")
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
        functions.logger.error("getNonogramLevels failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
