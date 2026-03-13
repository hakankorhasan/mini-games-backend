import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getCoefficient } from "./utils/gameCoefficients";

/**
 * getPlayerGameScores
 *
 * HTTP GET endpoint — returns a player's per-game score breakdown
 * with coefficient-weighted contributions to the global leaderboard.
 *
 * GET /getPlayerGameScores?deviceId=ABCD-1234
 *
 * Returns:
 *  {
 *    success, deviceId, username, weightedGlobalScore,
 *    games: [{ gameId, gameName, bestScore, coefficient, weightedScore, gamesPlayed, avgScore, lastPlayedAt }]
 *  }
 */
export const getPlayerGameScores = functions.https.onRequest(async (req, res) => {
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

        // Get user doc
        const userDoc = await db.collection("users").doc(deviceId).get();

        if (!userDoc.exists) {
            res.status(200).json({
                success: true,
                deviceId,
                username: "Unknown",
                weightedGlobalScore: 0,
                games: [],
            });
            return;
        }

        const userData = userDoc.data()!;
        const username = userData.username || "Unknown";
        const weightedGlobalScore = userData.weightedGlobalScore || 0;

        // Get all gameStats subcollection docs
        const gameStatsSnapshot = await db
            .collection("users")
            .doc(deviceId)
            .collection("gameStats")
            .get();

        // Get game names from games collection
        const gamesSnapshot = await db.collection("games").get();
        const gameNames: Record<string, string> = {};
        gamesSnapshot.docs.forEach((doc) => {
            gameNames[doc.id] = doc.data().name || doc.id;
        });

        const games = gameStatsSnapshot.docs.map((doc) => {
            const data = doc.data();
            const gameId = doc.id;
            const coefficient = getCoefficient(gameId);
            const bestScore = data.bestScore || 0;

            return {
                gameId,
                gameName: gameNames[gameId] || gameId,
                bestScore,
                coefficient,
                weightedScore: Math.round(bestScore * coefficient),
                gamesPlayed: data.gamesPlayed || 0,
                avgScore: data.avgScore || 0,
                lastPlayedAt: data.lastPlayedAt || null,
            };
        });

        // Sort by weightedScore descending
        games.sort((a, b) => b.weightedScore - a.weightedScore);

        res.status(200).json({
            success: true,
            deviceId,
            username,
            weightedGlobalScore,
            games,
        });
    } catch (error) {
        functions.logger.error("getPlayerGameScores failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
