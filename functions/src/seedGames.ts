import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { allGames } from "./data/gameData";

/**
 * seedGames
 *
 * HTTP endpoint that batch-writes all game documents into
 * the `games` Firestore collection.
 *
 * URL:  https://<region>-<project>.cloudfunctions.net/seedGames
 * Method: GET or POST
 *
 * Subsequent calls will overwrite existing documents (idempotent).
 */
export const seedGames = functions.https.onRequest(async (_req, res) => {
    try {
        const db = admin.firestore();
        const batch = db.batch();

        for (const game of allGames) {
            const ref = db.collection("games").doc(game.id);
            batch.set(ref, game);
        }

        await batch.commit();

        res.status(200).json({
            success: true,
            games: allGames,
        });
    } catch (error) {
        functions.logger.error("seedGames failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
