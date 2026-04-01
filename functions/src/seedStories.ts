import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { allStories } from "./data/storyData";
import { GameStory } from "./types/storyTypes";

/**
 * Resolves image URLs from Firebase Storage for a given story.
 * Looks for files matching patterns like:
 *   story_assets/{storyId}/cover.*
 *   story_assets/{storyId}/level_1_artifact.*
 *   story_assets/{storyId}/level_1_event_2_artifact.*  etc.
 *
 * Any file in the folder with "cover" in its name → coverImageURL
 * Any file with "level_X" → artifactImageURL for that level's first event
 * Any file with "level_X_event_Y" → artifactImageURL for that level's Y-th event
 */
// Storage folder name mapping (in case folder names differ from story IDs)
const storageFolderMap: Record<string, string> = {};

async function resolveImageURLs(story: GameStory): Promise<GameStory> {
    const bucket = admin.storage().bucket();
    const folderName = storageFolderMap[story.id] || story.id;
    const prefix = `story_assets/${folderName}/`;

    const [files] = await bucket.getFiles({ prefix });

    // Clone the story so we don't mutate the original
    const resolved: GameStory = JSON.parse(JSON.stringify(story));

    for (const file of files) {
        // Skip "folders" (files ending with /)
        if (file.name.endsWith("/")) continue;

        const fileName = file.name.replace(prefix, "").toLowerCase();

        // Make file publicly accessible and get URL
        try {
            await file.makePublic();
        } catch (_e) {
            // May already be public
        }
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

        // Check if it's a cover image
        if (fileName.includes("cover")) {
            resolved.coverImageURL = publicUrl;
            continue;
        }

        // Check if it matches a level artifact (and optionally an event)
        for (let i = 0; i < resolved.levels.length; i++) {
            const levelOrder = resolved.levels[i].order;
            const levelPatterns = [
                `level_${levelOrder}`,
                `level${levelOrder}`,
                `level ${levelOrder}`,
            ];

            const matchesLevel = levelPatterns.some(p => fileName.includes(p)) ||
                fileName.startsWith(`${levelOrder}_`) ||
                fileName.startsWith(`${levelOrder}.`);

            if (matchesLevel) {
                // Check if it targets a specific event: level_1_event_2
                const eventMatch = fileName.match(/event[_\s]?(\d+)/);
                if (eventMatch) {
                    const eventOrder = parseInt(eventMatch[1], 10);
                    const eventIdx = resolved.levels[i].events.findIndex(
                        e => e.order === eventOrder
                    );
                    if (eventIdx >= 0) {
                        resolved.levels[i].events[eventIdx].artifactImageURL = publicUrl;
                    }
                } else {
                    // Default: assign to first event of this level
                    if (resolved.levels[i].events.length > 0) {
                        resolved.levels[i].events[0].artifactImageURL = publicUrl;
                    }
                }
                break;
            }
        }
    }

    return resolved;
}

/**
 * seedStories
 *
 * HTTP endpoint that:
 * 1. Reads story data from code
 * 2. Auto-discovers images from Firebase Storage (story_assets/{storyId}/...)
 * 3. Attaches image URLs to the story data
 * 4. Batch-writes everything to Firestore
 * 5. Returns the full story data with resolved URLs
 */
export const seedStories = functions.https.onRequest(async (_req, res) => {
    try {
        const db = admin.firestore();
        const batch = db.batch();

        // Resolve image URLs for each story
        const resolvedStories: GameStory[] = [];
        for (const story of allStories) {
            const resolved = await resolveImageURLs(story);
            resolvedStories.push(resolved);
        }

        // Write individual stories to Firestore
        for (const story of resolvedStories) {
            const ref = db.collection("gameStories").doc(story.id);
            batch.set(ref, story);
        }

        // Fetch global story sliders
        const bucket = admin.storage().bucket();
        const prefix = "story_sliders/";
        const [sliderFiles] = await bucket.getFiles({ prefix });
        
        // Sort files by name so slider_1, slider_2 are in predictable order
        sliderFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        const sliderMedia: { id: string, type: string, url: string, badge: string, order: number }[] = [];
        let index = 1;

        for (const file of sliderFiles) {
            if (file.name.endsWith("/")) continue; // skip folders

            try { await file.makePublic(); } catch (_e) {}
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
            const isVideo = file.name.match(/\.(mp4|mov|avi|webm|mkv)$/i);
            const type = isVideo ? "video" : "image";
            
            const fileName = file.name.split("/").pop() || file.name;
            const docId = fileName.split(".")[0] || `slider_${index}`;

            let badge = "";
            if (fileName.includes("slider_1")) {
                badge = "popular";
            } else if (fileName.includes("slider_4")) {
                badge = "new";
            }
            
            // Try to extract an order number from the filename
            const matchIndex = fileName.match(/\d+/);
            const orderNum = matchIndex ? parseInt(matchIndex[0], 10) : index;

            sliderMedia.push({ id: docId, type, url: publicUrl, badge, order: orderNum });
            index++;
        }
        
        // Write the global story sliders to a 'storySliders' collection
        for (const slider of sliderMedia) {
            const sliderRef = db.collection("storySliders").doc(slider.id);
            batch.set(sliderRef, slider);
        }

        await batch.commit();

        res.status(200).json({
            success: true,
            stories: resolvedStories,
            globalSliders: sliderMedia
        });
    } catch (error) {
        functions.logger.error("seedStories failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
