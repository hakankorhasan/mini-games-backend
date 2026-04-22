/**
 * Global Score calculation utility.
 *
 * Unlike the Elo-like `rating` system, globalScore is cumulative:
 *  - Correct answers ADD points (never subtract)
 *  - Wrong answers add 0 points but reset streak
 *  - Formula: basePoints × speedBonus × streakBonus
 *
 * This rewards both skill AND activity over time.
 */

export interface GlobalScoreInput {
    level: number;           // now using level for base points
    difficulty: number;      // 1–10 (retained for hint penalty scaling)
    correct: boolean;
    responseTime: number;    // seconds
    currentStreak: number;   // consecutive correct answers before this game
    hintsUsed?: number;      // how many hints used
    gameId?: string;         // identifier of game (e.g. wordPuzzle)
    isReplay?: boolean;      // if true, player replayed a previously completed level
}

export interface GlobalScoreResult {
    scoreGained: number;     // points to add to globalScore
    newStreak: number;       // updated streak value
}

/**
 * Speed bonus based on response time.
 * Faster responses get a higher multiplier (1.0x – 1.5x).
 *
 * Formula: max(1.0, 1.5 − (responseTime / 40))
 *
 *  1s  → 1.47x
 *  5s  → 1.37x
 *  10s → 1.25x
 *  20s → 1.0x (floor)
 */
function getSpeedBonus(responseTime: number): number {
    const bonus = 1.5 - (responseTime / 40);
    return Math.max(1.0, Math.round(bonus * 100) / 100);
}

/**
 * Streak bonus based on consecutive correct answers.
 * Capped at 10 effective streak → max 1.5x multiplier.
 *
 * Formula: 1.0 + (min(streak, 10) × 0.05)
 *
 *  0 streak → 1.0x
 *  3 streak → 1.15x
 *  5 streak → 1.25x
 * 10 streak → 1.5x (cap)
 */
function getStreakBonus(streak: number): number {
    const effectiveStreak = Math.min(streak, 10);
    return 1.0 + (effectiveStreak * 0.05);
}

export function calculateGlobalScore(input: GlobalScoreInput): GlobalScoreResult {
    const { level, difficulty, correct, responseTime, currentStreak, hintsUsed = 0, gameId, isReplay = false } = input;

    if (!correct) {
        return { scoreGained: 0, newStreak: 0 };
    }

    const safeLevel = (typeof level === "number" && !isNaN(level) && level > 0) ? level : difficulty;
    let basePoints = Math.round(10 + (safeLevel * 2));
    
    // Hint penalty logic
    if (hintsUsed > 0) {
        if (gameId === "wordPuzzle") {
            if (hintsUsed >= difficulty) {
                // If the user used hints for all letters, they get 0 points.
                basePoints = 0;
            } else {
                // For wordPuzzle, difficulty is wordLength (meaning maxHints = difficulty).
                // Penalty per hint = 0.8 / difficulty.
                const maxPenalty = 0.8;
                const penaltyPerHint = maxPenalty / Math.max(1, difficulty);
                const multiplier = Math.max(0.2, 1.0 - (hintsUsed * penaltyPerHint));
                basePoints = basePoints * multiplier;
            }
        } else {
            // Generic fallback penalty for other games if they add hints later
            const multiplier = Math.max(0.1, Math.pow(0.85, hintsUsed));
            basePoints = basePoints * multiplier;
        }
    }

    const speedBonus = getSpeedBonus(responseTime);
    const newStreak = isReplay ? currentStreak : currentStreak + 1;
    const streakBonus = getStreakBonus(newStreak);

    const scoreGained = Math.round(basePoints * speedBonus * streakBonus);

    return { scoreGained, newStreak };
}
