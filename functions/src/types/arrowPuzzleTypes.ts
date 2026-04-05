/**
 * Arrow Puzzle (Path Clearing) — TypeScript Types
 *
 * Defines the data structures used by the procedural level generator,
 * DFS solver, and Firestore API endpoints.
 */

// ─── Primitives ─────────────────────────────────────────────────

export interface Cell {
    x: number;
    y: number;
}

export type Direction = "up" | "down" | "left" | "right";

export interface DirectionVector {
    dx: number;
    dy: number;
}

// ─── Stream (Snake) ─────────────────────────────────────────────

export interface Stream {
    id: string;           // e.g. "stream-1"
    label: string;        // e.g. "Stream 1"
    color: string;        // Hex color e.g. "#29ECFF"
    direction: Direction; // Head facing direction
    cells: Cell[];        // cells[0] = tail, cells[last] = head
    exited: boolean;      // true when fully outside the grid
}

// ─── Grid ───────────────────────────────────────────────────────

export interface Grid {
    cols: number;
    rows: number;
}

// ─── Level ──────────────────────────────────────────────────────

export interface ArrowPuzzleLevel {
    levelNumber: number;
    gameType: string;           // ".pathClearing"
    difficulty: string;         // "easy" | "medium" | "hard" | "expert" | "master"
    difficultyScore: number;    // 1–100 normalized score
    grid: Grid;                 // Bounding box
    activeCells: Cell[];        // Only these cells are playable (defines shape)
    shapeName: string;          // e.g. "diamond", "heart", "star"
    streams: StreamData[];
    solution: string[];         // Ordered stream IDs for solution
}

/** Serializable stream data (without runtime `exited` flag) */
export interface StreamData {
    id: string;
    label: string;
    color: string;
    direction: Direction;
    cells: Cell[];
}

// ─── Difficulty Configuration ───────────────────────────────────

export interface DifficultyConfig {
    difficulty: string;
    gridSize: number;           // Grid dimension (square grid: N×N)
    streamCountMin: number;     // Min number of streams
    streamCountMax: number;     // Max number of streams
    minSolutionLength: number;  // DFS solution must be at least this many steps
    maxImmediateMoves: number;  // Max streams that can exit on first move
    minTurns: number;           // Min turns per stream body
    minPathLength: number;      // Min cells per stream
    minDensity: number;         // Min grid fill ratio (0–1)
    depthLimit: number;         // DFS solver depth limit
}

// ─── Solver State ───────────────────────────────────────────────

export interface SolverStream {
    id: string;
    cells: Cell[];
    direction: Direction;
    exited: boolean;
}

export interface SolverState {
    streams: SolverStream[];
}

export interface SimulateResult {
    nextState: SolverState;
    exited: boolean;
    steps: number;
}
