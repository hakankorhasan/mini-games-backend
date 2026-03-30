import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const STORAGE_BUCKET = "mini-games-9a4e1.firebasestorage.app";

function getAvatarUrl(avatarId: string | undefined | null): string | null {
    if (!avatarId) return null;
    return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/avatars%2F${avatarId}.png?alt=media`;
}

/**
 * getGameLeaderboard
 *
 * HTTP GET endpoint — returns top players for a specific game,
 * ranked by bestScore within that game's gameStats subcollection.
 *
 * GET /getGameLeaderboard?gameId=laserPuzzle&limit=50
 * GET /getGameLeaderboard?gameId=laserPuzzle&limit=50&deviceId=ABCD-1234
 *
 * Returns:
 *  {
 *    success, gameId, coefficient,
 *    leaderboard: [{ rank, deviceId, username, bestScore, weightedScore, gamesPlayed }],
 *    myRank, myBestScore
 *  }
 */
export const getGameLeaderboard = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const gameId = req.query.gameId as string;
        const deviceId = req.query.deviceId as string | undefined;
        const resultLimit = Math.min(
            parseInt(req.query.limit as string, 10) || 50,
            200
        );

        if (!gameId || typeof gameId !== "string") {
            res.status(400).json({ success: false, error: "gameId query parameter is required." });
            return;
        }

        const db = admin.firestore();

        // Fetch game doc to get coefficient
        const gameDoc = await db.collection("games").doc(gameId).get();
        const coefficient = gameDoc.exists
            ? (gameDoc.data()?.leaderboardCoefficient || 1.0)
            : 1.0;

        // CollectionGroup query on "gameStats" subcollection
        const snapshot = await db
            .collectionGroup("gameStats")
            .where("gameId", "==", gameId)
            .orderBy("bestScore", "desc")
            .limit(resultLimit)
            .get();

        // Build leaderboard with parent user info
        const leaderboard = await Promise.all(
            snapshot.docs.map(async (doc, index) => {
                const data = doc.data();
                const parentDeviceId = doc.ref.parent.parent?.id || "unknown";

                // Fetch nickname and avatar from parent user doc
                let nickname = "Unknown";
                let avatarUrl: string | null = null;
                try {
                    const userDoc = await db.collection("users").doc(parentDeviceId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        nickname = userData?.nickname || userData?.username || "Unknown";
                        avatarUrl = getAvatarUrl(userData?.avatarId) || userData?.avatarUrl || null;
                    }
                } catch (_e) {
                    // ignore
                }

                return {
                    rank: index + 1,
                    deviceId: parentDeviceId,
                    nickname,
                    avatarUrl,
                    bestScore: data.bestScore || 0,
                    weightedScore: Math.round((data.bestScore || 0) * coefficient),
                    gamesPlayed: data.gamesPlayed || 0,
                };
            })
        );

        // Find calling player's rank
        let myRank = -1;
        let myBestScore = 0;

        if (deviceId) {
            const myIndex = leaderboard.findIndex((p) => p.deviceId === deviceId);
            if (myIndex !== -1) {
                myRank = myIndex + 1;
                myBestScore = leaderboard[myIndex].bestScore;
            } else {
                // Player not in top N — check their gameStats
                const myGameStatDoc = await db
                    .collection("users")
                    .doc(deviceId)
                    .collection("gameStats")
                    .doc(gameId)
                    .get();

                if (myGameStatDoc.exists) {
                    myBestScore = myGameStatDoc.data()?.bestScore || 0;

                    // Count how many players have higher bestScore for this game
                    const higherCount = await db
                        .collectionGroup("gameStats")
                        .where("gameId", "==", gameId)
                        .where("bestScore", ">", myBestScore)
                        .count()
                        .get();

                    myRank = (higherCount.data().count || 0) + 1;
                }
            }
        }

        res.status(200).json({
            success: true,
            gameId,
            coefficient,
            leaderboard,
            myRank,
            myBestScore,
        });
    } catch (error) {
        functions.logger.error("getGameLeaderboard failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
