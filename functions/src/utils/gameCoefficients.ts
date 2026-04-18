/**
 * Game Coefficient Utilities
 *
 * Provides coefficient lookup for weighted global leaderboard scoring.
 * Each game has a coefficient that determines how much its best score
 * contributes to the global leaderboard.
 *
 * weightedGlobalScore = Σ(game.bestScore × game.coefficient)
 */

/** Fallback coefficients — used when Firestore data is unavailable */
const DEFAULT_COEFFICIENTS: Record<string, number> = {
    pipeConnect: 1.0,
    laserPuzzle: 1.2,

    pixelExcavation: 1.5,
    slitherlink: 1.5,
    blockFit: 1.0,

    neuralLink: 1.3,
    galacticBeacons: 1.5,
    numberCircuit: 1.2,
    wordPuzzle: 1.0,
    arrowPuzzle: 1.4,
    liquidSort: 1.2,
    waterSort: 1.2,
};

/**
 * Returns the leaderboard coefficient for a given gameId.
 * Unknown games default to 1.0.
 */
export function getCoefficient(gameId: string): number {
    return DEFAULT_COEFFICIENTS[gameId] ?? 1.0;
}

export interface GameScoreBreakdown {
    gameId: string;
    bestScore: number;
    coefficient: number;
    weightedScore: number;
}

export interface WeightedScoreResult {
    weightedTotal: number;
    breakdown: GameScoreBreakdown[];
}

/**
 * Calculates the weighted global score from per-game best scores.
 *
 * @param gameScores - Map of gameId → bestScore
 * @returns Total weighted score and per-game breakdown
 */
export function calculateWeightedGlobalScore(
    gameScores: Record<string, number>
): WeightedScoreResult {
    const breakdown: GameScoreBreakdown[] = [];
    let weightedTotal = 0;

    for (const [gameId, bestScore] of Object.entries(gameScores)) {
        const coefficient = getCoefficient(gameId);
        const weightedScore = Math.round(bestScore * coefficient);
        weightedTotal += weightedScore;
        breakdown.push({ gameId, bestScore, coefficient, weightedScore });
    }

    return { weightedTotal, breakdown };
}
