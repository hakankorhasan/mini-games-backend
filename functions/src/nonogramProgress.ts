import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * saveNonogramProgress
 *
 * HTTP POST endpoint — saves user's Nonogram level completion.
 *
 * POST /saveNonogramProgress
 * Body: { deviceId, levelNumber, timeSpent, moveCount }
 *
 * Firestore path: nonogramProgress/{deviceId}
 *   - currentLevel, completedLevels[] stored at document root
 *   - per-level stats stored in subcollection levelStats/level_{N}
 */
export const saveNonogramProgress = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use POST.",
            });
            return;
        }

        try {
            const { deviceId, levelNumber, timeSpent, moveCount } = req.body;

            // Validate input
            if (!deviceId || typeof deviceId !== "string") {
                res.status(400).json({
                    success: false,
                    error: "deviceId is required.",
                });
                return;
            }
            if (
                typeof levelNumber !== "number" ||
                levelNumber < 1 ||
                !Number.isInteger(levelNumber)
            ) {
                res.status(400).json({
                    success: false,
                    error: "levelNumber must be a positive integer.",
                });
                return;
            }
            if (typeof timeSpent !== "number" || timeSpent < 0) {
                res.status(400).json({
                    success: false,
                    error: "timeSpent must be a non-negative number.",
                });
                return;
            }
            if (
                typeof moveCount !== "number" ||
                moveCount < 0 ||
                !Number.isInteger(moveCount)
            ) {
                res.status(400).json({
                    success: false,
                    error: "moveCount must be a non-negative integer.",
                });
                return;
            }

            const db = admin.firestore();
            const progressRef = db
                .collection("nonogramProgress")
                .doc(deviceId);

            // Transaction: update progress atomically
            await db.runTransaction(async (transaction) => {
                const progressDoc = await transaction.get(progressRef);

                let completedLevels: number[] = [];
                if (progressDoc.exists) {
                    completedLevels =
                        progressDoc.data()!.completedLevels || [];
                }

                // Add level to completed if not already there
                if (!completedLevels.includes(levelNumber)) {
                    completedLevels.push(levelNumber);
                    completedLevels.sort((a, b) => a - b);
                }

                // Current level = max completed + 1
                const currentLevel =
                    completedLevels.length > 0
                        ? Math.max(...completedLevels) + 1
                        : 1;

                // Update main progress doc
                transaction.set(
                    progressRef,
                    {
                        currentLevel,
                        completedLevels,
                        updatedAt:
                            admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );

                // Save per-level stats
                const statRef = progressRef
                    .collection("levelStats")
                    .doc(`level_${levelNumber}`);
                transaction.set(statRef, {
                    levelNumber,
                    timeSpent,
                    moveCount,
                    completedAt:
                        admin.firestore.FieldValue.serverTimestamp(),
                });
            });

            functions.logger.info(
                `Nonogram progress saved: device=${deviceId} level=${levelNumber} time=${timeSpent}s moves=${moveCount}`
            );

            res.status(200).json({ success: true });
        } catch (error) {
            functions.logger.error("saveNonogramProgress failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);

/**
 * getNonogramProgress
 *
 * HTTP GET endpoint — retrieves user's Nonogram progress.
 *
 * GET /getNonogramProgress?deviceId=xxx
 * → { currentLevel, completedLevels, levelStats }
 */
export const getNonogramProgress = functions.https.onRequest(
    async (req, res) => {
        if (req.method !== "GET") {
            res.status(405).json({
                success: false,
                error: "Method not allowed. Use GET.",
            });
            return;
        }

        try {
            const deviceId = req.query.deviceId as string;

            if (!deviceId) {
                res.status(400).json({
                    success: false,
                    error: "deviceId query parameter is required.",
                });
                return;
            }

            const db = admin.firestore();
            const progressRef = db
                .collection("nonogramProgress")
                .doc(deviceId);

            const progressDoc = await progressRef.get();

            if (!progressDoc.exists) {
                res.status(200).json({
                    success: true,
                    progress: {
                        currentLevel: 1,
                        completedLevels: [],
                        levelStats: [],
                    },
                });
                return;
            }

            // Fetch level stats subcollection
            const statsSnapshot = await progressRef
                .collection("levelStats")
                .orderBy("levelNumber", "asc")
                .get();

            const levelStats = statsSnapshot.docs.map((doc) => doc.data());

            const data = progressDoc.data()!;

            res.status(200).json({
                success: true,
                progress: {
                    currentLevel: data.currentLevel || 1,
                    completedLevels: data.completedLevels || [],
                    levelStats,
                },
            });
        } catch (error) {
            functions.logger.error("getNonogramProgress failed", error);
            res.status(500).json({ success: false, error: String(error) });
        }
    }
);
