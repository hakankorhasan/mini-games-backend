/**
 * Nonogram (Pixel Excavation) — TypeScript Types
 *
 * Types for the backend level generator, Firestore storage,
 * and API responses.
 */

/** Configuration for generating a level at a given difficulty */
export interface NonogramLevelConfig {
    gridSize: number;       // 5–10
    fillFraction: number;   // 0.28–0.50
}

/** A complete Nonogram puzzle stored in Firestore */
export interface NonogramLevel {
    levelNumber: number;
    gridSize: number;
    fillFraction: number;
    solution: boolean[][];  // N×N matrix — true = filled (fossil)
    rowClues: number[][];   // clues for each row
    colClues: number[][];   // clues for each column
}

/** User progress for Nonogram */
export interface NonogramProgress {
    currentLevel: number;
    completedLevels: number[];
    updatedAt?: FirebaseFirestore.Timestamp;
}

/** Stats for a single completed level */
export interface NonogramLevelStat {
    levelNumber: number;
    timeSpent: number;      // seconds
    moveCount: number;
    completedAt?: FirebaseFirestore.Timestamp;
}
