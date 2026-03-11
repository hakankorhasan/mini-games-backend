import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateDailyChallenge } from "./utils/numberCircuit";

/**
 * getDailyChallenge
 *
 * HTTP GET endpoint — returns today's Number Circuit daily puzzle.
 * All players get the same puzzle for a given date.
 *
 * GET /getDailyChallenge?date=2026-03-11
 *
 * If no date param is given, defaults to today (UTC).
 * The generated puzzle is cached in Firestore for consistency.
 */
export const getDailyChallenge = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        // Determine the date
        const dateParam = req.query.date as string | undefined;
        const dateString = dateParam || new Date().toISOString().split("T")[0];

        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            res.status(400).json({
                success: false,
                error: "Invalid date format. Use YYYY-MM-DD.",
            });
            return;
        }

        const db = admin.firestore();
        const docRef = db.collection("numberCircuitDaily").doc(dateString);

        // Check if we already generated this day's puzzle
        const existing = await docRef.get();
        if (existing.exists) {
            const data = existing.data()!;
            res.status(200).json({
                success: true,
                date: dateString,
                level: data.level,
            });
            return;
        }

        // Generate and cache
        const level = generateDailyChallenge(dateString);

        await docRef.set({
            date: dateString,
            level,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info(`Daily challenge generated for ${dateString}`);

        res.status(200).json({
            success: true,
            date: dateString,
            level,
        });
    } catch (error) {
        functions.logger.error("getDailyChallenge failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
