/**
 * Streak Calculator
 *
 * Handles daily streak logic:
 * - Streak increments ONLY when user completes 5/5 daily puzzles
 * - 1-day gap resets streak to 1
 * - Same-day completion doesn't double-count
 */

export interface StreakData {
    currentStreak: number;
    bestStreak: number;
    lastCompletedDate: string | null;   // "YYYY-MM-DD" UTC
    totalDaysCompleted: number;
    totalPuzzlesSolved: number;
}

export interface StreakUpdateResult {
    updatedStreak: StreakData;
    streakIncreased: boolean;
    streakBroken: boolean;
}

/**
 * Calculate the number of calendar days between two date strings.
 */
function daysBetween(dateA: string, dateB: string): number {
    const a = new Date(dateA + "T00:00:00Z");
    const b = new Date(dateB + "T00:00:00Z");
    return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000);
}

/**
 * Update streak after a user completes all 5/5 daily puzzles.
 *
 * @param current - Current streak data from Firestore
 * @param todayDate - Today's UTC date string ("YYYY-MM-DD")
 * @returns Updated streak data + flags
 */
export function updateStreak(current: StreakData, todayDate: string): StreakUpdateResult {
    const { lastCompletedDate } = current;

    // First ever completion
    if (!lastCompletedDate) {
        const updatedStreak: StreakData = {
            ...current,
            currentStreak: 1,
            bestStreak: Math.max(current.bestStreak, 1),
            lastCompletedDate: todayDate,
            totalDaysCompleted: current.totalDaysCompleted + 1,
        };
        return { updatedStreak, streakIncreased: true, streakBroken: false };
    }

    // Already completed today — no change
    if (lastCompletedDate === todayDate) {
        return { updatedStreak: current, streakIncreased: false, streakBroken: false };
    }

    const gap = daysBetween(lastCompletedDate, todayDate);

    if (gap === 1) {
        // Consecutive day → increment streak
        const newStreak = current.currentStreak + 1;
        const updatedStreak: StreakData = {
            ...current,
            currentStreak: newStreak,
            bestStreak: Math.max(current.bestStreak, newStreak),
            lastCompletedDate: todayDate,
            totalDaysCompleted: current.totalDaysCompleted + 1,
        };
        return { updatedStreak, streakIncreased: true, streakBroken: false };
    }

    // Gap > 1 day → streak broken, reset to 1
    const updatedStreak: StreakData = {
        ...current,
        currentStreak: 1,
        bestStreak: current.bestStreak,  // best doesn't change
        lastCompletedDate: todayDate,
        totalDaysCompleted: current.totalDaysCompleted + 1,
    };
    return { updatedStreak, streakIncreased: true, streakBroken: true };
}

// ─── Bonus Score Calculation ────────────────────────────────────

/**
 * Calculate bonus points for completing all 5 daily puzzles.
 * Additional streak-based bonuses for long streaks.
 */
export function calculateDailyBonus(currentStreak: number): number {
    let bonus = 100;  // Base 5/5 completion bonus

    if (currentStreak >= 30) {
        bonus += 150;  // 30+ day streak bonus
    } else if (currentStreak >= 14) {
        bonus += 100;  // 14+ day streak bonus
    } else if (currentStreak >= 7) {
        bonus += 50;   // 7+ day streak bonus
    } else if (currentStreak >= 3) {
        bonus += 25;   // 3+ day streak bonus
    }

    return bonus;
}

/**
 * Check if the user's streak is still alive as of today.
 * If lastCompletedDate is more than 1 day ago, streak is broken.
 */
export function isStreakAlive(lastCompletedDate: string | null, todayDate: string): boolean {
    if (!lastCompletedDate) return false;
    if (lastCompletedDate === todayDate) return true;
    return daysBetween(lastCompletedDate, todayDate) <= 1;
}
