import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * getLeaderboard
 *
 * Returns top players for global, country, or season leaderboards.
 *
 * Input:
 *  { type: "global" | "country" | "season", country?: string, limit?: number }
 *
 * Returns:
 *  { players: Array<{ uid, username, rating, tier, country, rank }> }
 */
export const getLeaderboard = functions.https.onCall(
    async (data: {
        type: "global" | "country" | "season";
        country?: string;
        limit?: number;
    }, context: functions.https.CallableContext) => {
        if (!context.auth?.uid) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required."
            );
        }

        const { type, country, limit: queryLimit } = data;
        const resultLimit = Math.min(queryLimit || 100, 200); // Cap at 200

        const db = admin.firestore();
        let query: admin.firestore.Query = db.collection("users");

        switch (type) {
            case "global":
                query = query.orderBy("rating", "desc").limit(resultLimit);
                break;

            case "country":
                if (!country) {
                    throw new functions.https.HttpsError(
                        "invalid-argument",
                        "Country is required for country leaderboard."
                    );
                }
                query = query
                    .where("country", "==", country)
                    .orderBy("rating", "desc")
                    .limit(resultLimit);
                break;

            case "season":
                query = query.orderBy("seasonRating", "desc").limit(resultLimit);
                break;

            default:
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    `Invalid leaderboard type: ${type}`
                );
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

        return { players };
    }
);
