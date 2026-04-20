/**
 * Pipe Connect — Level Generator
 *
 * Pure functions for generating valid pipe puzzle levels.
 * No Firestore dependency — used by seed script.
 */

// ─── Types ───────────────────────────────────────────────

export type PipeType = "straight" | "elbow" | "tPipe" | "cross";
export type Direction = "up" | "down" | "left" | "right";

export interface PipeCell {
    row: number;
    col: number;
    pipeType: PipeType;
    rotation: number; // 0-3
    isBlocked: boolean;
    isSource: boolean;
    isSink: boolean;
    isLocked: boolean;
}

export interface LevelConfig {
    gridSize: number;
    lives: number;
    difficulty: string;
    difficultyValue: number; // 1-10, for submitGameResult
    pipeTypes: PipeType[];
    trapPercent: number;
    wallPercent: number;
    lockedCount: number;
    pathDirectness: number;
    variableSourceSink: boolean;
}

export interface GeneratedLevel {
    levelNumber: number;
    gridSize: number;
    lives: number;
    difficulty: string;
    difficultyValue: number; // 1-10
    sourceRow: number;
    sourceCol: number;
    sinkRow: number;
    sinkCol: number;
    sourceDirection: Direction;
    sinkDirection: Direction;
    cells: PipeCell[];
    solution: {
        path: number[][];
        correctRotations: Record<string, number>;
    };
}

// ─── Pipe Connections ────────────────────────────────────

const PIPE_CONNECTIONS: Record<PipeType, Direction[][]> = {
    straight: [
        ["left", "right"],   // rot 0
        ["up", "down"],      // rot 1
        ["left", "right"],   // rot 2
        ["up", "down"],      // rot 3
    ],
    elbow: [
        ["up", "right"],     // rot 0
        ["right", "down"],   // rot 1
        ["down", "left"],    // rot 2
        ["left", "up"],      // rot 3
    ],
    tPipe: [
        ["up", "left", "right"],   // rot 0
        ["up", "right", "down"],   // rot 1
        ["down", "left", "right"], // rot 2
        ["up", "down", "left"],    // rot 3
    ],
    cross: [
        ["up", "down", "left", "right"],
        ["up", "down", "left", "right"],
        ["up", "down", "left", "right"],
        ["up", "down", "left", "right"],
    ],
};

function getConnections(pipeType: PipeType, rotation: number): Direction[] {
    return PIPE_CONNECTIONS[pipeType][rotation % 4];
}

const OPPOSITE: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
};

const DIR_DELTA: Record<Direction, [number, number]> = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
};

// ─── Level Tier Config ───────────────────────────────────

interface TierDef {
    minLevel: number;
    maxLevel: number;
    gridSize: number;
    lives: number;
    difficulty: string;
    difficultyRange: [number, number]; // [start, end] for 1-10 scale
    pipeTypes: PipeType[];
    trapRange: [number, number];       // [start%, end%]
    wallRange: [number, number];
    lockedRange: [number, number];
    directnessRange: [number, number]; // [start, end] — decreases = harder
    variableSourceSink: boolean;
}

const LEVEL_TIERS: TierDef[] = [
    {
        minLevel: 1, maxLevel: 3,
        gridSize: 4, lives: 5, difficulty: "tutorial",
        difficultyRange: [1, 2],
        pipeTypes: ["straight", "elbow"],
        trapRange: [0.08, 0.15], wallRange: [0.10, 0.18],
        lockedRange: [0, 0], directnessRange: [0.55, 0.45],
        variableSourceSink: false,
    },
    {
        minLevel: 4, maxLevel: 10,
        gridSize: 5, lives: 5, difficulty: "beginner",
        difficultyRange: [2, 3],
        pipeTypes: ["straight", "elbow", "tPipe"],
        trapRange: [0.10, 0.18], wallRange: [0.08, 0.15],
        lockedRange: [0, 0], directnessRange: [0.65, 0.50],
        variableSourceSink: false,
    },
    {
        minLevel: 11, maxLevel: 20,
        gridSize: 6, lives: 4, difficulty: "easy",
        difficultyRange: [3, 4],
        pipeTypes: ["straight", "elbow", "tPipe", "cross"],
        trapRange: [0.12, 0.22], wallRange: [0.10, 0.15],
        lockedRange: [0, 0], directnessRange: [0.55, 0.40],
        variableSourceSink: true,
    },
    {
        minLevel: 21, maxLevel: 35,
        gridSize: 7, lives: 4, difficulty: "medium",
        difficultyRange: [4, 5],
        pipeTypes: ["straight", "elbow", "tPipe", "cross"],
        trapRange: [0.15, 0.28], wallRange: [0.10, 0.15],
        lockedRange: [1, 2], directnessRange: [0.45, 0.35],
        variableSourceSink: true,
    },
    {
        minLevel: 36, maxLevel: 55,
        gridSize: 8, lives: 3, difficulty: "hard",
        difficultyRange: [5, 6],
        pipeTypes: ["straight", "elbow", "tPipe", "cross"],
        trapRange: [0.22, 0.38], wallRange: [0.12, 0.18],
        lockedRange: [2, 3], directnessRange: [0.40, 0.30],
        variableSourceSink: true,
    },
    {
        minLevel: 56, maxLevel: 80,
        gridSize: 9, lives: 2, difficulty: "expert",
        difficultyRange: [6, 7],
        pipeTypes: ["straight", "elbow", "tPipe", "cross"],
        trapRange: [0.30, 0.45], wallRange: [0.15, 0.22],
        lockedRange: [3, 4], directnessRange: [0.30, 0.22],
        variableSourceSink: true,
    },
    {
        minLevel: 81, maxLevel: 120,
        gridSize: 10, lives: 2, difficulty: "master",
        difficultyRange: [7, 8],
        pipeTypes: ["straight", "elbow", "tPipe", "cross"],
        trapRange: [0.40, 0.55], wallRange: [0.18, 0.25],
        lockedRange: [4, 5], directnessRange: [0.22, 0.15],
        variableSourceSink: true,
    },
    {
        minLevel: 121, maxLevel: 170,
        gridSize: 11, lives: 2, difficulty: "master",
        difficultyRange: [8, 9],
        pipeTypes: ["straight", "elbow", "tPipe", "cross"],
        trapRange: [0.45, 0.60], wallRange: [0.20, 0.28],
        lockedRange: [5, 6], directnessRange: [0.15, 0.10],
        variableSourceSink: true,
    },
    {
        minLevel: 171, maxLevel: 1000,
        gridSize: 12, lives: 1, difficulty: "master",
        difficultyRange: [9, 10],
        pipeTypes: ["straight", "elbow", "tPipe", "cross"],
        trapRange: [0.55, 0.70], wallRange: [0.22, 0.30],
        lockedRange: [6, 8], directnessRange: [0.10, 0.05],
        variableSourceSink: true,
    },
];

export const TOTAL_PIPE_LEVELS = 1000;

/**
 * Interpolate config values based on level position within its tier.
 * Level at tier start = min values, level at tier end = max values.
 */
export function getTierConfig(levelNumber: number): LevelConfig | null {
    for (const tier of LEVEL_TIERS) {
        if (levelNumber >= tier.minLevel && levelNumber <= tier.maxLevel) {
            const range = tier.maxLevel - tier.minLevel;
            const progress = range > 0
                ? (levelNumber - tier.minLevel) / range
                : 0;

            const lerp = (a: number, b: number) =>
                Math.round((a + (b - a) * progress) * 1000) / 1000;
            const lerpInt = (a: number, b: number) =>
                Math.round(a + (b - a) * progress);

            return {
                gridSize: tier.gridSize,
                lives: tier.lives,
                difficulty: tier.difficulty,
                difficultyValue: lerpInt(tier.difficultyRange[0], tier.difficultyRange[1]),
                pipeTypes: [...tier.pipeTypes],
                trapPercent: lerp(tier.trapRange[0], tier.trapRange[1]),
                wallPercent: lerp(tier.wallRange[0], tier.wallRange[1]),
                lockedCount: lerpInt(tier.lockedRange[0], tier.lockedRange[1]),
                pathDirectness: lerp(tier.directnessRange[0], tier.directnessRange[1]),
                variableSourceSink: tier.variableSourceSink,
            };
        }
    }
    return null;
}

// ─── Path Generation ─────────────────────────────────────

interface PathResult {
    path: [number, number][];
    directions: Direction[]; // direction FROM prev cell TO this cell
}

/**
 * Pick source/sink positions on grid edges.
 * Source is ALWAYS on the left edge, sink is ALWAYS on the right edge.
 * When variable=true, the row positions are randomized.
 */
function pickSourceSink(
    size: number,
    variable: boolean
): {
    sourceRow: number; sourceCol: number; sourceDir: Direction;
    sinkRow: number; sinkCol: number; sinkDir: Direction;
} {
    if (!variable) {
        // Center left → center right
        const mid = Math.floor(size / 2);
        return {
            sourceRow: mid, sourceCol: 0, sourceDir: "left",
            sinkRow: mid, sinkCol: size - 1, sinkDir: "right",
        };
    }

    // Variable: random row on left edge → random row on right edge
    const sourceRow = Math.floor(Math.random() * size);
    const sinkRow = Math.floor(Math.random() * size);

    return {
        sourceRow, sourceCol: 0, sourceDir: "left",
        sinkRow, sinkCol: size - 1, sinkDir: "right",
    };
}

/**
 * Generate a path from source to sink using random walk.
 * pathDirectness controls bias toward target (0=random, 1=straight).
 */
function generatePath(
    size: number,
    srcRow: number, srcCol: number,
    dstRow: number, dstCol: number,
    directness: number
): PathResult | null {
    const allDirs: Direction[] = ["up", "down", "left", "right"];
    const visited = new Set<string>();
    const path: [number, number][] = [[srcRow, srcCol]];
    const directions: Direction[] = [];
    visited.add(`${srcRow},${srcCol}`);

    let row = srcRow;
    let col = srcCol;
    const maxSteps = size * size;

    for (let step = 0; step < maxSteps; step++) {
        if (row === dstRow && col === dstCol) {
            return { path, directions };
        }

        // Collect valid neighbor candidates
        const candidates: { dir: Direction; nr: number; nc: number }[] = [];
        const towardSink: { dir: Direction; nr: number; nc: number }[] = [];
        const awayFromSink: { dir: Direction; nr: number; nc: number }[] = [];

        const currentDist = Math.abs(row - dstRow) + Math.abs(col - dstCol);

        for (const dir of allDirs) {
            const [dr, dc] = DIR_DELTA[dir];
            const nr = row + dr;
            const nc = col + dc;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
            if (visited.has(`${nr},${nc}`)) continue;

            const newDist = Math.abs(nr - dstRow) + Math.abs(nc - dstCol);
            const entry = { dir, nr, nc };
            candidates.push(entry);
            if (newDist < currentDist) {
                towardSink.push(entry);
            } else {
                awayFromSink.push(entry);
            }
        }

        if (candidates.length === 0) {
            // Dead end — backtrack
            if (path.length <= 1) return null;
            path.pop();
            directions.pop();
            const prev = path[path.length - 1];
            row = prev[0];
            col = prev[1];
            continue;
        }

        // Weighted random: `directness` chance to go toward sink,
        // `(1-directness)` chance to pick any random direction
        let chosen: { dir: Direction; nr: number; nc: number };
        if (towardSink.length > 0 && Math.random() < directness) {
            chosen = towardSink[Math.floor(Math.random() * towardSink.length)];
        } else if (awayFromSink.length > 0 && Math.random() > directness) {
            chosen = awayFromSink[Math.floor(Math.random() * awayFromSink.length)];
        } else {
            chosen = candidates[Math.floor(Math.random() * candidates.length)];
        }

        path.push([chosen.nr, chosen.nc]);
        directions.push(chosen.dir);
        visited.add(`${chosen.nr},${chosen.nc}`);
        row = chosen.nr;
        col = chosen.nc;
    }

    // Check if we ended at destination
    if (row === dstRow && col === dstCol) {
        return { path, directions };
    }
    return null;
}

// ─── Pipe Fitting ────────────────────────────────────────

/**
 * Find the pipe type and rotation that connects the given directions.
 */
function findPipeAndRotation(
    requiredDirs: Direction[],
    allowedTypes: PipeType[]
): { pipeType: PipeType; rotation: number } | null {
    const reqSet = new Set(requiredDirs);

    for (const pipeType of allowedTypes) {
        for (let rot = 0; rot < 4; rot++) {
            const conns = new Set(getConnections(pipeType, rot));
            // All required directions must be in connections
            if (requiredDirs.every((d) => conns.has(d))) {
                // Prefer exact match (same number of connections)
                if (conns.size === reqSet.size) {
                    return { pipeType, rotation: rot };
                }
            }
        }
    }

    // If no exact match, allow superset (more connections than needed)
    for (const pipeType of allowedTypes) {
        for (let rot = 0; rot < 4; rot++) {
            const conns = new Set(getConnections(pipeType, rot));
            if (requiredDirs.every((d) => conns.has(d))) {
                return { pipeType, rotation: rot };
            }
        }
    }

    return null;
}

/**
 * Get a random wrong rotation for a pipe (different from correct).
 */
function getWrongRotation(correctRot: number, pipeType: PipeType): number {
    // Cross pipe — all rotations are equivalent, just return 0
    if (pipeType === "cross") return correctRot;

    // Straight pipe — only 2 distinct rotations (0/2 and 1/3)
    if (pipeType === "straight") {
        return correctRot % 2 === 0 ? 1 : 0;
    }

    // elbow, tPipe — pick a different rotation
    const options = [0, 1, 2, 3].filter((r) => r !== correctRot);
    return options[Math.floor(Math.random() * options.length)];
}

// ─── Main Generator ──────────────────────────────────────

export function generateLevel(levelNumber: number): GeneratedLevel | null {
    const config = getTierConfig(levelNumber);
    if (!config) return null;

    const size = config.gridSize;

    // Pick source/sink
    const positions = pickSourceSink(size, config.variableSourceSink);
    const {
        sourceRow, sourceCol, sourceDir,
        sinkRow, sinkCol, sinkDir,
    } = positions;

    // Minimum path length based on grid size to prevent trivially easy levels
    // 4×4 → min 6, 5×5 → min 8, 6×6 → min 10, 7×7 → min 12, etc.
    const minPathLength = Math.max(6, size + Math.floor(size / 2));

    // Generate a random path — take the first one meeting minimum length
    let bestPath: PathResult | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
        const result = generatePath(
            size, sourceRow, sourceCol, sinkRow, sinkCol,
            config.pathDirectness
        );
        if (result && result.path.length >= minPathLength) {
            bestPath = result;
            break; // Take first valid path meeting minimum
        }
        // Keep best attempt as fallback
        if (result && (!bestPath || result.path.length > bestPath.path.length)) {
            bestPath = result;
        }
    }

    if (!bestPath) return null;

    const { path, directions } = bestPath;
    const pathSet = new Set(path.map(([r, c]) => `${r},${c}`));

    // Initialize grid
    const grid: PipeCell[][] = [];
    for (let r = 0; r < size; r++) {
        grid[r] = [];
        for (let c = 0; c < size; c++) {
            grid[r][c] = {
                row: r, col: c,
                pipeType: "straight",
                rotation: 0,
                isBlocked: false,
                isSource: r === sourceRow && c === sourceCol,
                isSink: r === sinkRow && c === sinkCol,
                isLocked: false,
            };
        }
    }

    // Place pipes along path
    const correctRotations: Record<string, number> = {};

    for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        const requiredDirs: Direction[] = [];

        if (i === 0) {
            // Source: connect from sourceDirection + to next cell
            requiredDirs.push(sourceDir);
            if (i < path.length - 1) {
                requiredDirs.push(directions[i]); // direction to next
            }
        } else if (i === path.length - 1) {
            // Sink: connect from previous + to sinkDirection
            requiredDirs.push(OPPOSITE[directions[i - 1]]); // came from
            requiredDirs.push(sinkDir);
        } else {
            // Middle: connect from previous + to next
            requiredDirs.push(OPPOSITE[directions[i - 1]]); // came from
            requiredDirs.push(directions[i]); // going to
        }

        const fit = findPipeAndRotation(requiredDirs, config.pipeTypes);
        if (!fit) {
            // Fallback: try all pipe types
            const allTypes: PipeType[] = ["straight", "elbow", "tPipe", "cross"];
            const fallback = findPipeAndRotation(requiredDirs, allTypes);
            if (!fallback) return null; // Can't fit — regenerate
            grid[r][c].pipeType = fallback.pipeType;
            grid[r][c].rotation = fallback.rotation;
        } else {
            grid[r][c].pipeType = fit.pipeType;
            grid[r][c].rotation = fit.rotation;
        }

        correctRotations[`${r},${c}`] = grid[r][c].rotation;
    }

    // Place trap pipes (path neighbors that mislead)
    const nonPathCells: [number, number][] = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (!pathSet.has(`${r},${c}`)) {
                nonPathCells.push([r, c]);
            }
        }
    }

    // Shuffle non-path cells
    shuffleArray(nonPathCells);

    const totalNonPath = nonPathCells.length;
    const trapCount = Math.floor(totalNonPath * config.trapPercent);
    const wallCount = Math.floor(totalNonPath * config.wallPercent);

    // Find path-adjacent cells for traps
    const pathAdjacentCells: [number, number][] = [];
    const otherCells: [number, number][] = [];

    for (const [r, c] of nonPathCells) {
        let isAdjacent = false;
        for (const dir of Object.values(DIR_DELTA)) {
            const nr = r + dir[0];
            const nc = c + dir[1];
            if (pathSet.has(`${nr},${nc}`)) {
                isAdjacent = true;
                break;
            }
        }
        if (isAdjacent) {
            pathAdjacentCells.push([r, c]);
        } else {
            otherCells.push([r, c]);
        }
    }

    // Place traps (path-adjacent cells with misleading connections)
    let trapsPlaced = 0;
    for (const [r, c] of pathAdjacentCells) {
        if (trapsPlaced >= trapCount) break;
        // Find a path neighbor direction and create a pipe pointing toward it
        for (const [dirName, [dr, dc]] of Object.entries(DIR_DELTA)) {
            const nr = r + dr;
            const nc = c + dc;
            if (pathSet.has(`${nr},${nc}`)) {
                const trapDirs: Direction[] = [dirName as Direction];
                // Add one more random direction for a more realistic pipe
                const otherDirs = (["up", "down", "left", "right"] as Direction[])
                    .filter((d) => d !== dirName);
                trapDirs.push(otherDirs[Math.floor(Math.random() * otherDirs.length)]);

                const fit = findPipeAndRotation(trapDirs, config.pipeTypes);
                if (fit) {
                    grid[r][c].pipeType = fit.pipeType;
                    grid[r][c].rotation = fit.rotation;
                    trapsPlaced++;
                }
                break;
            }
        }
    }

    // Place walls
    let wallsPlaced = 0;
    const remainingCells = [
        ...pathAdjacentCells.slice(trapsPlaced),
        ...otherCells,
    ];
    for (const [r, c] of remainingCells) {
        if (wallsPlaced >= wallCount) break;
        grid[r][c].isBlocked = true;
        grid[r][c].pipeType = "straight";
        grid[r][c].rotation = 0;
        wallsPlaced++;
    }

    // Fill remaining non-path, non-wall cells with random pipes
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (pathSet.has(`${r},${c}`)) continue;
            if (grid[r][c].isBlocked) continue;
            // Skip traps already placed
            if (grid[r][c].pipeType !== "straight" || grid[r][c].rotation !== 0) {
                // Already filled by trap logic — check if actually modified
                const key = `${r},${c}`;
                if (!correctRotations[key]) continue;
            }
            const randType = config.pipeTypes[
                Math.floor(Math.random() * config.pipeTypes.length)
            ];
            grid[r][c].pipeType = randType;
            grid[r][c].rotation = Math.floor(Math.random() * 4);
        }
    }

    // Place locked pipes (random path cells, keep correct rotation)
    if (config.lockedCount > 0) {
        // Don't lock source or sink
        const lockablePath = path.filter(
            ([r, c]) =>
                !(r === sourceRow && c === sourceCol) &&
                !(r === sinkRow && c === sinkCol)
        );
        shuffleArray(lockablePath);
        const toLock = Math.min(config.lockedCount, lockablePath.length);
        for (let i = 0; i < toLock; i++) {
            const [r, c] = lockablePath[i];
            grid[r][c].isLocked = true;
            // Keep correct rotation (don't scramble later)
        }
    }

    // Scramble path rotations (except locked cells)
    for (const [r, c] of path) {
        if (grid[r][c].isLocked) continue;
        const correctRot = correctRotations[`${r},${c}`];
        grid[r][c].rotation = getWrongRotation(correctRot, grid[r][c].pipeType);
    }

    // Flatten cells
    const cells: PipeCell[] = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            cells.push(grid[r][c]);
        }
    }

    return {
        levelNumber,
        gridSize: size,
        lives: config.lives,
        difficulty: config.difficulty,
        difficultyValue: config.difficultyValue,
        sourceRow,
        sourceCol,
        sinkRow,
        sinkCol,
        sourceDirection: sourceDir,
        sinkDirection: sinkDir,
        cells,
        solution: {
            path: path.map(([r, c]) => [r, c]),
            correctRotations,
        },
    };
}

// ─── Helpers ─────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
