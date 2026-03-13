import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * getGameList
 *
 * HTTP GET endpoint — returns all games with their leaderboard coefficients.
 * Sorted by coefficient ascending (lowest first).
 *
 * GET /getGameList
 *
 * Returns:
 *  { success, games: [{ id, name, coefficient }] }
 */
export const getGameList = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const db = admin.firestore();
        const snapshot = await db.collection("games").orderBy("leaderboardCoefficient", "asc").get();

        const games = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || doc.id,
                coefficient: data.leaderboardCoefficient || 1.0,
            };
        });

        res.status(200).json({ success: true, games });
    } catch (error) {
        functions.logger.error("getGameList failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
