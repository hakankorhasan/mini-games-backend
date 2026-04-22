import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * submitScore
 *
 * HTTP POST endpoint — saves a player's game score using device-id.
 *
 * POST /submitScore
 * Body: { deviceId, nickname, gameId, score, difficulty?, timeSpent? }
 *
 * Firestore paths:
 *   playerScores/{deviceId}               → overall stats
 *   playerScores/{deviceId}/games/{gameId} → per-game stats
 */

const VALID_GAME_IDS = [
    "pipeConnect",
    "laserPuzzle",
    "binaryPuzzle",
    "pixelExcavation",
    "slitherlink",
    "blockFit",
    "cryptoCage",
    "neuralLink",
    "numberCircuit",
    "tiltMaze",
];

export const submitScore = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { deviceId, nickname, gameId, score, difficulty, timeSpent } = req.body;

        // ── Validation ──
        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }
        if (!gameId || typeof gameId !== "string" || !VALID_GAME_IDS.includes(gameId)) {
            res.status(400).json({
                success: false,
                error: `Invalid gameId. Valid IDs: ${VALID_GAME_IDS.join(", ")}`,
            });
            return;
        }
        if (typeof score !== "number" || score < 0) {
            res.status(400).json({ success: false, error: "score must be a non-negative number." });
            return;
        }

        const playerNickname = (nickname && typeof nickname === "string")
            ? nickname.trim().substring(0, 20)
            : `Player_${deviceId.substring(0, 6)}`;

        const db = admin.firestore();
        const playerRef = db.collection("playerScores").doc(deviceId);
        const gameRef = playerRef.collection("games").doc(gameId);

        // ── Transaction: read → calculate → write ──
        const result = await db.runTransaction(async (transaction) => {
            const playerDoc = await transaction.get(playerRef);
            const gameDoc = await transaction.get(gameRef);

            // --- Per-game stats ---
            let newGameTotal: number;
            let newGamesPlayed: number;
            let newBestScore: number;
            let newAvgScore: number;

            if (gameDoc.exists) {
                const gd = gameDoc.data()!;
                newGameTotal = (gd.totalScore || 0) + score;
                newGamesPlayed = (gd.gamesPlayed || 0) + 1;
                newBestScore = Math.max(gd.bestScore || 0, score);
                newAvgScore = Math.round((newGameTotal / newGamesPlayed) * 100) / 100;

                transaction.update(gameRef, {
                    totalScore: newGameTotal,
                    gamesPlayed: newGamesPlayed,
                    bestScore: newBestScore,
                    avgScore: newAvgScore,
                    lastScore: score,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                newGameTotal = score;
                newGamesPlayed = 1;
                newBestScore = score;
                newAvgScore = score;

                transaction.set(gameRef, {
                    gameId,
                    totalScore: score,
                    gamesPlayed: 1,
                    bestScore: score,
                    avgScore: score,
                    lastScore: score,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            // --- Overall player stats ---
            const oldTotalScore = playerDoc.exists ? (playerDoc.data()!.totalScore || 0) : 0;
            const newTotalScore = oldTotalScore + score;

            if (playerDoc.exists) {
                transaction.update(playerRef, {
                    nickname: playerNickname,
                    totalScore: newTotalScore,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                transaction.set(playerRef, {
                    nickname: playerNickname,
                    totalScore: newTotalScore,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            return {
                totalScore: newTotalScore,
                gameStats: {
                    gameId,
                    totalScore: newGameTotal,
                    gamesPlayed: newGamesPlayed,
                    bestScore: newBestScore,
                    avgScore: newAvgScore,
                    lastScore: score,
                },
            };
        });

        // ── Log (outside transaction) ──
        await db.collection("scoreHistory").add({
            deviceId,
            gameId,
            score,
            difficulty: difficulty || null,
            timeSpent: timeSpent || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info(
            `Score submitted: device=${deviceId} game=${gameId} score=${score} total=${result.totalScore}`
        );

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        functions.logger.error("submitScore failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
