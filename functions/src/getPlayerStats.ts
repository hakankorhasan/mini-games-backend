import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * getPlayerStats
 *
 * HTTP GET endpoint — returns a player's full stats.
 *
 * GET /getPlayerStats?deviceId=ABCD-1234
 *
 * Returns:
 *   {
 *     success: true,
 *     player: { nickname, totalScore, createdAt, updatedAt },
 *     games: [{ gameId, totalScore, gamesPlayed, bestScore, avgScore }]
 *   }
 */
export const getPlayerStats = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;

        if (!deviceId) {
            res.status(400).json({ success: false, error: "deviceId query parameter is required." });
            return;
        }

        const db = admin.firestore();
        const playerRef = db.collection("playerScores").doc(deviceId);

        // Get player doc
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            res.status(200).json({
                success: true,
                player: null,
                games: [],
            });
            return;
        }

        // Get all game stats
        const gamesSnapshot = await playerRef.collection("games").get();
        const games = gamesSnapshot.docs.map((doc) => doc.data());

        res.status(200).json({
            success: true,
            player: playerDoc.data(),
            games,
        });
    } catch (error) {
        functions.logger.error("getPlayerStats failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
