import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Busboy = require("busboy");

/**
 * uploadImage
 *
 * HTTP POST endpoint to upload images to Firebase Storage.
 *
 * URL: https://us-central1-mini-games-9a4e1.cloudfunctions.net/uploadImage
 *
 * Form-data fields:
 *   - file      (required)  The image file
 *   - type      (required)  "game" | "storyCover" | "storyArtifact"
 *   - id        (required)  Game ID or Story ID (e.g. "neuralLink", "nl_story_01")
 *   - level     (optional)  Level number for storyArtifact (e.g. "1", "2")
 *
 * Storage paths:
 *   game         → game_assets/{id}/cover.{ext}
 *   storyCover   → story_assets/{id}/cover.{ext}
 *   storyArtifact→ story_assets/{id}/level_{level}_artifact.{ext}
 *
 * Returns: { success: true, url: "https://..." }
 */
export const uploadImage = functions.https.onRequest(async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    const busboy = Busboy({ headers: req.headers });

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let mimeType = "";

    // Collect text fields
    busboy.on("field", (name: string, val: string) => {
        fields[name] = val;
    });

    // Collect the file
    busboy.on("file", (_fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
        fileName = info.filename;
        mimeType = info.mimeType;

        const chunks: Buffer[] = [];
        file.on("data", (chunk: Buffer) => chunks.push(chunk));
        file.on("end", () => {
            fileBuffer = Buffer.concat(chunks);
        });
    });

    busboy.on("finish", async () => {
        try {
            // Validate required fields
            if (!fileBuffer) {
                res.status(400).json({ success: false, error: "No file uploaded." });
                return;
            }

            const type = fields["type"];
            const id = fields["id"];
            const level = fields["level"];

            if (!type || !id) {
                res.status(400).json({
                    success: false,
                    error: "Missing required fields: 'type' and 'id'.",
                });
                return;
            }

            if (type === "storyArtifact" && !level) {
                res.status(400).json({
                    success: false,
                    error: "Missing 'level' field for storyArtifact type.",
                });
                return;
            }

            // Validate type
            const validTypes = ["game", "storyCover", "storyArtifact"];
            if (!validTypes.includes(type)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid type '${type}'. Must be one of: ${validTypes.join(", ")}`,
                });
                return;
            }

            // Build storage path
            const ext = path.extname(fileName) || ".jpg";
            let storagePath: string;

            switch (type) {
                case "game":
                    storagePath = `game_assets/${id}/cover${ext}`;
                    break;
                case "storyCover":
                    storagePath = `story_assets/${id}/cover${ext}`;
                    break;
                case "storyArtifact":
                    storagePath = `story_assets/${id}/level_${level}_artifact${ext}`;
                    break;
                default:
                    storagePath = `uploads/${id}/${fileName}`;
            }

            // Upload to Firebase Storage
            const bucket = admin.storage().bucket();
            const file = bucket.file(storagePath);

            await file.save(fileBuffer, {
                metadata: {
                    contentType: mimeType,
                },
            });

            // Make the file publicly accessible
            await file.makePublic();

            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

            // Update Firestore document with the URL
            const db = admin.firestore();

            if (type === "game") {
                await db.collection("games").doc(id).update({
                    coverImageURL: publicUrl,
                });
            } else if (type === "storyCover") {
                await db.collection("gameStories").doc(id).update({
                    coverImageURL: publicUrl,
                });
            } else if (type === "storyArtifact" && level) {
                // Update the specific level's artifactImageURL
                const storyDoc = await db.collection("gameStories").doc(id).get();
                if (storyDoc.exists) {
                    const data = storyDoc.data();
                    if (data && data.levels) {
                        const levelIndex = parseInt(level, 10) - 1;
                        if (levelIndex >= 0 && levelIndex < data.levels.length) {
                            data.levels[levelIndex].artifactImageURL = publicUrl;
                            await db.collection("gameStories").doc(id).update({
                                levels: data.levels,
                            });
                        }
                    }
                }
            }

            functions.logger.info(`Image uploaded: ${storagePath}`, { type, id, level });

            res.status(200).json({
                success: true,
                url: publicUrl,
                path: storagePath,
            });
        } catch (error) {
            functions.logger.error("uploadImage failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    });

    // Pipe the request into busboy
    busboy.end(req.rawBody);
});
