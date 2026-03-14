import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

/**
 * seedWordPuzzleLevels
 *
 * HTTP POST endpoint — reads 1000-most-common-words.txt,
 * groups words by length, and uploads them to Firestore as word pools.
 *
 * Firestore path: wordPool/{length}
 *   { length: number, words: string[] }
 *
 * POST /seedWordPuzzleLevels
 */
export const seedWordPuzzleLevels = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use POST.",
            });
            return;
        }

        try {
            // Read the word file
            const filePath = path.join(__dirname, "..", "1000-most-common-words.txt");
            const fileContent = fs.readFileSync(filePath, "utf-8");
            const allWords = fileContent
                .split("\n")
                .map((w) => w.trim().toUpperCase())
                .filter((w) => w.length >= 3 && w.length <= 8 && !w.includes("'"));

            // Group by length
            const wordsByLength: Record<number, string[]> = {};
            for (const word of allWords) {
                const len = word.length;
                if (!wordsByLength[len]) {
                    wordsByLength[len] = [];
                }
                wordsByLength[len].push(word);
            }

            const db = admin.firestore();
            const batch = db.batch();
            let totalWords = 0;

            for (const [length, words] of Object.entries(wordsByLength)) {
                const ref = db.collection("wordPool").doc(`length_${length}`);
                batch.set(ref, {
                    length: parseInt(length, 10),
                    words,
                });
                totalWords += words.length;
            }

            await batch.commit();

            // Build summary
            const summary: Record<string, number> = {};
            for (const [length, words] of Object.entries(wordsByLength)) {
                summary[`${length}-letter`] = words.length;
            }

            functions.logger.info(
                `Word pool seeded: ${totalWords} total words`,
                summary
            );

            res.status(200).json({
                success: true,
                message: `${totalWords} words seeded across ${Object.keys(wordsByLength).length} categories.`,
                breakdown: summary,
            });
        } catch (error) {
            functions.logger.error("seedWordPuzzleLevels failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);
