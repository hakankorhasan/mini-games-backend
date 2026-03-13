import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * getLeaderboard
 *
 * HTTP GET endpoint — returns top players for global, country, or season leaderboards.
 * No authentication required.
 *
 * GET /getLeaderboard?type=global&limit=100
 * GET /getLeaderboard?type=country&country=TR&limit=50
 * GET /getLeaderboard?type=season&limit=100
 *
 * Returns:
 *  { success, players: Array<{ uid, username, rating, tier, country, rank }> }
 */
export const getLeaderboard = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const type = (req.query.type as string) || "global";
        const country = req.query.country as string | undefined;
        const queryLimit = Math.min(
            parseInt(req.query.limit as string, 10) || 100,
            200
        );

        const db = admin.firestore();
        let query: admin.firestore.Query = db.collection("users");

        switch (type) {
            case "global":
                query = query.orderBy("rating", "desc").limit(queryLimit);
                break;

            case "country":
                if (!country) {
                    res.status(400).json({
                        success: false,
                        error: "Country is required for country leaderboard.",
                    });
                    return;
                }
                query = query
                    .where("country", "==", country)
                    .orderBy("rating", "desc")
                    .limit(queryLimit);
                break;

            case "season":
                query = query.orderBy("seasonRating", "desc").limit(queryLimit);
                break;

            default:
                res.status(400).json({
                    success: false,
                    error: `Invalid leaderboard type: ${type}`,
                });
                return;
        }

        const snapshot = await query.get();

        const players = snapshot.docs.map((doc, index) => ({
            uid: doc.id,
            username: doc.data().username || "Unknown",
            rating: type === "season" ? doc.data().seasonRating : doc.data().rating,
            tier: doc.data().tier || "Bronze",
            country: doc.data().country || "",
            rank: index + 1,
        }));

        res.status(200).json({ success: true, players });
    } catch (error) {
        functions.logger.error("getLeaderboard failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
