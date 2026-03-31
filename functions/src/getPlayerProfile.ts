import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getTierByScore, getTierProgress } from "./utils/tiers";
import { getCoefficient } from "./utils/gameCoefficients";
import { isStreakAlive } from "./utils/streakCalculator";
import { getTodayUTC } from "./utils/dailyPuzzleGenerator";

// ═══════════════════════════════════════════════════════════════
//  getPlayerProfile
//
//  GET /getPlayerProfile?deviceId=XXX
//
//  Single endpoint that returns everything the profile screen needs:
//    • Profile info (nickname, avatar, age)
//    • Aggregated stats (gamesPlayed, winRate, rank, tier …)
//    • Daily challenge streak info
//    • Per-game score breakdown
// ═══════════════════════════════════════════════════════════════

const STORAGE_BUCKET = "mini-games-9a4e1.firebasestorage.app";

function getAvatarUrl(avatarId: string): string {
    return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/avatars%2F${avatarId}.png?alt=media`;
}

export const getPlayerProfile = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;

        if (!deviceId) {
            res.status(400).json({ success: false, error: "deviceId query parameter is required." });
            return;
        }

        const db = admin.firestore();

        // ── 1. Read user document ──────────────────────────────────
        const userDoc = await db.collection("users").doc(deviceId).get();

        if (!userDoc.exists) {
            res.status(404).json({ success: false, error: "User not found." });
            return;
        }

        const userData = userDoc.data()!;

        // ── 2. Read gameStats subcollection ────────────────────────
        const gameStatsSnapshot = await db
            .collection("users")
            .doc(deviceId)
            .collection("gameStats")
            .get();

        // ── 3. Read games collection (names + total count) ────────
        const gamesSnapshot = await db.collection("games").get();
        const gameNames: Record<string, string> = {};
        gamesSnapshot.docs.forEach((doc) => {
            gameNames[doc.id] = doc.data().name || doc.id;
        });
        const totalGames = gamesSnapshot.size;

        // ── 4. Calculate rank ──────────────────────────────────────
        const myWeightedScore = userData.weightedGlobalScore || 0;

        const higherCount = await db
            .collection("users")
            .where("weightedGlobalScore", ">", myWeightedScore)
            .count()
            .get();
        const rank = (higherCount.data().count || 0) + 1;

        // ── 5. Read daily streak ───────────────────────────────────
        const todayDate = getTodayUTC();
        const streakDoc = await db.collection("dailyStreaks").doc(deviceId).get();

        let dailyChallenge = {
            currentStreak: 0,
            bestStreak: 0,
            totalDaysCompleted: 0,
            totalPuzzlesSolved: 0,
        };

        if (streakDoc.exists) {
            const streakData = streakDoc.data()!;
            const lastCompletedDate = streakData.lastCompletedDate || null;
            const alive = isStreakAlive(lastCompletedDate, todayDate);

            dailyChallenge = {
                currentStreak: alive ? (streakData.currentStreak || 0) : 0,
                bestStreak: streakData.bestStreak || 0,
                totalDaysCompleted: streakData.totalDaysCompleted || 0,
                totalPuzzlesSolved: streakData.totalPuzzlesSolved || 0,
            };
        }

        // ── 6. Build per-game breakdown ────────────────────────────
        const games = gameStatsSnapshot.docs.map((doc) => {
            const data = doc.data();
            const gameId = doc.id;
            const coefficient = getCoefficient(gameId);
            const bestScore = data.bestScore || 0;

            return {
                gameId,
                gameName: gameNames[gameId] || gameId,
                bestScore,
                coefficient,
                weightedScore: Math.round(bestScore * coefficient),
                gamesPlayed: data.gamesPlayed || 0,
                avgScore: data.avgScore || 0,
            };
        });

        // Sort by weightedScore descending
        games.sort((a, b) => b.weightedScore - a.weightedScore);

        // ── 7. Compute aggregated stats ────────────────────────────
        const gamesPlayed = userData.gamesPlayed || 0;
        const correctAnswers = userData.correctAnswers || 0;
        const bestStreak = userData.bestStreak || 0;

        const winRate = gamesPlayed > 0
            ? Math.round((correctAnswers / gamesPlayed) * 1000) / 10
            : 0;

        const uniqueGamesPlayed = gameStatsSnapshot.size;
        const tier = getTierByScore(myWeightedScore);
        const tierProgress = getTierProgress(myWeightedScore);

        // ── 8. Build avatar URL ────────────────────────────────────
        const avatarId = userData.avatarId || "avatar_01";
        const avatarUrl = userData.avatarUrl || getAvatarUrl(avatarId);

        // ── 9. Respond ─────────────────────────────────────────────
        res.status(200).json({
            success: true,
            profile: {
                nickname: userData.nickname || "Unknown",
                avatarId,
                avatarUrl,
                age: userData.age || null,
            },
            stats: {
                gamesPlayed,
                correctAnswers,
                winRate,
                bestStreak,
                currentStreak: dailyChallenge.currentStreak,
                weightedGlobalScore: myWeightedScore,
                globalScore: userData.globalScore || 0,
                rating: userData.rating || 0,
                tier,
                rank,
                uniqueGamesPlayed,
                totalGames,
                memberSince: userData.createdAt || null,
            },
            tierProgress,
            dailyChallenge,
            games,
        });
    } catch (error) {
        functions.logger.error("getPlayerProfile failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
