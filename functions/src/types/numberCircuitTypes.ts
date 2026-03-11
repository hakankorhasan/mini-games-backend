/**
 * Number Circuit — TypeScript Types
 *
 * Defines all types for the Number Circuit puzzle game.
 * Used by the daily challenge generator on the server.
 * The same types are mirrored client-side for local level generation.
 */

/** Grid dimensions: 3×3 through 6×6 */
export type GridSize = 3 | 4 | 5 | 6;

/** Row/column position on the grid */
export interface Position {
    row: number;
    col: number;
}

/** Mathematical operators available between connected cells */
export type Operator = "+" | "-" | "×" | "÷" | "^" | "combine";

/** Special tile types that modify gameplay */
export type SpecialTileType = "locked" | "multiplier" | "forcedOperator" | "bomb";

/** A special tile placed on the grid */
export interface SpecialTile {
    position: Position;
    type: SpecialTileType;
    /** e.g. multiplier value (2, 3), forced operator ("+", "×") */
    value?: number | string;
}

/** One step in the solution path */
export interface PathStep {
    position: Position;
    /** The operator applied BEFORE this number (undefined for the first step) */
    operator?: Operator;
}

/** Hint data — 3 progressive levels */
export interface Hints {
    /** First number in the path */
    hint1: { position: Position };
    /** First two numbers */
    hint2: { positions: [Position, Position] };
    /** First two numbers + the operator between them */
    hint3: { positions: [Position, Position]; operator: Operator };
}

/** Complete level payload */
export interface NumberCircuitLevel {
    /** Grid of numbers (row-major) */
    grid: number[][];
    /** Grid dimensions */
    gridSize: GridSize;
    /** Target value the player must reach */
    target: number;
    /** Operators the player can use */
    allowedOperators: Operator[];
    /** Special tiles on the grid (may be empty) */
    specialTiles: SpecialTile[];
    /** The solution path (for hint generation & validation) */
    solution: PathStep[];
    /** Expression string e.g. "6 × 4" */
    solutionExpression: string;
    /** Progressive hints */
    hints: Hints;
}

/** Daily challenge stored in Firestore */
export interface DailyChallenge {
    date: string;           // "2026-03-11"
    level: NumberCircuitLevel;
    createdAt: FirebaseFirestore.Timestamp;
}

/** Configuration derived from level number */
export interface LevelConfig {
    gridSize: GridSize;
    allowedOperators: Operator[];
    minPathLength: number;
    maxPathLength: number;
    specialTileTypes: SpecialTileType[];
    maxSpecialTiles: number;
}
