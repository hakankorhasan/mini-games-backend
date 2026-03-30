import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const STORAGE_BUCKET = "mini-games-9a4e1.firebasestorage.app";

/**
 * getOnboardings
 *
 * HTTP GET — lists all onboarding images from Firebase Storage.
 * iOS calls this to display the onboarding slides in order.
 *
 * GET /getOnboardings
 *
 * Storage path: onboardings/
 * Files should be named with a sortable prefix, e.g:
 *   onboarding_01.png, onboarding_02.png, ...
 *
 * Returns:
 *   {
 *     success: true,
 *     onboardings: [
 *       { id: "onboarding_01", url: "https://..." },
 *       { id: "onboarding_02", url: "https://..." },
 *       ...
 *     ]
 *   }
 */
export const getOnboardings = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const bucket = admin.storage().bucket(STORAGE_BUCKET);

        // List all files under onboardings/ folder
        const [files] = await bucket.getFiles({ prefix: "onboardings/" });

        const onboardings = files
            .filter((file) => {
                const name = file.name.toLowerCase();
                // Accept common image and video formats
                return (
                    name.endsWith(".png") ||
                    name.endsWith(".jpg") ||
                    name.endsWith(".jpeg") ||
                    name.endsWith(".webp") ||
                    name.endsWith(".mp4") ||
                    name.endsWith(".mov")
                );
            })
            .map((file) => {
                const fileName = file.name.split("/").pop() || "";
                // Strip extension to get id: "onboarding_01.png" → "onboarding_01"
                const id = fileName.replace(/\.[^/.]+$/, "");
                return {
                    id,
                    url: `https://storage.googleapis.com/${STORAGE_BUCKET}/${file.name}`,
                };
            })
            // Sort by id so slides are always in correct order
            .sort((a, b) => a.id.localeCompare(b.id));

        functions.logger.info(`Fetched ${onboardings.length} onboarding images from Storage`);

        res.status(200).json({
            success: true,
            onboardings,
        });
    } catch (error) {
        functions.logger.error("getOnboardings failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
