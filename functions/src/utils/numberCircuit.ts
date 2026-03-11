/**
 * Number Circuit — Level Generator
 *
 * Procedural level generation engine for the Number Circuit puzzle.
 * Used server-side for daily challenge generation.
 * The same algorithm is mirrored client-side for local play.
 */

import {
    GridSize,
    Position,
    Operator,
    SpecialTile,
    PathStep,
    Hints,
    NumberCircuitLevel,
    LevelConfig,
} from "../types/numberCircuitTypes";

// ─── Seeded Random ──────────────────────────────────────────────

/**
 * Simple seeded PRNG (mulberry32).
 * Allows deterministic generation from a seed (e.g. date string hash).
 */
export function createSeededRandom(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Hash a string into a 32-bit integer for seeding */
export function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        hash = ((hash << 5) - hash + ch) | 0;
    }
    return hash;
}

// ─── Level Config ───────────────────────────────────────────────

export function getLevelConfig(levelNumber: number): LevelConfig {
    if (levelNumber <= 10) {
        return {
            gridSize: 3,
            allowedOperators: ["+", "-"],
            minPathLength: 2,
            maxPathLength: 3,
            specialTileTypes: [],
            maxSpecialTiles: 0,
        };
    }
    if (levelNumber <= 25) {
        return {
            gridSize: 4,
            allowedOperators: ["+", "-", "×"],
            minPathLength: 2,
            maxPathLength: 4,
            specialTileTypes: ["locked"],
            maxSpecialTiles: 1,
        };
    }
    if (levelNumber <= 60) {
        return {
            gridSize: 5,
            allowedOperators: ["+", "-", "×", "÷"],
            minPathLength: 3,
            maxPathLength: 5,
            specialTileTypes: ["locked", "multiplier", "bomb"],
            maxSpecialTiles: 2,
        };
    }
    return {
        gridSize: 6,
        allowedOperators: ["+", "-", "×", "÷", "^", "combine"],
        minPathLength: 3,
        maxPathLength: 6,
        specialTileTypes: ["locked", "multiplier", "forcedOperator", "bomb"],
        maxSpecialTiles: 3,
    };
}

// ─── Grid Generation ────────────────────────────────────────────

export function generateGrid(size: GridSize, rand: () => number): number[][] {
    const grid: number[][] = [];
    for (let r = 0; r < size; r++) {
        const row: number[] = [];
        for (let c = 0; c < size; c++) {
            row.push(Math.floor(rand() * 9) + 1); // 1–9
        }
        grid.push(row);
    }
    return grid;
}

// ─── Path Generation ────────────────────────────────────────────

/** Get all adjacent positions (horizontal, vertical, diagonal) */
function getNeighbors(pos: Position, size: GridSize): Position[] {
    const neighbors: Position[] = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = pos.row + dr;
            const nc = pos.col + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                neighbors.push({ row: nr, col: nc });
            }
        }
    }
    return neighbors;
}

/** Check if a position is already in the visited set */
function isVisited(pos: Position, visited: Set<string>): boolean {
    return visited.has(`${pos.row},${pos.col}`);
}

/**
 * Generate a random walk on the grid.
 * Returns list of positions (no repeats, all adjacent).
 */
export function generatePath(
    size: GridSize,
    minLength: number,
    maxLength: number,
    rand: () => number
): Position[] {
    const targetLength = minLength + Math.floor(rand() * (maxLength - minLength + 1));

    // Try multiple starting points to find a valid path
    for (let attempt = 0; attempt < 50; attempt++) {
        const startRow = Math.floor(rand() * size);
        const startCol = Math.floor(rand() * size);
        const path: Position[] = [{ row: startRow, col: startCol }];
        const visited = new Set<string>([`${startRow},${startCol}`]);

        while (path.length < targetLength) {
            const current = path[path.length - 1];
            const neighbors = getNeighbors(current, size)
                .filter((n) => !isVisited(n, visited));

            if (neighbors.length === 0) break; // Dead end

            const next = neighbors[Math.floor(rand() * neighbors.length)];
            path.push(next);
            visited.add(`${next.row},${next.col}`);
        }

        if (path.length >= minLength) {
            return path;
        }
    }

    // Fallback: simple 2-cell horizontal path
    return [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
    ];
}

// ─── Operator Assignment ────────────────────────────────────────

export function assignOperators(
    pathLength: number,
    allowedOperators: Operator[],
    rand: () => number
): Operator[] {
    const operators: Operator[] = [];
    for (let i = 0; i < pathLength - 1; i++) {
        const op = allowedOperators[Math.floor(rand() * allowedOperators.length)];
        operators.push(op);
    }
    return operators;
}

// ─── Expression Evaluation ──────────────────────────────────────

/**
 * Evaluate an expression with proper math precedence.
 * × ÷ ^ are evaluated before + −
 * "combine" concatenates digits: 1 combine 2 = 12
 */
export function evaluateExpression(values: number[], operators: Operator[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];

    // First pass: resolve "combine" (digit concatenation)
    let nums = [...values];
    let ops = [...operators];

    let i = 0;
    while (i < ops.length) {
        if (ops[i] === "combine") {
            const combined = parseInt(`${nums[i]}${nums[i + 1]}`, 10);
            nums.splice(i, 2, combined);
            ops.splice(i, 1);
        } else {
            i++;
        }
    }

    // Second pass: resolve ^ (exponentiation), × (multiply), ÷ (divide)
    i = 0;
    while (i < ops.length) {
        if (ops[i] === "^" || ops[i] === "×" || ops[i] === "÷") {
            let result: number;
            if (ops[i] === "^") {
                result = Math.pow(nums[i], nums[i + 1]);
            } else if (ops[i] === "×") {
                result = nums[i] * nums[i + 1];
            } else {
                result = nums[i] / nums[i + 1];
            }
            nums.splice(i, 2, result);
            ops.splice(i, 1);
        } else {
            i++;
        }
    }

    // Third pass: resolve + and −
    let result = nums[0];
    for (i = 0; i < ops.length; i++) {
        if (ops[i] === "+") {
            result += nums[i + 1];
        } else if (ops[i] === "-") {
            result -= nums[i + 1];
        }
    }

    return result;
}

// ─── Special Tiles ──────────────────────────────────────────────

export function generateSpecialTiles(
    grid: number[][],
    path: Position[],
    config: LevelConfig,
    rand: () => number
): SpecialTile[] {
    if (config.specialTileTypes.length === 0 || config.maxSpecialTiles === 0) {
        return [];
    }

    const tiles: SpecialTile[] = [];
    const count = Math.min(
        Math.floor(rand() * config.maxSpecialTiles) + 1,
        config.specialTileTypes.length
    );

    const usedPositions = new Set<string>();

    for (let t = 0; t < count; t++) {
        const tileType = config.specialTileTypes[
            Math.floor(rand() * config.specialTileTypes.length)
        ];

        // Pick a position on the path for locked/bomb, anywhere for others
        let pos: Position;
        if (tileType === "locked" || tileType === "bomb") {
            const pathIndex = Math.floor(rand() * path.length);
            pos = path[pathIndex];
        } else {
            pos = {
                row: Math.floor(rand() * config.gridSize),
                col: Math.floor(rand() * config.gridSize),
            };
        }

        const key = `${pos.row},${pos.col}`;
        if (usedPositions.has(key)) continue;
        usedPositions.add(key);

        const tile: SpecialTile = { position: pos, type: tileType };

        if (tileType === "multiplier") {
            tile.value = rand() < 0.5 ? 2 : 3;
        } else if (tileType === "forcedOperator") {
            const ops: Operator[] = ["+", "-", "×"];
            tile.value = ops[Math.floor(rand() * ops.length)];
        }

        tiles.push(tile);
    }

    return tiles;
}

// ─── Hints ──────────────────────────────────────────────────────

export function generateHints(path: Position[], operators: Operator[]): Hints {
    return {
        hint1: { position: path[0] },
        hint2: { positions: [path[0], path[1]] },
        hint3: {
            positions: [path[0], path[1]],
            operator: operators[0],
        },
    };
}

// ─── Expression String ─────────────────────────────────────────

export function buildExpressionString(
    grid: number[][],
    path: Position[],
    operators: Operator[]
): string {
    const parts: string[] = [];
    for (let i = 0; i < path.length; i++) {
        if (i > 0) {
            const op = operators[i - 1];
            if (op === "combine") {
                // No operator symbol for digit combine — just concatenate
            } else {
                parts.push(op === "÷" ? "÷" : op);
            }
        }
        parts.push(String(grid[path[i].row][path[i].col]));
    }
    return parts.join(" ");
}

// ─── Main Generator ────────────────────────────────────────────

/**
 * Generate a complete Number Circuit level.
 * Tries to produce a level with a "nice" integer target.
 */
export function generateLevel(
    levelNumber: number,
    rand: () => number
): NumberCircuitLevel {
    const config = getLevelConfig(levelNumber);

    // Try multiple times to get a clean integer target
    for (let attempt = 0; attempt < 100; attempt++) {
        const grid = generateGrid(config.gridSize, rand);
        const positions = generatePath(
            config.gridSize,
            config.minPathLength,
            config.maxPathLength,
            rand
        );
        const operators = assignOperators(
            positions.length,
            config.allowedOperators,
            rand
        );

        // Extract values from grid along the path
        const values = positions.map((p) => grid[p.row][p.col]);
        const target = evaluateExpression(values, operators);

        // Skip non-integer, negative, zero, or very large targets
        if (
            !Number.isInteger(target) ||
            target <= 0 ||
            target > 9999
        ) {
            continue;
        }

        const specialTiles = generateSpecialTiles(grid, positions, config, rand);
        const hints = generateHints(positions, operators);

        const solution: PathStep[] = positions.map((pos, i) => ({
            position: pos,
            operator: i > 0 ? operators[i - 1] : undefined,
        }));

        const solutionExpression = buildExpressionString(grid, positions, operators);

        return {
            grid,
            gridSize: config.gridSize,
            target,
            allowedOperators: config.allowedOperators,
            specialTiles,
            solution,
            solutionExpression,
            hints,
        };
    }

    // Ultimate fallback: guaranteed simple level
    const grid = generateGrid(config.gridSize, rand);
    const pos0: Position = { row: 0, col: 0 };
    const pos1: Position = { row: 0, col: 1 };
    const v0 = grid[0][0];
    const v1 = grid[0][1];

    return {
        grid,
        gridSize: config.gridSize,
        target: v0 + v1,
        allowedOperators: config.allowedOperators,
        specialTiles: [],
        solution: [
            { position: pos0 },
            { position: pos1, operator: "+" },
        ],
        solutionExpression: `${v0} + ${v1}`,
        hints: {
            hint1: { position: pos0 },
            hint2: { positions: [pos0, pos1] },
            hint3: { positions: [pos0, pos1], operator: "+" },
        },
    };
}

// ─── Daily Challenge ────────────────────────────────────────────

/**
 * Generate a deterministic daily challenge from a date string.
 * Uses the date as the PRNG seed so every player gets the same puzzle.
 */
export function generateDailyChallenge(dateString: string): NumberCircuitLevel {
    const seed = hashString(`NumberCircuit-${dateString}`);
    const rand = createSeededRandom(seed);
    // Daily challenge = medium difficulty (level ~30)
    return generateLevel(30, rand);
}
