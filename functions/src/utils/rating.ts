/**
 * Rating calculation utility.
 *
 * Rating formula:
 *  - Base points = difficulty × 10
 *  - Correct answer: basePoints × speedMultiplier
 *  - Wrong answer: −(basePoints × 0.5)
 *  - Minimum rating = 0
 */

export interface RatingInput {
    currentRating: number;
    difficulty: number;
    correct: boolean;
    responseTime: number;
}

export interface RatingResult {
    newRating: number;
    ratingChange: number;
}

/**
 * Speed multiplier based on response time (seconds).
 *  < 5s  → 2.0x
 *  < 10s → 1.5x
 *  < 20s → 1.2x
 *  ≥ 20s → 1.0x
 */
function getSpeedMultiplier(responseTime: number): number {
    if (responseTime < 5) return 2.0;
    if (responseTime < 10) return 1.5;
    if (responseTime < 20) return 1.2;
    return 1.0;
}

export function calculateRatingChange(input: RatingInput): RatingResult {
    const { currentRating, difficulty, correct, responseTime } = input;

    const basePoints = difficulty * 10;
    let ratingChange: number;

    if (correct) {
        const speedMultiplier = getSpeedMultiplier(responseTime);
        ratingChange = Math.round(basePoints * speedMultiplier);
    } else {
        ratingChange = -Math.round(basePoints * 0.5);
    }

    const newRating = Math.max(0, currentRating + ratingChange);

    return { newRating, ratingChange };
}
