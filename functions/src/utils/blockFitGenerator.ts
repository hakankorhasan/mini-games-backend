/**
 * Block Fit — Level Generator
 *
 * Procedural level generation engine for the Block Fit puzzle.
 * Generates levels with progressive difficulty featuring:
 *   - 28 block templates (single → pentomino → corners)
 *   - Pre-filled rows at higher difficulties
 *   - Deterministic generation via seeded PRNG
 *
 * Reuses the seeded PRNG from numberCircuit.ts.
 */

import {
    BlockFitLevel,
    BlockFitDifficultyConfig,
    BlockTemplate,
    PrefillCell,
} from "../types/blockFitTypes";
import { createSeededRandom, hashString } from "./numberCircuit";

// Re-export for convenience
export { createSeededRandom, hashString };

// ─── Constants ──────────────────────────────────────────────────

export const GRID_SIZE = 9;
export const TOTAL_BLOCK_FIT_LEVELS = 1000;

/** 8 color palette (indices 0–7) */
export const COLORS = [
    "#FF4444", // red
    "#4488FF", // blue
    "#44CC44", // green
    "#FFCC00", // yellow
    "#AA44FF", // purple
    "#FF8800", // orange
    "#00CCCC", // teal
    "#FF66AA", // pink
];

/** Prefill color (gray) */
export const PREFILL_COLOR_INDEX = -1; // special: gray (#404045)

// ─── 28 Block Templates ────────────────────────────────────────

export const BLOCK_TEMPLATES: BlockTemplate[] = [
    // 0: Single
    { index: 0, name: "single", cells: [{ row: 0, col: 0 }] },

    // 1–2: Domino
    { index: 1, name: "domino_h", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
    { index: 2, name: "domino_v", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }] },

    // 3–8: Triomino
    { index: 3, name: "tri_i_h", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
    { index: 4, name: "tri_i_v", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }] },
    { index: 5, name: "tri_l", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
    { index: 6, name: "tri_l_r", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }] },
    { index: 7, name: "tri_l_180", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }] },
    { index: 8, name: "tri_l_270", cells: [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },

    // 9–16: Tetromino
    { index: 9, name: "tetra_i_h", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }] },
    { index: 10, name: "tetra_i_v", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }] },
    { index: 11, name: "tetra_o", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
    { index: 12, name: "tetra_l", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }] },
    { index: 13, name: "tetra_j", cells: [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 0 }, { row: 2, col: 1 }] },
    { index: 14, name: "tetra_s", cells: [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
    { index: 15, name: "tetra_z", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 2 }] },
    { index: 16, name: "tetra_t", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 1 }] },

    // 17–22: Pentomino
    { index: 17, name: "penta_i_h", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 }] },
    { index: 18, name: "penta_i_v", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }, { row: 4, col: 0 }] },
    { index: 19, name: "penta_l", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }, { row: 3, col: 1 }] },
    { index: 20, name: "penta_j", cells: [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 3, col: 0 }, { row: 3, col: 1 }] },
    { index: 21, name: "penta_s", cells: [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 0 }, { row: 3, col: 0 }] },
    { index: 22, name: "penta_stair", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 2 }] },

    // 23: 2×2 block
    { index: 23, name: "block_2x2", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },

    // 24: 3×3 block
    {
        index: 24, name: "block_3x3", cells: [
            { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
            { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
            { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
        ],
    },

    // 25–28: Corner shapes (L-shaped, 5 cells)
    { index: 25, name: "corner_tl", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 0 }, { row: 2, col: 0 }] },
    { index: 26, name: "corner_tr", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 2 }] },
    { index: 27, name: "corner_bl", cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }] },
    { index: 28, name: "corner_br", cells: [{ row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }] },
];

// ─── Difficulty Config ──────────────────────────────────────────

/**
 * Returns difficulty configuration for a given level number.
 *
 * 10 sub-tiers spanning 1000 levels. Grid is always 9×9.
 * Variety comes from: targetScore, maxBlockIndex, prefillRows,
 * and difficultyValue progression.
 *
 * Tier Map:
 *   1–40   Beginner I    : triomino only, no prefill
 *   41–100 Beginner II   : triomino, higher scores
 *   101–180 Intermediate I : + tetromino
 *   181–280 Intermediate II: tetromino, prefill starts (1 row)
 *   281–400 Advanced I     : + pentomino
 *   401–500 Advanced II    : pentomino + 2×2, prefill 1–2
 *   501–620 Expert I       : + big shapes (corners)
 *   621–750 Expert II      : all shapes, prefill 2
 *   751–880 Master I       : all shapes, prefill 2–3, high scores
 *   881–1000 Master II     : all shapes, prefill 3–4, max scores
 */
export function getDifficultyConfig(levelNumber: number): BlockFitDifficultyConfig {
    // ── Tier 1: Beginner I (1–40) ──
    if (levelNumber <= 40) {
        const t = (levelNumber - 1) / 39;
        return {
            difficulty: "beginner",
            difficultyValue: 1,
            gridSize: GRID_SIZE,
            targetScore: Math.round(25 + t * 35),    // 25→60
            maxBlockIndex: 8,                          // single, domino, triomino
            prefillRows: 0,
        };
    }

    // ── Tier 2: Beginner II (41–100) ──
    if (levelNumber <= 100) {
        const t = (levelNumber - 41) / 59;
        return {
            difficulty: "beginner",
            difficultyValue: 2,
            gridSize: GRID_SIZE,
            targetScore: Math.round(60 + t * 40),    // 60→100
            maxBlockIndex: 8,
            prefillRows: 0,
        };
    }

    // ── Tier 3: Intermediate I (101–180) ──
    if (levelNumber <= 180) {
        const t = (levelNumber - 101) / 79;
        return {
            difficulty: "intermediate",
            difficultyValue: 3,
            gridSize: GRID_SIZE,
            targetScore: Math.round(80 + t * 50),    // 80→130
            maxBlockIndex: 16,                         // + tetromino
            prefillRows: 0,
        };
    }

    // ── Tier 4: Intermediate II (181–280) ──
    if (levelNumber <= 280) {
        const t = (levelNumber - 181) / 99;
        return {
            difficulty: "intermediate",
            difficultyValue: 4,
            gridSize: GRID_SIZE,
            targetScore: Math.round(120 + t * 60),   // 120→180
            maxBlockIndex: 16,
            prefillRows: t < 0.5 ? 0 : 1,
        };
    }

    // ── Tier 5: Advanced I (281–400) ──
    if (levelNumber <= 400) {
        const t = (levelNumber - 281) / 119;
        return {
            difficulty: "advanced",
            difficultyValue: 5,
            gridSize: GRID_SIZE,
            targetScore: Math.round(160 + t * 70),   // 160→230
            maxBlockIndex: 22,                         // + pentomino
            prefillRows: t < 0.4 ? 0 : 1,
        };
    }

    // ── Tier 6: Advanced II (401–500) ──
    if (levelNumber <= 500) {
        const t = (levelNumber - 401) / 99;
        return {
            difficulty: "advanced",
            difficultyValue: 6,
            gridSize: GRID_SIZE,
            targetScore: Math.round(220 + t * 80),   // 220→300
            maxBlockIndex: 23,                         // + 2×2 block
            prefillRows: t < 0.5 ? 1 : 2,
        };
    }

    // ── Tier 7: Expert I (501–620) ──
    if (levelNumber <= 620) {
        const t = (levelNumber - 501) / 119;
        return {
            difficulty: "expert",
            difficultyValue: 7,
            gridSize: GRID_SIZE,
            targetScore: Math.round(280 + t * 100),  // 280→380
            maxBlockIndex: 26,                         // + corners
            prefillRows: t < 0.4 ? 1 : 2,
        };
    }

    // ── Tier 8: Expert II (621–750) ──
    if (levelNumber <= 750) {
        const t = (levelNumber - 621) / 129;
        return {
            difficulty: "expert",
            difficultyValue: 8,
            gridSize: GRID_SIZE,
            targetScore: Math.round(350 + t * 100),  // 350→450
            maxBlockIndex: 28,                         // all shapes
            prefillRows: 2,
        };
    }

    // ── Tier 9: Master I (751–880) ──
    if (levelNumber <= 880) {
        const t = (levelNumber - 751) / 129;
        return {
            difficulty: "master",
            difficultyValue: 9,
            gridSize: GRID_SIZE,
            targetScore: Math.round(420 + t * 130),  // 420→550
            maxBlockIndex: 28,
            prefillRows: t < 0.5 ? 2 : 3,
        };
    }

    // ── Tier 10: Master II (881–1000+) ──
    const t = Math.min((levelNumber - 881) / 119, 1);
    return {
        difficulty: "master",
        difficultyValue: 10,
        gridSize: GRID_SIZE,
        targetScore: Math.round(500 + t * 200),      // 500→700
        maxBlockIndex: 28,
        prefillRows: t < 0.4 ? 3 : 4,
    };
}

// ─── Prefill Generation ─────────────────────────────────────────

/**
 * Generate pre-filled cells at the bottom of the grid.
 * Each row has 2–3 random gaps (empty cells).
 */
export function generatePrefill(
    prefillRows: number,
    rand: () => number
): PrefillCell[] {
    if (prefillRows === 0) return [];

    const cells: PrefillCell[] = [];

    for (let rowOffset = 0; rowOffset < prefillRows; rowOffset++) {
        const row = GRID_SIZE - 1 - rowOffset; // bottom-up

        // Determine gap count: 2 or 3
        const gapCount = rand() < 0.5 ? 2 : 3;

        // Pick random gap positions
        const allCols = Array.from({ length: GRID_SIZE }, (_, i) => i);
        const gaps = new Set<number>();
        while (gaps.size < gapCount) {
            const idx = Math.floor(rand() * allCols.length);
            gaps.add(allCols[idx]);
        }

        // Fill non-gap positions
        for (let col = 0; col < GRID_SIZE; col++) {
            if (!gaps.has(col)) {
                cells.push({
                    row,
                    col,
                    colorIndex: PREFILL_COLOR_INDEX, // gray
                });
            }
        }
    }

    return cells;
}

// ─── Block Pool Generation ──────────────────────────────────────

/**
 * Build the block pool: all template indices from 0 to maxBlockIndex.
 */
export function buildBlockPool(maxBlockIndex: number): number[] {
    const pool: number[] = [];
    for (let i = 0; i <= maxBlockIndex; i++) {
        pool.push(i);
    }
    return pool;
}

// ─── Main Level Generator ───────────────────────────────────────

/**
 * Generate a complete Block Fit level.
 */
export function generateLevel(
    levelNumber: number,
    rand: () => number
): BlockFitLevel {
    const config = getDifficultyConfig(levelNumber);

    return {
        levelNumber,
        gridSize: config.gridSize,
        targetScore: config.targetScore,
        difficulty: config.difficulty,
        difficultyValue: config.difficultyValue,
        prefill: generatePrefill(config.prefillRows, rand),
        blockPool: buildBlockPool(config.maxBlockIndex),
    };
}

// ─── Batch Generation ───────────────────────────────────────────

/**
 * Generate multiple levels deterministically.
 * Each level uses a seed derived from "BlockFit-level-{N}".
 */
export function generateLevels(
    startFrom: number,
    count: number
): BlockFitLevel[] {
    const levels: BlockFitLevel[] = [];
    for (let i = 0; i < count; i++) {
        const levelNumber = startFrom + i;
        const seed = hashString(`BlockFit-level-${levelNumber}`);
        const rand = createSeededRandom(seed);
        levels.push(generateLevel(levelNumber, rand));
    }
    return levels;
}
