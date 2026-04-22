import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * getPlayerLeaderboard
 *
 * HTTP GET endpoint — returns ranked player list.
 *
 * GET /getPlayerLeaderboard?type=global&limit=50
 * GET /getPlayerLeaderboard?type=game&gameId=neuralLink&limit=50
 *
 * Returns:
 *   { success: true, leaderboard: [{ rank, deviceId, nickname, totalScore }] }
 */

const VALID_GAME_IDS = [
    "pipeConnect",
    "laserPuzzle",
    "binaryPuzzle",
    "pixelExcavation",
    "slitherlink",
    "blockFit",
    "cryptoCage",
    "neuralLink",
];

export const getPlayerLeaderboard = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const type = (req.query.type as string) || "global";
        const gameId = req.query.gameId as string | undefined;
        const queryLimit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);

        const db = admin.firestore();

        if (type === "global") {
            // ── Global leaderboard: top players by total score ──
            const snapshot = await db
                .collection("playerScores")
                .orderBy("totalScore", "desc")
                .limit(queryLimit)
                .get();

            const leaderboard = snapshot.docs.map((doc, index) => ({
                rank: index + 1,
                deviceId: doc.id,
                nickname: doc.data().nickname || "Unknown",
                totalScore: doc.data().totalScore || 0,
            }));

            res.status(200).json({ success: true, type: "global", leaderboard });
            return;
        }

        if (type === "game") {
            // ── Per-game leaderboard ──
            if (!gameId || !VALID_GAME_IDS.includes(gameId)) {
                res.status(400).json({
                    success: false,
                    error: `gameId is required for game leaderboard. Valid IDs: ${VALID_GAME_IDS.join(", ")}`,
                });
                return;
            }

            // Use collectionGroup query on "games" subcollection
            const snapshot = await db
                .collectionGroup("games")
                .where("gameId", "==", gameId)
                .orderBy("totalScore", "desc")
                .limit(queryLimit)
                .get();

            // For each game doc, get the parent deviceId and nickname
            const leaderboard = await Promise.all(
                snapshot.docs.map(async (doc, index) => {
                    const deviceId = doc.ref.parent.parent?.id || "unknown";

                    // Fetch nickname from parent playerScores doc
                    let nickname = "Unknown";
                    try {
                        const playerDoc = await db
                            .collection("playerScores")
                            .doc(deviceId)
                            .get();
                        if (playerDoc.exists) {
                            nickname = playerDoc.data()?.nickname || "Unknown";
                        }
                    } catch (_e) {
                        // ignore
                    }

                    return {
                        rank: index + 1,
                        deviceId,
                        nickname,
                        totalScore: doc.data().totalScore || 0,
                        gamesPlayed: doc.data().gamesPlayed || 0,
                        bestScore: doc.data().bestScore || 0,
                    };
                })
            );

            res.status(200).json({ success: true, type: "game", gameId, leaderboard });
            return;
        }

        res.status(400).json({
            success: false,
            error: "Invalid type. Use 'global' or 'game'.",
        });
    } catch (error) {
        functions.logger.error("getPlayerLeaderboard failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
