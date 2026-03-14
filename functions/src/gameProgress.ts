import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * saveGameProgress
 *
 * HTTP POST endpoint — saves user's game level progress.
 *
 * POST /saveGameProgress
 * Body: { deviceId, gameId, currentLevel, completedLevels }
 *
 * Firestore path: gameProgress/{deviceId}/games/{gameId}
 *   - currentLevel: number (the level the player should start from)
 *   - completedLevels: number[] (all completed level numbers)
 *   - updatedAt: timestamp
 */
export const saveGameProgress = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({
            success: false,
            error: "Method not allowed. Use POST.",
        });
        return;
    }

    try {
        const { deviceId, gameId, currentLevel, completedLevels } = req.body;

        // Validate deviceId
        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({
                success: false,
                error: "deviceId is required.",
            });
            return;
        }

        // Validate gameId
        if (!gameId || typeof gameId !== "string") {
            res.status(400).json({
                success: false,
                error: "gameId is required.",
            });
            return;
        }

        // Validate currentLevel
        if (
            typeof currentLevel !== "number" ||
            currentLevel < 1 ||
            !Number.isInteger(currentLevel)
        ) {
            res.status(400).json({
                success: false,
                error: "currentLevel must be a positive integer.",
            });
            return;
        }

        // Validate completedLevels (optional — default to [])
        let levels: number[] = [];
        if (completedLevels !== undefined) {
            if (
                !Array.isArray(completedLevels) ||
                !completedLevels.every(
                    (l: unknown) =>
                        typeof l === "number" &&
                        Number.isInteger(l) &&
                        (l as number) >= 1
                )
            ) {
                res.status(400).json({
                    success: false,
                    error:
                        "completedLevels must be an array of positive integers.",
                });
                return;
            }
            levels = completedLevels;
        }

        const db = admin.firestore();
        const progressRef = db
            .collection("gameProgress")
            .doc(deviceId)
            .collection("games")
            .doc(gameId);

        await progressRef.set(
            {
                gameId,
                currentLevel,
                completedLevels: levels,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        functions.logger.info(
            `Game progress saved: device=${deviceId} game=${gameId} currentLevel=${currentLevel} completed=[${levels.join(",")}]`
        );

        res.status(200).json({
            success: true,
            progress: {
                gameId,
                currentLevel,
                completedLevels: levels,
            },
        });
    } catch (error) {
        functions.logger.error("saveGameProgress failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

/**
 * getGameProgress
 *
 * HTTP GET endpoint — retrieves user's game level progress.
 *
 * GET /getGameProgress?deviceId=xxx&gameId=yyy   → single game progress
 * GET /getGameProgress?deviceId=xxx              → all games progress
 *
 * Returns:
 *   Single: { success, progress: { gameId, currentLevel, completedLevels } }
 *   All:    { success, progress: [ { gameId, currentLevel, completedLevels }, ... ] }
 */
export const getGameProgress = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({
            success: false,
            error: "Method not allowed. Use GET.",
        });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;
        const gameId = req.query.gameId as string | undefined;

        if (!deviceId) {
            res.status(400).json({
                success: false,
                error: "deviceId query parameter is required.",
            });
            return;
        }

        const db = admin.firestore();
        const gamesRef = db
            .collection("gameProgress")
            .doc(deviceId)
            .collection("games");

        // Single game progress
        if (gameId) {
            const doc = await gamesRef.doc(gameId).get();

            if (!doc.exists) {
                res.status(200).json({
                    success: true,
                    progress: {
                        gameId,
                        currentLevel: 1,
                        completedLevels: [],
                    },
                });
                return;
            }

            const data = doc.data()!;
            res.status(200).json({
                success: true,
                progress: {
                    gameId: data.gameId || gameId,
                    currentLevel: data.currentLevel || 1,
                    completedLevels: data.completedLevels || [],
                },
            });
            return;
        }

        // All games progress
        const snapshot = await gamesRef.get();

        if (snapshot.empty) {
            res.status(200).json({ success: true, progress: [] });
            return;
        }

        const progressList = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                gameId: data.gameId || doc.id,
                currentLevel: data.currentLevel || 1,
                completedLevels: data.completedLevels || [],
            };
        });

        res.status(200).json({ success: true, progress: progressList });
    } catch (error) {
        functions.logger.error("getGameProgress failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
