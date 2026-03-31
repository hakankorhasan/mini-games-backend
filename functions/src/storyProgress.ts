import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * saveStoryProgress
 *
 * HTTP POST endpoint — saves user's story progress using device-id.
 *
 * POST /saveStoryProgress
 * Body: { deviceId, storyId, levelOrder, eventOrder, completed }
 *
 * Firestore path: storyProgress/{deviceId}/stories/{storyId}
 */
export const saveStoryProgress = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { deviceId, storyId, levelOrder, eventOrder, completed } = req.body;

        // Validate input
        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }
        if (!storyId || typeof storyId !== "string") {
            res.status(400).json({ success: false, error: "storyId is required." });
            return;
        }
        if (typeof levelOrder !== "number" || levelOrder < 1) {
            res.status(400).json({ success: false, error: "levelOrder must be a positive number." });
            return;
        }
        if (typeof eventOrder !== "number" || eventOrder < 1) {
            res.status(400).json({ success: false, error: "eventOrder must be a positive number." });
            return;
        }

        const db = admin.firestore();

        // ── Premium check: Level 2+ requires storyMode or ultimateBundle ──
        // We allow levelOrder === 2 && eventOrder === 1 because it represents the completion of Level 1.
        // Anything beyond that (level 2 event 2, or level 3+) requires premium.
        const isTransitionToLevel2 = (levelOrder === 2 && eventOrder === 1);
        if (levelOrder > 2 || (levelOrder === 2 && !isTransitionToLevel2)) {
            const userDoc = await db.collection("users").doc(deviceId).get();
            const premium = userDoc.data()?.premium || {};

            if (!premium.storyMode && !premium.ultimateBundle) {
                res.status(403).json({
                    success: false,
                    error: "purchase_required",
                    message: "Story Mode Pack required for Level 2+",
                });
                return;
            }
        }

        const progressRef = db
            .collection("storyProgress")
            .doc(deviceId)
            .collection("stories")
            .doc(storyId);

        const progressData = {
            storyId,
            levelOrder,
            eventOrder,
            completed: completed || false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await progressRef.set(progressData, { merge: true });

        functions.logger.info(
            `Progress saved: device=${deviceId} story=${storyId} level=${levelOrder} event=${eventOrder} completed=${completed}`
        );

        res.status(200).json({ success: true, progress: progressData });
    } catch (error) {
        functions.logger.error("saveStoryProgress failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

/**
 * getStoryProgress
 *
 * HTTP GET endpoint — retrieves user's story progress.
 *
 * GET /getStoryProgress?deviceId=xxx              → tüm hikayeler
 * GET /getStoryProgress?deviceId=xxx&storyId=yyy  → tek hikaye
 */
export const getStoryProgress = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;
        const storyId = req.query.storyId as string | undefined;

        if (!deviceId) {
            res.status(400).json({ success: false, error: "deviceId query parameter is required." });
            return;
        }

        const db = admin.firestore();

        // Single story progress
        if (storyId) {
            const doc = await db
                .collection("storyProgress")
                .doc(deviceId)
                .collection("stories")
                .doc(storyId)
                .get();

            if (!doc.exists) {
                res.status(200).json({ success: true, progress: null });
                return;
            }

            res.status(200).json({ success: true, progress: doc.data() });
            return;
        }

        // All stories progress for this device
        const snapshot = await db
            .collection("storyProgress")
            .doc(deviceId)
            .collection("stories")
            .get();

        const progressList = snapshot.docs.map((doc) => doc.data());

        res.status(200).json({ success: true, progress: progressList });
    } catch (error) {
        functions.logger.error("getStoryProgress failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
