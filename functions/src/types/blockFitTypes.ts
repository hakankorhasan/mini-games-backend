/**
 * Block Fit — TypeScript Types
 *
 * Types for the backend level generator, Firestore storage,
 * and API responses.
 */

// ─── Primitives ─────────────────────────────────────────────────

export type BlockFitDifficulty =
    | "beginner"
    | "intermediate"
    | "advanced"
    | "expert"
    | "master";

// ─── Block Templates ────────────────────────────────────────────

/** A single cell offset within a block shape */
export interface CellOffset {
    row: number;
    col: number;
}

/** Template for a block shape */
export interface BlockTemplate {
    index: number;
    name: string;
    cells: CellOffset[];
}

// ─── Prefill ────────────────────────────────────────────────────

/** A pre-filled cell on the grid */
export interface PrefillCell {
    row: number;
    col: number;
    colorIndex: number;
}

// ─── Difficulty Config ──────────────────────────────────────────

export interface BlockFitDifficultyConfig {
    difficulty: BlockFitDifficulty;
    difficultyValue: number;     // 1–10 for iOS scoring
    gridSize: number;            // always 9
    targetScore: number;
    maxBlockIndex: number;       // max template index (inclusive)
    prefillRows: number;         // number of pre-filled rows at bottom
}

// ─── Complete Level ─────────────────────────────────────────────

export interface BlockFitLevel {
    levelNumber: number;
    gridSize: number;            // 9
    targetScore: number;
    difficulty: BlockFitDifficulty;
    difficultyValue: number;     // 1–10
    prefill: PrefillCell[];      // pre-filled cells
    blockPool: number[];         // array of block template indices
}
