/**
 * Laser Puzzle — TypeScript Types
 *
 * Types for the backend level generator, Firestore storage,
 * and API responses.
 */

// ─── Primitives ─────────────────────────────────────────────────

export type Direction = "up" | "down" | "left" | "right";

export type CellType =
    | "empty"
    | "source"
    | "target"
    | "mirror"
    | "wall"
    | "portal"
    | "bomb"
    | "splitter";

export type DifficultyName =
    | "beginner"
    | "intermediate"
    | "advanced"
    | "expert"
    | "master";

// ─── Grid Cell ──────────────────────────────────────────────────

export interface Cell {
    row: number;
    col: number;
    type: CellType;
    /** Source direction — only for type "source" */
    direction?: Direction;
    /** Mirror/splitter angle: 0 = "/" (slash), 1 = "\" (backslash) */
    mirrorAngle?: number;
    /** Whether the mirror/splitter is fixed (player cannot rotate) */
    isFixed?: boolean;
    /** Portal pair id — only for type "portal" */
    portalPairId?: number;
}

// ─── Difficulty Config ──────────────────────────────────────────

export interface DifficultyConfig {
    gridSize: number;
    mirrorCount: number;
    wallCount: number;
    lives: number;
    fixedMirrorCount: number;
    decoyFillFraction: number;
    portalPairCount: number;
    bombCount: number;
    splitterCount: number;
    difficulty: DifficultyName;
}

// ─── Solution ───────────────────────────────────────────────────

export interface SolutionEntry {
    row: number;
    col: number;
    correctAngle: number; // 0 or 1
}

// ─── Complete Level ─────────────────────────────────────────────

export interface LaserPuzzleLevel {
    levelNumber: number;
    gridSize: number;
    difficulty: DifficultyName;
    lives: number;
    cells: Cell[];      // Only non-empty cells
    solution: SolutionEntry[];
}

// ─── Laser Trace ────────────────────────────────────────────────

export interface TraceResult {
    hitTargets: Set<string>;   // "row,col" keys
    hitBomb: boolean;
    allTargetsHit: boolean;
}

// ─── User Progress ──────────────────────────────────────────────

export interface LaserPuzzleProgress {
    currentLevel: number;
    completedLevels: number[];
    updatedAt?: FirebaseFirestore.Timestamp;
}

export interface LaserPuzzleLevelStat {
    levelNumber: number;
    timeSpent: number;      // seconds
    livesUsed: number;
    completedAt?: FirebaseFirestore.Timestamp;
}
