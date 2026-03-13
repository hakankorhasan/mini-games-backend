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
 * Capped at 10 effective streak → max 2.0x multiplier.
 *
 * Formula: 1.0 + (min(streak, 10) × 0.1)
 *
 *  0 streak → 1.0x
 *  3 streak → 1.3x
 *  5 streak → 1.5x
 * 10 streak → 2.0x (cap)
 */
function getStreakBonus(streak: number): number {
    const effectiveStreak = Math.min(streak, 10);
    return 1.0 + (effectiveStreak * 0.1);
}

export function calculateGlobalScore(input: GlobalScoreInput): GlobalScoreResult {
    const { difficulty, correct, responseTime, currentStreak } = input;

    if (!correct) {
        return { scoreGained: 0, newStreak: 0 };
    }

    const basePoints = difficulty * 15;
    const speedBonus = getSpeedBonus(responseTime);
    const newStreak = currentStreak + 1;
    const streakBonus = getStreakBonus(newStreak);

    const scoreGained = Math.round(basePoints * speedBonus * streakBonus);

    return { scoreGained, newStreak };
}
