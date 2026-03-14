/**
 * Anti-cheat validation utilities.
 */

export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

/** Valid game IDs matching the mini-games in the iOS app */
const VALID_GAME_IDS = [
    "pipeConnect",
    "laserPuzzle",
    "hiddenPair",
    "binaryPuzzle",
    "pixelExcavation",
    "slitherlink",
    "blockFit",
    "cryptoCage",
    "neuralLink",
    "galacticBeacons",
    "numberCircuit",
    "wordPuzzle",
];

/**
 * Validates incoming game result data.
 *
 * Checks:
 *  - gameId is a known game
 *  - difficulty is between 1–10
 *  - responseTime is realistic (≥ 0.5 seconds)
 *  - correct is a boolean
 */
export function validateGameResult(data: {
    gameId: unknown;
    difficulty: unknown;
    correct: unknown;
    responseTime: unknown;
}): ValidationResult {
    const { gameId, difficulty, correct, responseTime } = data;

    if (typeof gameId !== "string" || !VALID_GAME_IDS.includes(gameId)) {
        return { valid: false, reason: `Invalid gameId: ${gameId}` };
    }

    if (typeof difficulty !== "number" || difficulty < 1 || difficulty > 10) {
        return { valid: false, reason: `Invalid difficulty: ${difficulty}` };
    }

    if (typeof correct !== "boolean") {
        return { valid: false, reason: "correct must be a boolean" };
    }

    if (typeof responseTime !== "number" || responseTime < 0.5) {
        return {
            valid: false,
            reason: `Suspicious responseTime: ${responseTime}s (minimum 0.5s)`,
        };
    }

    if (responseTime > 300) {
        return {
            valid: false,
            reason: `responseTime too high: ${responseTime}s (maximum 300s)`,
        };
    }

    return { valid: true };
}
