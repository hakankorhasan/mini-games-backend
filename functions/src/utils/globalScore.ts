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
    difficulty: number;      // 1–10
    correct: boolean;
    responseTime: number;    // seconds
    currentStreak: number;   // consecutive correct answers before this game
    hintsUsed?: number;      // how many hints used
    gameId?: string;         // identifier of game (e.g. wordPuzzle)
    isReplay?: boolean;      // if true, player replayed a previously completed level
    level?: number;          // level number, used for logarithmic scaling instead of difficulty
}

export interface GlobalScoreResult {
    scoreGained: number;     // points to add to globalScore
    newStreak: number;       // updated streak value
}

/**
 * Speed bonus based on response time.
 * Faster responses get a higher multiplier (1.0x – 2.5x).
 *
 * Formula: max(1.0, 2.5 − (responseTime / 20))
 *
 *  1s  → 2.45x
 *  5s  → 2.25x
 *  10s → 2.0x
 *  20s → 1.5x
 *  30s → 1.0x (floor)
 */
function getSpeedBonus(responseTime: number): number {
    const bonus = 2.5 - (responseTime / 20);
    return Math.max(1.0, Math.round(bonus * 100) / 100);
}

/**
 * Streak bonus based on consecutive correct answers.
 * Capped at 10 effective streak → max 1.2x multiplier.
 *
 * Formula: 1.0 + (min(streak, 10) × 0.02)
 *
 *  0 streak → 1.0x
 *  5 streak → 1.1x
 * 10 streak → 1.2x (cap)
 */
function getStreakBonus(streak: number): number {
    const effectiveStreak = Math.min(streak, 10);
    return 1.0 + (effectiveStreak * 0.02);
}

export function calculateGlobalScore(input: GlobalScoreInput): GlobalScoreResult {
    const { difficulty, correct, responseTime, currentStreak, hintsUsed = 0, gameId, isReplay = false, level } = input;

    if (!correct) {
        return { scoreGained: 0, newStreak: 0 };
    }

    let basePoints = level ? Math.floor(Math.sqrt(level) * 10) : difficulty * 15;
    
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
