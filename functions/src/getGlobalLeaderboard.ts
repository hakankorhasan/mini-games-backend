import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getTierByRank } from "./utils/tiers";

/**
 * getGlobalLeaderboard
 *
 * HTTP GET endpoint — returns top players ranked by weightedGlobalScore.
 * weightedGlobalScore = cumulative Σ(scoreGained × coefficient).
 * Tier is determined by rank, not rating.
 * Optionally returns the calling player's own rank and score via deviceId.
 *
 * GET /getGlobalLeaderboard?limit=100
 * GET /getGlobalLeaderboard?limit=100&deviceId=ABCD-1234
 *
 * Returns:
 *  { success, players: [...], myRank, myScore, myTier }
 */
export const getGlobalLeaderboard = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string | undefined;
        const resultLimit = Math.min(
            parseInt(req.query.limit as string, 10) || 100,
            200
        );

        const db = admin.firestore();

        // Fetch top players by weightedGlobalScore
        const snapshot = await db
            .collection("users")
            .orderBy("weightedGlobalScore", "desc")
            .limit(resultLimit)
            .get();

        const players = snapshot.docs.map((doc, index) => {
            const rank = index + 1;
            return {
                uid: doc.id,
                username: doc.data().username || "Unknown",
                weightedGlobalScore: doc.data().weightedGlobalScore || 0,
                globalScore: doc.data().globalScore || 0,
                tier: getTierByRank(rank),
                gamesPlayed: doc.data().gamesPlayed || 0,
                bestStreak: doc.data().bestStreak || 0,
                rank,
            };
        });

        // Find calling player's rank (if deviceId provided)
        let myRank = -1;
        let myScore = 0;

        if (deviceId) {
            // Check if player is in the fetched results
            const myIndex = players.findIndex((p) => p.uid === deviceId);
            if (myIndex !== -1) {
                myRank = myIndex + 1;
                myScore = players[myIndex].weightedGlobalScore;
            } else {
                // Player not in top N — calculate their rank
                const userDoc = await db.collection("users").doc(deviceId).get();
                if (userDoc.exists) {
                    myScore = userDoc.data()?.weightedGlobalScore || 0;

                    // Count how many users have a higher weightedGlobalScore
                    const higherCount = await db
                        .collection("users")
                        .where("weightedGlobalScore", ">", myScore)
                        .count()
                        .get();

                    myRank = (higherCount.data().count || 0) + 1;
                }
            }
        }

        const myTier = myRank > 0 ? getTierByRank(myRank) : "Bronze";
        res.status(200).json({ success: true, players, myRank, myScore, myTier });
    } catch (error) {
        functions.logger.error("getGlobalLeaderboard failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
