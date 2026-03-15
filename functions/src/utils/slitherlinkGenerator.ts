/**
 * Slitherlink — Level Generator
 *
 * Generates valid Slitherlink puzzles using:
 * 1. Random rectangle → deform to create interesting loop
 * 2. Calculate clues (0-3) from loop edges
 * 3. Smart clue removal: remove 0/3 first (stronger hints)
 * 4. 7 difficulty tiers spanning 250 levels
 *
 * No Firestore dependency — used by seed script.
 */

// ─── Types ───────────────────────────────────────────────

export interface SlitherlinkLevel {
    levelNumber: number;
    gridSize: number;
    difficulty: string;
    difficultyValue: number;
    clues: (number | null)[][];
    solution: {
        horizontal: boolean[][];
        vertical: boolean[][];
    };
}

interface TierDef {
    minLevel: number;
    maxLevel: number;
    gridSize: number;
    difficulty: string;
    difficultyRange: [number, number];
    clueFractionRange: [number, number]; // [start, end] — decreasing = harder
}

// ─── Difficulty Tiers ────────────────────────────────────

const LEVEL_TIERS: TierDef[] = [
    {
        minLevel: 1, maxLevel: 20,
        gridSize: 4, difficulty: "beginner",
        difficultyRange: [1, 2],
        clueFractionRange: [0.70, 0.60],
    },
    {
        minLevel: 21, maxLevel: 50,
        gridSize: 5, difficulty: "easy",
        difficultyRange: [2, 3],
        clueFractionRange: [0.65, 0.55],
    },
    {
        minLevel: 51, maxLevel: 90,
        gridSize: 5, difficulty: "intermediate",
        difficultyRange: [3, 5],
        clueFractionRange: [0.55, 0.45],
    },
    {
        minLevel: 91, maxLevel: 130,
        gridSize: 6, difficulty: "advanced",
        difficultyRange: [5, 6],
        clueFractionRange: [0.55, 0.45],
    },
    {
        minLevel: 131, maxLevel: 180,
        gridSize: 7, difficulty: "hard",
        difficultyRange: [6, 8],
        clueFractionRange: [0.50, 0.40],
    },
    {
        minLevel: 181, maxLevel: 220,
        gridSize: 8, difficulty: "expert",
        difficultyRange: [8, 9],
        clueFractionRange: [0.45, 0.35],
    },
    {
        minLevel: 221, maxLevel: 250,
        gridSize: 10, difficulty: "master",
        difficultyRange: [9, 10],
        clueFractionRange: [0.40, 0.30],
    },
];

export const TOTAL_SLITHERLINK_LEVELS = 250;

// ─── Tier Config ─────────────────────────────────────────

interface LevelConfig {
    gridSize: number;
    difficulty: string;
    difficultyValue: number;
    clueFraction: number;
}

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
                difficulty: tier.difficulty,
                difficultyValue: lerpInt(tier.difficultyRange[0], tier.difficultyRange[1]),
                clueFraction: lerp(tier.clueFractionRange[0], tier.clueFractionRange[1]),
            };
        }
    }
    return null;
}

// ─── Loop Generation ─────────────────────────────────────

/**
 * Create edge matrices for an N×N grid.
 * horizontal: (N+1) rows × N cols
 * vertical:   N rows × (N+1) cols
 */
function createEdges(n: number): { h: boolean[][]; v: boolean[][] } {
    const h: boolean[][] = [];
    for (let r = 0; r <= n; r++) {
        h[r] = new Array(n).fill(false);
    }
    const v: boolean[][] = [];
    for (let r = 0; r < n; r++) {
        v[r] = new Array(n + 1).fill(false);
    }
    return { h, v };
}

/**
 * Draw a rectangle loop on the edge matrices.
 * Rectangle from (r1,c1) to (r2,c2) inclusive.
 */
function drawRectangle(
    h: boolean[][], v: boolean[][],
    r1: number, c1: number, r2: number, c2: number
): void {
    // Top edge: row r1, cols c1..c2-1
    for (let c = c1; c < c2; c++) h[r1][c] = true;
    // Bottom edge: row r2, cols c1..c2-1
    for (let c = c1; c < c2; c++) h[r2][c] = true;
    // Left edge: col c1, rows r1..r2-1
    for (let r = r1; r < r2; r++) v[r][c1] = true;
    // Right edge: col c2, rows r1..r2-1
    for (let r = r1; r < r2; r++) v[r][c2] = true;
}

/**
 * Count edges meeting at vertex (r, c).
 * Vertex (r,c) is connected to:
 *   - horizontal edges h[r][c-1] (left) and h[r][c] (right)
 *   - vertical edges v[r-1][c] (up) and v[r][c] (down)
 */
function vertexDegree(h: boolean[][], v: boolean[][], n: number, r: number, c: number): number {
    let deg = 0;
    if (c > 0 && h[r][c - 1]) deg++;
    if (c < n && h[r][c]) deg++;
    if (r > 0 && v[r - 1][c]) deg++;
    if (r < n && v[r][c]) deg++;
    return deg;
}

/**
 * Verify that the edges form a valid single closed loop.
 * Every vertex must have degree 0 or 2, and all edges with degree 2
 * must be connected (BFS).
 */
function verifyLoop(h: boolean[][], v: boolean[][], n: number): boolean {
    // Check all vertex degrees
    const loopVertices: string[] = [];
    for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
            const deg = vertexDegree(h, v, n, r, c);
            if (deg !== 0 && deg !== 2) return false;
            if (deg === 2) loopVertices.push(`${r},${c}`);
        }
    }

    if (loopVertices.length === 0) return false;

    // BFS to check connectivity
    const visited = new Set<string>();
    const queue = [loopVertices[0]];
    visited.add(loopVertices[0]);

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const [r, c] = curr.split(",").map(Number);

        // Check all 4 edge neighbors
        const neighbors: [number, number, boolean][] = [];
        // Right: h[r][c]
        if (c < n && h[r][c]) neighbors.push([r, c + 1, true]);
        // Left: h[r][c-1]
        if (c > 0 && h[r][c - 1]) neighbors.push([r, c - 1, true]);
        // Down: v[r][c]
        if (r < n && v[r][c]) neighbors.push([r + 1, c, true]);
        // Up: v[r-1][c]
        if (r > 0 && v[r - 1][c]) neighbors.push([r - 1, c, true]);

        for (const [nr, nc] of neighbors) {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
                visited.add(key);
                queue.push(key);
            }
        }
    }

    return visited.size === loopVertices.length;
}

/**
 * Try to deform the loop by bumping an edge segment in or out.
 * Picks a random straight segment and extends/retracts it by 1 cell.
 */
function deformLoop(h: boolean[][], v: boolean[][], n: number): boolean {
    // Pick random orientation: 0 = horizontal edge bump, 1 = vertical edge bump
    const orient = Math.random() < 0.5 ? 0 : 1;

    if (orient === 0) {
        // Find a horizontal edge that's part of the loop
        const candidates: { r: number; c: number }[] = [];
        for (let r = 0; r <= n; r++) {
            for (let c = 0; c < n; c++) {
                if (h[r][c]) candidates.push({ r, c });
            }
        }
        if (candidates.length === 0) return false;

        const edge = candidates[Math.floor(Math.random() * candidates.length)];
        const { r, c } = edge;

        // Try to bump this horizontal edge up or down
        const dir = Math.random() < 0.5 ? -1 : 1;
        const newR = r + dir;

        // Bounds check
        if (newR < 0 || newR > n) return false;

        // Save state
        const savedH = h.map(row => [...row]);
        const savedV = v.map(row => [...row]);

        // Remove old horizontal edge
        h[r][c] = false;
        // Add new horizontal edge
        h[newR][c] = true;
        // Add two vertical edges to connect
        const minR = Math.min(r, newR);
        v[minR][c] = !v[minR][c];         // toggle left vertical
        v[minR][c + 1] = !v[minR][c + 1]; // toggle right vertical

        if (verifyLoop(h, v, n)) return true;

        // Revert
        for (let i = 0; i <= n; i++) h[i] = savedH[i];
        for (let i = 0; i < n; i++) v[i] = savedV[i];
        return false;
    } else {
        // Find a vertical edge that's part of the loop
        const candidates: { r: number; c: number }[] = [];
        for (let r = 0; r < n; r++) {
            for (let c = 0; c <= n; c++) {
                if (v[r][c]) candidates.push({ r, c });
            }
        }
        if (candidates.length === 0) return false;

        const edge = candidates[Math.floor(Math.random() * candidates.length)];
        const { r, c } = edge;

        // Try to bump left or right
        const dir = Math.random() < 0.5 ? -1 : 1;
        const newC = c + dir;

        if (newC < 0 || newC > n) return false;

        const savedH = h.map(row => [...row]);
        const savedV = v.map(row => [...row]);

        v[r][c] = false;
        v[r][newC] = true;
        const minC = Math.min(c, newC);
        h[r][minC] = !h[r][minC];
        h[r + 1][minC] = !h[r + 1][minC];

        if (verifyLoop(h, v, n)) return true;

        for (let i = 0; i <= n; i++) h[i] = savedH[i];
        for (let i = 0; i < n; i++) v[i] = savedV[i];
        return false;
    }
}

/**
 * Generate a random loop on an N×N grid.
 */
function generateLoop(n: number): { h: boolean[][]; v: boolean[][] } | null {
    const { h, v } = createEdges(n);

    // Start with a random sub-rectangle (at least 2×2)
    const minSize = 2;
    const r1 = Math.floor(Math.random() * (n - minSize + 1));
    const c1 = Math.floor(Math.random() * (n - minSize + 1));
    const r2 = r1 + minSize + Math.floor(Math.random() * (n - r1 - minSize + 1));
    const c2 = c1 + minSize + Math.floor(Math.random() * (n - c1 - minSize + 1));

    drawRectangle(h, v, r1, c1, r2, c2);

    if (!verifyLoop(h, v, n)) return null;

    // Deform the loop to make it interesting
    const deformAttempts = n * n * 2;
    for (let i = 0; i < deformAttempts; i++) {
        deformLoop(h, v, n);
    }

    // Final verification
    if (!verifyLoop(h, v, n)) return null;

    // Ensure loop is non-trivial (uses enough edges)
    let edgeCount = 0;
    for (let r = 0; r <= n; r++) {
        for (let c = 0; c < n; c++) {
            if (h[r][c]) edgeCount++;
        }
    }
    for (let r = 0; r < n; r++) {
        for (let c = 0; c <= n; c++) {
            if (v[r][c]) edgeCount++;
        }
    }

    // Minimum edge count: perimeter of 2×2 = 8, scale with grid
    const minEdges = Math.max(8, n * 2 + 4);
    if (edgeCount < minEdges) return null;

    return { h, v };
}

// ─── Clue Generation ─────────────────────────────────────

/**
 * Calculate clue for cell (r, c): count of loop edges around it.
 */
function calcClue(h: boolean[][], v: boolean[][], r: number, c: number): number {
    let count = 0;
    if (h[r][c]) count++;     // top
    if (h[r + 1][c]) count++; // bottom
    if (v[r][c]) count++;     // left
    if (v[r][c + 1]) count++; // right
    return count;
}

/**
 * Calculate all clues for the grid.
 */
function calcAllClues(h: boolean[][], v: boolean[][], n: number): number[][] {
    const clues: number[][] = [];
    for (let r = 0; r < n; r++) {
        clues[r] = [];
        for (let c = 0; c < n; c++) {
            clues[r][c] = calcClue(h, v, r, c);
        }
    }
    return clues;
}

/**
 * Smart clue removal: keep clueFraction of cells.
 * Remove 0 and 3 clues first (they're stronger hints).
 * Keep 1 and 2 clues longer (they're more ambiguous).
 */
function removeClues(
    allClues: number[][],
    n: number,
    clueFraction: number
): (number | null)[][] {
    const totalCells = n * n;
    const cluesToKeep = Math.round(totalCells * clueFraction);
    const cluesToRemove = totalCells - cluesToKeep;

    // Categorize cells by clue value
    const strongCells: [number, number][] = []; // 0, 3
    const weakCells: [number, number][] = [];   // 1, 2

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const val = allClues[r][c];
            if (val === 0 || val === 3) {
                strongCells.push([r, c]);
            } else {
                weakCells.push([r, c]);
            }
        }
    }

    // Shuffle both arrays
    shuffleArray(strongCells);
    shuffleArray(weakCells);

    // Remove strong clues first, then weak ones
    const toRemove = [...strongCells, ...weakCells];
    const removed = new Set<string>();

    for (let i = 0; i < Math.min(cluesToRemove, toRemove.length); i++) {
        const [r, c] = toRemove[i];
        removed.add(`${r},${c}`);
    }

    // Build result
    const result: (number | null)[][] = [];
    for (let r = 0; r < n; r++) {
        result[r] = [];
        for (let c = 0; c < n; c++) {
            result[r][c] = removed.has(`${r},${c}`) ? null : allClues[r][c];
        }
    }

    return result;
}

// ─── Main Generator ──────────────────────────────────────

export function generateLevel(levelNumber: number): SlitherlinkLevel | null {
    const config = getTierConfig(levelNumber);
    if (!config) return null;

    const n = config.gridSize;

    // Try generating a valid loop
    let loop: { h: boolean[][]; v: boolean[][] } | null = null;
    for (let attempt = 0; attempt < 30; attempt++) {
        loop = generateLoop(n);
        if (loop) break;
    }

    if (!loop) return null;

    // Calculate all clues
    const allClues = calcAllClues(loop.h, loop.v, n);

    // Remove clues based on difficulty
    const clues = removeClues(allClues, n, config.clueFraction);

    return {
        levelNumber,
        gridSize: n,
        difficulty: config.difficulty,
        difficultyValue: config.difficultyValue,
        clues,
        solution: {
            horizontal: loop.h,
            vertical: loop.v,
        },
    };
}

/**
 * Batch-generate levels.
 */
export function generateLevels(startFrom: number, count: number): SlitherlinkLevel[] {
    const levels: SlitherlinkLevel[] = [];
    for (let i = 0; i < count; i++) {
        const levelNumber = startFrom + i;
        let level: SlitherlinkLevel | null = null;
        for (let attempt = 0; attempt < 10; attempt++) {
            level = generateLevel(levelNumber);
            if (level) break;
        }
        if (level) {
            levels.push(level);
        }
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
