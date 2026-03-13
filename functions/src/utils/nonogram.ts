/**
 * Nonogram (Pixel Excavation) — Level Generator
 *
 * Procedural level generation engine for the Nonogram puzzle.
 * Generates puzzles with guaranteed solvability using
 * constraint propagation.
 *
 * Reuses the seeded PRNG from numberCircuit.ts for deterministic
 * generation.
 */

import { NonogramLevel, NonogramLevelConfig } from "../types/nonogramTypes";
import { createSeededRandom, hashString } from "./numberCircuit";

// Re-export for convenience
export { createSeededRandom, hashString };

// ─── Level Config ───────────────────────────────────────────────

/**
 * Returns gridSize and fillFraction for a given level number.
 * Progressive difficulty: grid grows, fill fraction decreases.
 * Max grid is 10×10.
 */
export function getLevelConfig(levelNumber: number): NonogramLevelConfig {
    if (levelNumber <= 10) {
        // Levels 1–10: 5×5, easy
        const t = (levelNumber - 1) / 9; // 0..1
        return { gridSize: 5, fillFraction: 0.50 - t * 0.05 };
    }
    if (levelNumber <= 25) {
        const t = (levelNumber - 11) / 14;
        return { gridSize: 6, fillFraction: 0.48 - t * 0.06 };
    }
    if (levelNumber <= 50) {
        const t = (levelNumber - 26) / 24;
        return { gridSize: 7, fillFraction: 0.45 - t * 0.05 };
    }
    if (levelNumber <= 80) {
        const t = (levelNumber - 51) / 29;
        return { gridSize: 8, fillFraction: 0.42 - t * 0.04 };
    }
    if (levelNumber <= 120) {
        const t = (levelNumber - 81) / 39;
        return { gridSize: 9, fillFraction: 0.40 - t * 0.05 };
    }
    // Level 121+: 10×10
    const t = Math.min((levelNumber - 121) / 49, 1);
    return { gridSize: 10, fillFraction: 0.38 - t * 0.06 };
}

// ─── Solution Grid Generation ───────────────────────────────────

/**
 * Generate a random boolean[][] solution grid.
 * Guarantees no fully-empty rows or columns.
 */
export function generateSolution(
    gridSize: number,
    fillFraction: number,
    rand: () => number
): boolean[][] {
    const totalCells = gridSize * gridSize;
    const fillCount = Math.max(
        gridSize, // at least gridSize cells filled (1 per row minimum)
        Math.round(totalCells * fillFraction)
    );

    // Create flat array of all positions, shuffle, pick first fillCount
    const positions: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            positions.push({ r, c });
        }
    }

    // Fisher-Yates shuffle
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Initialize empty grid
    const grid: boolean[][] = Array.from({ length: gridSize }, () =>
        Array(gridSize).fill(false)
    );

    // Fill selected positions
    for (let i = 0; i < fillCount; i++) {
        grid[positions[i].r][positions[i].c] = true;
    }

    // Guarantee: no fully-empty row
    for (let r = 0; r < gridSize; r++) {
        if (!grid[r].some(Boolean)) {
            const c = Math.floor(rand() * gridSize);
            grid[r][c] = true;
        }
    }

    // Guarantee: no fully-empty column
    for (let c = 0; c < gridSize; c++) {
        const hasAny = grid.some((row) => row[c]);
        if (!hasAny) {
            const r = Math.floor(rand() * gridSize);
            grid[r][c] = true;
        }
    }

    return grid;
}

// ─── Clue Computation ───────────────────────────────────────────

/**
 * Compute run-length clues for a single line (row or column).
 * Returns array of consecutive filled-run lengths.
 * Returns [0] if no filled cells.
 */
export function computeClues(line: boolean[]): number[] {
    const runs: number[] = [];
    let count = 0;
    for (const filled of line) {
        if (filled) {
            count++;
        } else {
            if (count > 0) {
                runs.push(count);
                count = 0;
            }
        }
    }
    if (count > 0) {
        runs.push(count);
    }
    return runs.length > 0 ? runs : [0];
}

/**
 * Compute clues for all rows and columns of a solution.
 */
export function computeAllClues(solution: boolean[][]): {
    rowClues: number[][];
    colClues: number[][];
} {
    const gridSize = solution.length;
    const rowClues = solution.map((row) => computeClues(row));

    const colClues: number[][] = [];
    for (let c = 0; c < gridSize; c++) {
        const col = solution.map((row) => row[c]);
        colClues.push(computeClues(col));
    }

    return { rowClues, colClues };
}

// ─── Nonogram Solver (Constraint Propagation) ───────────────────

/** Cell state during solving: null = unknown, true = filled, false = empty */
type CellState = boolean | null;

/**
 * Generate all valid arrangements of a clue within a line of given length.
 * Each arrangement is a boolean[] of the line length.
 */
export function generateArrangements(
    clues: number[],
    lineLength: number
): boolean[][] {
    // If clue is [0], the only arrangement is all-empty
    if (clues.length === 1 && clues[0] === 0) {
        return [Array(lineLength).fill(false)];
    }

    const arrangements: boolean[][] = [];

    function backtrack(clueIndex: number, pos: number, current: boolean[]): void {
        if (clueIndex === clues.length) {
            // Fill remaining with false
            const result = [...current];
            while (result.length < lineLength) {
                result.push(false);
            }
            arrangements.push(result);
            return;
        }

        const blockLen = clues[clueIndex];
        // Minimum space needed for remaining blocks (each block + 1 gap)
        const remainingSpace = clues
            .slice(clueIndex + 1)
            .reduce((sum, c) => sum + c + 1, 0);
        const maxStart = lineLength - blockLen - remainingSpace;

        for (let start = pos; start <= maxStart; start++) {
            const next = [...current];
            // Add empties before this block
            while (next.length < start) {
                next.push(false);
            }
            // Add the block
            for (let i = 0; i < blockLen; i++) {
                next.push(true);
            }
            // Add mandatory gap after block (unless last block)
            if (clueIndex < clues.length - 1) {
                next.push(false);
                backtrack(clueIndex + 1, next.length, next);
            } else {
                backtrack(clueIndex + 1, next.length, next);
            }
        }
    }

    backtrack(0, 0, []);
    return arrangements;
}

/**
 * Filter arrangements to only those consistent with current known state.
 */
function filterArrangements(
    arrangements: boolean[][],
    known: CellState[]
): boolean[][] {
    return arrangements.filter((arr) =>
        arr.every(
            (val, i) => known[i] === null || known[i] === val
        )
    );
}

/**
 * From a set of valid arrangements, determine which cells are determined
 * (same value in ALL arrangements) and update the known state.
 * Returns true if any cell was newly determined.
 */
function propagateLine(
    arrangements: boolean[][],
    known: CellState[]
): boolean {
    if (arrangements.length === 0) return false;
    let changed = false;

    for (let i = 0; i < known.length; i++) {
        if (known[i] !== null) continue;

        const allTrue = arrangements.every((arr) => arr[i] === true);
        const allFalse = arrangements.every((arr) => arr[i] === false);

        if (allTrue) {
            known[i] = true;
            changed = true;
        } else if (allFalse) {
            known[i] = false;
            changed = true;
        }
    }

    return changed;
}

/**
 * Solve a nonogram puzzle using constraint propagation.
 *
 * Returns the solved grid if solvable by logic alone, or null if
 * the puzzle requires guessing (ambiguous with logic only).
 *
 * A puzzle is considered "line-solvable" if constraint propagation
 * alone can determine every cell.
 */
export function solveNonogram(
    rowClues: number[][],
    colClues: number[][],
    gridSize: number
): boolean[][] | null {
    // Initialize known grid: all null (unknown)
    const known: CellState[][] = Array.from({ length: gridSize }, () =>
        Array(gridSize).fill(null)
    );

    // Pre-compute arrangements for each row and column
    let rowArrangements = rowClues.map((clue) =>
        generateArrangements(clue, gridSize)
    );
    let colArrangements = colClues.map((clue) =>
        generateArrangements(clue, gridSize)
    );

    // Iterative constraint propagation
    let changed = true;
    let iterations = 0;
    const maxIterations = gridSize * 10; // safety limit

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        // Process rows
        for (let r = 0; r < gridSize; r++) {
            rowArrangements[r] = filterArrangements(
                rowArrangements[r],
                known[r]
            );
            if (rowArrangements[r].length === 0) return null; // contradiction
            if (propagateLine(rowArrangements[r], known[r])) {
                changed = true;
            }
        }

        // Process columns
        for (let c = 0; c < gridSize; c++) {
            const colKnown = known.map((row) => row[c]);
            colArrangements[c] = filterArrangements(
                colArrangements[c],
                colKnown
            );
            if (colArrangements[c].length === 0) return null; // contradiction
            if (propagateLine(colArrangements[c], colKnown)) {
                changed = true;
                // Write back column changes
                for (let r = 0; r < gridSize; r++) {
                    known[r][c] = colKnown[r];
                }
            }
        }
    }

    // Check if fully solved
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (known[r][c] === null) return null; // not fully determined
        }
    }

    return known as boolean[][];
}

// ─── Main Level Generator ───────────────────────────────────────

/**
 * Generate a complete, solvable Nonogram level.
 * Tries multiple times until a line-solvable puzzle is found.
 */
export function generateLevel(
    levelNumber: number,
    rand: () => number
): NonogramLevel {
    const config = getLevelConfig(levelNumber);
    const { gridSize, fillFraction } = config;

    for (let attempt = 0; attempt < 200; attempt++) {
        const solution = generateSolution(gridSize, fillFraction, rand);
        const { rowClues, colClues } = computeAllClues(solution);

        // Validate: puzzle must be solvable by constraint propagation
        const solved = solveNonogram(rowClues, colClues, gridSize);
        if (solved === null) continue; // not line-solvable, retry

        // Verify the solved result matches our solution
        const matches = solution.every((row, r) =>
            row.every((cell, c) => cell === solved[r][c])
        );
        if (!matches) continue; // solver found different solution — ambiguous

        return {
            levelNumber,
            gridSize,
            fillFraction: Math.round(fillFraction * 100) / 100,
            solution,
            rowClues,
            colClues,
        };
    }

    // Fallback: generate a trivial 5×5 puzzle with a simple pattern
    const fallbackSize = Math.min(gridSize, 5);
    const fallbackSolution: boolean[][] = Array.from(
        { length: fallbackSize },
        (_, r) =>
            Array.from({ length: fallbackSize }, (_, c) => (r + c) % 2 === 0)
    );
    const { rowClues, colClues } = computeAllClues(fallbackSolution);

    return {
        levelNumber,
        gridSize: fallbackSize,
        fillFraction: 0.5,
        solution: fallbackSolution,
        rowClues,
        colClues,
    };
}

// ─── Batch Generation ───────────────────────────────────────────

/**
 * Generate multiple levels deterministically.
 * Each level uses a seed derived from "Nonogram-level-{N}".
 */
export function generateLevels(
    startFrom: number,
    count: number
): NonogramLevel[] {
    const levels: NonogramLevel[] = [];
    for (let i = 0; i < count; i++) {
        const levelNumber = startFrom + i;
        const seed = hashString(`Nonogram-level-${levelNumber}`);
        const rand = createSeededRandom(seed);
        levels.push(generateLevel(levelNumber, rand));
    }
    return levels;
}
