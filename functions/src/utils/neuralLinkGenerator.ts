/**
 * Neural Link — Level Generator
 *
 * Generates Flow/NumberLink puzzles:
 * 1. Generate flow paths that fill the grid
 * 2. Place dead neurons (obstacles)
 * 3. Extract endpoints from each flow
 * 4. Validate: all non-dead cells covered, no overlaps
 *
 * 500 levels, dead neurons from level 1 for engagement.
 */

// ─── Types ───────────────────────────────────────────────

export interface NeuralLinkLevel {
    levelNumber: number;
    gridSize: number;
    flowCount: number;
    deadNeuronCount: number;
    difficulty: string;
    difficultyValue: number;
    endpoints: number[][][]; // endpoints[i] = [[r1,c1], [r2,c2]]
    deadCells: number[][];   // [[r,c], ...]
    solution: number[][][];  // solution[i] = [[r,c], [r,c], ...]
}

interface TierDef {
    minLevel: number;
    maxLevel: number;
    gridSize: number;
    difficulty: string;
    difficultyRange: [number, number];
    flowRange: [number, number];
    deadRange: [number, number];
    /** Multiplier for minimum path length: higher = longer winding paths = harder */
    minPathMult: [number, number];
}

// ─── Difficulty Tiers (500 levels) ───────────────────────
// Progressive difficulty WITHIN each tier: dead neurons, flow count,
// and path complexity all ramp up throughout each tier.

const LEVEL_TIERS: TierDef[] = [
    {
        minLevel: 1, maxLevel: 30,
        gridSize: 5, difficulty: "beginner",
        difficultyRange: [1, 2],
        flowRange: [3, 4], deadRange: [1, 3],
        minPathMult: [0.6, 0.75],
    },
    {
        minLevel: 31, maxLevel: 60,
        gridSize: 5, difficulty: "easy",
        difficultyRange: [2, 3],
        flowRange: [4, 4], deadRange: [2, 4],
        minPathMult: [0.7, 0.8],
    },
    {
        minLevel: 61, maxLevel: 100,
        gridSize: 6, difficulty: "intermediate",
        difficultyRange: [3, 4],
        flowRange: [4, 5], deadRange: [2, 5],
        minPathMult: [0.65, 0.8],
    },
    {
        minLevel: 101, maxLevel: 150,
        gridSize: 6, difficulty: "medium",
        difficultyRange: [4, 5],
        flowRange: [5, 6], deadRange: [3, 5],
        minPathMult: [0.7, 0.85],
    },
    {
        minLevel: 151, maxLevel: 200,
        gridSize: 7, difficulty: "advanced",
        difficultyRange: [5, 6],
        flowRange: [5, 6], deadRange: [3, 6],
        minPathMult: [0.65, 0.8],
    },
    {
        minLevel: 201, maxLevel: 260,
        gridSize: 7, difficulty: "hard",
        difficultyRange: [6, 7],
        flowRange: [6, 7], deadRange: [4, 7],
        minPathMult: [0.7, 0.85],
    },
    {
        minLevel: 261, maxLevel: 330,
        gridSize: 8, difficulty: "expert",
        difficultyRange: [7, 8],
        flowRange: [6, 7], deadRange: [3, 6],
        minPathMult: [0.65, 0.8],
    },
    {
        minLevel: 331, maxLevel: 400,
        gridSize: 8, difficulty: "master",
        difficultyRange: [8, 9],
        flowRange: [7, 8], deadRange: [4, 7],
        minPathMult: [0.7, 0.85],
    },
    {
        minLevel: 401, maxLevel: 450,
        gridSize: 9, difficulty: "grandmaster",
        difficultyRange: [9, 10],
        flowRange: [7, 8], deadRange: [5, 8],
        minPathMult: [0.65, 0.8],
    },
    {
        minLevel: 451, maxLevel: 500,
        gridSize: 10, difficulty: "legend",
        difficultyRange: [10, 10],
        flowRange: [8, 9], deadRange: [6, 9],
        minPathMult: [0.65, 0.8],
    },
];

export const TOTAL_NEURAL_LINK_LEVELS = 500;

// ─── Config ──────────────────────────────────────────────

interface LevelConfig {
    gridSize: number;
    difficulty: string;
    difficultyValue: number;
    flowCount: number;
    deadCount: number;
    minPathMultiplier: number;
}

export function getTierConfig(levelNumber: number): LevelConfig | null {
    for (const tier of LEVEL_TIERS) {
        if (levelNumber >= tier.minLevel && levelNumber <= tier.maxLevel) {
            const range = tier.maxLevel - tier.minLevel;
            const progress = range > 0
                ? (levelNumber - tier.minLevel) / range
                : 0;

            const lerpInt = (a: number, b: number) =>
                Math.round(a + (b - a) * progress);
            const lerp = (a: number, b: number) =>
                Math.round((a + (b - a) * progress) * 100) / 100;

            return {
                gridSize: tier.gridSize,
                difficulty: tier.difficulty,
                difficultyValue: lerpInt(tier.difficultyRange[0], tier.difficultyRange[1]),
                flowCount: lerpInt(tier.flowRange[0], tier.flowRange[1]),
                deadCount: lerpInt(tier.deadRange[0], tier.deadRange[1]),
                minPathMultiplier: lerp(tier.minPathMult[0], tier.minPathMult[1]),
            };
        }
    }
    return null;
}

// ─── Grid Helpers ────────────────────────────────────────

type Cell = [number, number];

function cellKey(r: number, c: number): string {
    return `${r},${c}`;
}

function getNeighbors(r: number, c: number, n: number): Cell[] {
    const result: Cell[] = [];
    if (r > 0) result.push([r - 1, c]);
    if (r < n - 1) result.push([r + 1, c]);
    if (c > 0) result.push([r, c - 1]);
    if (c < n - 1) result.push([r, c + 1]);
    return result;
}

/**
 * Check if removing a cell from the free set would isolate any remaining free cells.
 */
function wouldIsolate(
    freeSet: Set<string>,
    removing: string,
    n: number
): boolean {
    const remaining = new Set(freeSet);
    remaining.delete(removing);

    if (remaining.size === 0) return false;

    const start = remaining.values().next().value;
    if (!start) return false;
    const visited = new Set<string>();
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const [r, c] = curr.split(",").map(Number);
        for (const [nr, nc] of getNeighbors(r, c, n)) {
            const nk = cellKey(nr, nc);
            if (remaining.has(nk) && !visited.has(nk)) {
                visited.add(nk);
                queue.push(nk);
            }
        }
    }

    return visited.size !== remaining.size;
}

// ─── Flow Generation ─────────────────────────────────────

/**
 * Generate flow paths that fill the grid (minus dead cells).
 * minPathMult controls minimum path length as fraction of grid size.
 */
function generateFlowPaths(
    n: number,
    flowCount: number,
    deadCount: number,
    minPathMult: number
): { paths: Cell[][]; deadCells: Cell[] } | null {

    // Initialize free cells
    const freeSet = new Set<string>();
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            freeSet.add(cellKey(r, c));
        }
    }

    // 1. Place dead neurons
    const deadCells: Cell[] = [];
    const freeCellsList = [...freeSet];
    shuffleArray(freeCellsList);

    for (let i = 0; i < deadCount && freeCellsList.length > 0; i++) {
        let placed = false;
        for (let j = i; j < freeCellsList.length; j++) {
            const key = freeCellsList[j];
            if (!wouldIsolate(freeSet, key, n)) {
                freeSet.delete(key);
                const [r, c] = key.split(",").map(Number);
                deadCells.push([r, c]);
                [freeCellsList[i], freeCellsList[j]] = [freeCellsList[j], freeCellsList[i]];
                placed = true;
                break;
            }
        }
        if (!placed) break;
    }

    const totalUsable = freeSet.size;
    if (totalUsable < flowCount * 3) return null;

    // 2. Generate flow paths — minPathLen scales with difficulty
    const paths: Cell[][] = [];
    const minPathLen = Math.max(3, Math.ceil(n * minPathMult));
    const maxPathLen = Math.max(minPathLen + 3, n * 2);

    for (let f = 0; f < flowCount; f++) {
        const freeArr = [...freeSet];
        shuffleArray(freeArr);

        let bestPath: Cell[] | null = null;

        for (let startIdx = 0; startIdx < Math.min(freeArr.length, 15); startIdx++) {
            const startKey = freeArr[startIdx];
            const [sr, sc] = startKey.split(",").map(Number);

            // Random walk
            const path: Cell[] = [[sr, sc]];
            const pathSet = new Set<string>([startKey]);
            const tempFree = new Set(freeSet);
            tempFree.delete(startKey);

            const targetLen = minPathLen + Math.floor(Math.random() * (maxPathLen - minPathLen + 1));

            for (let step = 0; step < targetLen - 1; step++) {
                const [cr, cc] = path[path.length - 1];
                const neighbors = getNeighbors(cr, cc, n);
                shuffleArray(neighbors);

                let moved = false;
                for (const [nr, nc] of neighbors) {
                    const nk = cellKey(nr, nc);
                    if (!tempFree.has(nk)) continue;
                    if (pathSet.has(nk)) continue;

                    // Check isolation
                    if (!wouldIsolate(tempFree, nk, n)) {
                        path.push([nr, nc]);
                        pathSet.add(nk);
                        tempFree.delete(nk);
                        moved = true;
                        break;
                    }
                }

                if (!moved) break;
            }

            if (path.length >= minPathLen) {
                if (!bestPath || path.length > bestPath.length) {
                    bestPath = path;
                }
                if (bestPath.length >= targetLen) break;
            }
        }

        if (!bestPath || bestPath.length < 2) return null;

        paths.push(bestPath);
        for (const [r, c] of bestPath) {
            freeSet.delete(cellKey(r, c));
        }
    }

    // 3. Expand remaining free cells into adjacent flows
    let changed = true;
    while (changed && freeSet.size > 0) {
        changed = false;
        const freeArr = [...freeSet];
        shuffleArray(freeArr);

        for (const key of freeArr) {
            if (!freeSet.has(key)) continue;
            const [r, c] = key.split(",").map(Number);
            const neighbors = getNeighbors(r, c, n);
            shuffleArray(neighbors);

            // Find adjacent flow to extend (prefer extending from non-endpoint end)
            let attached = false;
            for (const [nr, nc] of neighbors) {
                const nk = cellKey(nr, nc);
                // Find which flow this neighbor belongs to
                for (let fi = 0; fi < paths.length; fi++) {
                    const path = paths[fi];
                    const firstKey = cellKey(path[0][0], path[0][1]);
                    const lastKey = cellKey(path[path.length - 1][0], path[path.length - 1][1]);

                    if (nk === lastKey) {
                        // Append to end
                        if (!wouldIsolate(freeSet, key, n) || freeSet.size === 1) {
                            paths[fi].push([r, c]);
                            freeSet.delete(key);
                            attached = true;
                            changed = true;
                            break;
                        }
                    } else if (nk === firstKey) {
                        // Prepend to start
                        if (!wouldIsolate(freeSet, key, n) || freeSet.size === 1) {
                            paths[fi].unshift([r, c]);
                            freeSet.delete(key);
                            attached = true;
                            changed = true;
                            break;
                        }
                    }
                }
                if (attached) break;
            }
        }
    }

    // If still free cells remain, try aggressive pass (extend from any position)
    if (freeSet.size > 0) {
        let aggressiveChanged = true;
        while (aggressiveChanged && freeSet.size > 0) {
            aggressiveChanged = false;
            for (const key of [...freeSet]) {
                if (!freeSet.has(key)) continue;
                const [r, c] = key.split(",").map(Number);
                const neighbors = getNeighbors(r, c, n);

                for (const [nr, nc] of neighbors) {
                    const nk = cellKey(nr, nc);
                    for (let fi = 0; fi < paths.length; fi++) {
                        const path = paths[fi];
                        const firstKey = cellKey(path[0][0], path[0][1]);
                        const lastKey = cellKey(path[path.length - 1][0], path[path.length - 1][1]);
                        if (nk === lastKey || nk === firstKey) {
                            if (nk === lastKey) {
                                paths[fi].push([r, c]);
                            } else {
                                paths[fi].unshift([r, c]);
                            }
                            freeSet.delete(key);
                            aggressiveChanged = true;
                            break;
                        }
                    }
                    if (!freeSet.has(key)) break;
                }
            }
        }
    }

    // Fail if any non-dead cells still uncovered
    if (freeSet.size > 0) return null;

    return { paths, deadCells };
}

// ─── Validation ──────────────────────────────────────────

function validateLevel(
    n: number,
    paths: Cell[][],
    deadCells: Cell[]
): boolean {
    const covered = new Set<string>();

    // Check paths are contiguous and non-overlapping
    for (const path of paths) {
        if (path.length < 2) return false;

        for (let i = 0; i < path.length; i++) {
            const key = cellKey(path[i][0], path[i][1]);
            if (covered.has(key)) return false; // Overlap
            covered.add(key);

            // Check adjacency
            if (i > 0) {
                const dr = Math.abs(path[i][0] - path[i - 1][0]);
                const dc = Math.abs(path[i][1] - path[i - 1][1]);
                if (dr + dc !== 1) return false; // Not adjacent
            }
        }
    }

    // Check dead cells don't overlap with paths
    for (const [r, c] of deadCells) {
        if (covered.has(cellKey(r, c))) return false;
    }

    // Check all non-dead cells are covered
    const totalCells = n * n;
    if (covered.size + deadCells.length !== totalCells) return false;

    return true;
}

// ─── Main Generator ──────────────────────────────────────

export function generateLevel(levelNumber: number): NeuralLinkLevel | null {
    const config = getTierConfig(levelNumber);
    if (!config) return null;

    const n = config.gridSize;
    let deadCount = config.deadCount;
    let minPathMult = config.minPathMultiplier;

    // Try with full config first, then relax constraints if needed
    for (let relaxLevel = 0; relaxLevel < 4; relaxLevel++) {
        for (let attempt = 0; attempt < 60; attempt++) {
            const result = generateFlowPaths(n, config.flowCount, deadCount, minPathMult);
            if (!result) continue;

            const { paths, deadCells } = result;

            if (!validateLevel(n, paths, deadCells)) continue;

            const endpoints = paths.map(path => [
                [path[0][0], path[0][1]],
                [path[path.length - 1][0], path[path.length - 1][1]],
            ]);

            return {
                levelNumber,
                gridSize: n,
                flowCount: config.flowCount,
                deadNeuronCount: deadCells.length,
                difficulty: config.difficulty,
                difficultyValue: config.difficultyValue,
                endpoints,
                deadCells,
                solution: paths,
            };
        }

        // Relax: reduce dead count and minPathMult
        deadCount = Math.max(1, deadCount - 1);
        minPathMult = Math.max(0.5, minPathMult - 0.05);
    }

    return null;
}

/**
 * Batch generate levels.
 */
export function generateLevels(startFrom: number, count: number): NeuralLinkLevel[] {
    const levels: NeuralLinkLevel[] = [];
    for (let i = 0; i < count; i++) {
        const levelNumber = startFrom + i;
        let level: NeuralLinkLevel | null = null;
        for (let attempt = 0; attempt < 15; attempt++) {
            level = generateLevel(levelNumber);
            if (level) break;
        }
        if (level) levels.push(level);
    }
    return levels;
}

// ─── Helpers ─────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
