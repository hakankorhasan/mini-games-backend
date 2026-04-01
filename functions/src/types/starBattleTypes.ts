/**
 * Galactic Beacons (Star Battle) — TypeScript Types
 *
 * Types for the backend level generator, Firestore storage,
 * and API responses.
 */

/** A complete Star Battle puzzle stored in Firestore */
export interface StarBattleLevel {
    levelNumber: number;
    gridSize: number;           // 5, 6, 8, 10, 12
    beaconsPerUnit: number;     // B=1 or B=2
    difficulty: string;         // "tutorial" | "easy" | "intermediate" | "advanced" | "hard" | "expert" | "master"
    difficultyValue: number;    // 1-10
    regions: number[][];        // NxN matrix, each cell = region ID (0..gridSize-1)
    solution: boolean[][];      // NxN matrix, true = beacon placed
    regionColors: number[];     // Size=gridSize, each index is a region ID, value is color ID (0..7)
}

/** User progress for Star Battle */
export interface StarBattleProgress {
    currentLevel: number;
    completedLevels: number[];
    updatedAt?: FirebaseFirestore.Timestamp;
}

/** Stats for a single completed level */
export interface StarBattleLevelStat {
    levelNumber: number;
    timeSpent: number;      // seconds
    moveCount: number;
    completedAt?: FirebaseFirestore.Timestamp;
}
