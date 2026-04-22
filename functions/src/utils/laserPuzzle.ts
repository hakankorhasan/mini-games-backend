/**
 * Laser Puzzle — Level Generator
 *
 * Procedural level generation engine for the Laser Puzzle game.
 * Generates solvable puzzles with mirrors, walls, portals, bombs,
 * and splitters across 5 difficulty tiers.
 *
 * Reuses the seeded PRNG from numberCircuit.ts for deterministic
 * generation.
 */

import {
    Direction,
    CellType,
    Cell,
    DifficultyConfig,
    SolutionEntry,
    LaserPuzzleLevel,
    TraceResult,
} from "../types/laserPuzzleTypes";
import { createSeededRandom, hashString } from "./numberCircuit";

export { createSeededRandom, hashString };

// ─── Direction Helpers ──────────────────────────────────────────

const DR: Record<Direction, number> = { up: -1, down: 1, left: 0, right: 0 };
const DC: Record<Direction, number> = { up: 0, down: 0, left: -1, right: 1 };

const PERPENDICULAR: Record<Direction, Direction[]> = {
    up: ["left", "right"],
    down: ["left", "right"],
    left: ["up", "down"],
    right: ["up", "down"],
};

// ─── Reflection Tables ─────────────────────────────────────────

/**
 * Reflect a laser beam off a mirror.
 *
 * mirrorAngle 0 = "/" (slash):
 *   right → up, down → left, left → down, up → right
 *
 * mirrorAngle 1 = "\" (backslash):
 *   right → down, up → left, left → up, down → right
 */
export function reflect(dir: Direction, mirrorAngle: number): Direction {
    if (mirrorAngle === 0) {
        // "/" slash
        switch (dir) {
            case "right": return "up";
            case "down": return "left";
            case "left": return "down";
            case "up": return "right";
        }
    } else {
        // "\" backslash
        switch (dir) {
            case "right": return "down";
            case "up": return "left";
            case "left": return "up";
            case "down": return "right";
        }
    }
    return dir; // fallback — shouldn't reach
}

/**
 * Given incoming and outgoing directions, compute the mirror angle
 * that would produce that reflection.
 */
export function angleForReflection(incoming: Direction, outgoing: Direction): number {
    // "/" (angle 0) pairs
    const slashPairs: [Direction, Direction][] = [
        ["right", "up"], ["down", "left"], ["left", "down"], ["up", "right"],
    ];
    for (const [i, o] of slashPairs) {
        if (incoming === i && outgoing === o) return 0;
    }
    return 1; // backslash
}

// ─── Difficulty Config ──────────────────────────────────────────

/**
 * Returns difficulty configuration for a given level number (1–500+).
 *
 * Each grid size tier ramps internally: starts manageable, ends hard.
 * Obstacles, portals, bombs appear MID-TIER, not at tier boundaries.
 * High decoy fill ensures 8+ total mirrors on board from level 1.
 *
 * Tier Map:
 *   1–15    5×5  Warm-up   : 3 solution mirrors, high decoys, walls appear at lvl 10
 *   16–40   5×5  Challenge : 4 solution mirrors, walls + portal at end
 *   41–80   6×6  Standard  : 4→5 mirrors, walls, portal, fixed mirrors
 *   81–140  7×7  Advanced  : 5→6 mirrors, bombs appear mid-tier
 *   141–220 8×8  Expert    : 6→8 mirrors, portals + bombs + splitter at end
 *   221–320 9×9  Master I  : 8→9 mirrors, full mechanics, 2 portals
 *   321–500 10×10 Master II: 10 mirrors, max density, all dangers
 */
export function getDifficultyConfig(levelNumber: number): DifficultyConfig {
    if (levelNumber <= 5) {
        const t = (levelNumber - 1) / 4;
        return {
            gridSize: 5,
            mirrorCount: 3,
            wallCount: 1,
            lives: 5,
            fixedMirrorCount: 0,
            decoyFillFraction: 0.55 + t * 0.10,
            portalPairCount: 0,
            bombCount: 0,
            splitterCount: 0,
            difficulty: "beginner",
        };
    }

    if (levelNumber <= 15) {
        const t = (levelNumber - 6) / 9;
        return {
            gridSize: 6,
            mirrorCount: 4,
            wallCount: 1 + Math.round(t),
            lives: 4,
            fixedMirrorCount: 0,
            decoyFillFraction: 0.60 + t * 0.10,
            portalPairCount: levelNumber >= 10 ? 1 : 0,
            bombCount: 0,
            splitterCount: 0,
            difficulty: "intermediate",
        };
    }

    if (levelNumber <= 30) {
        const t = (levelNumber - 16) / 14;
        return {
            gridSize: 7,
            mirrorCount: 4 + Math.round(t),
            wallCount: 2 + Math.round(t),
            lives: 4,
            fixedMirrorCount: 1,
            decoyFillFraction: 0.50 + t * 0.10,
            portalPairCount: 1,
            bombCount: levelNumber >= 20 ? 1 : 0,
            splitterCount: 0,
            difficulty: "advanced",
        };
    }

    if (levelNumber <= 50) {
        const t = (levelNumber - 31) / 19;
        return {
            gridSize: 8,
            mirrorCount: 5 + Math.round(t * 2), // 5 -> 7
            wallCount: 3 + Math.round(t * 2),   // 3 -> 5
            lives: 3,
            fixedMirrorCount: 1,
            decoyFillFraction: 0.55 + t * 0.10,
            portalPairCount: 1,
            bombCount: 1 + Math.round(t), // 1 -> 2
            splitterCount: levelNumber >= 40 ? 1 : 0,
            difficulty: "expert",
        };
    }

    if (levelNumber <= 80) {
        const t = (levelNumber - 51) / 29;
        return {
            gridSize: 9,
            mirrorCount: 7 + Math.round(t * 2), // 7 -> 9
            wallCount: 5 + Math.round(t * 2),   // 5 -> 7
            lives: 2,
            fixedMirrorCount: 2,
            decoyFillFraction: 0.60 + t * 0.10,
            portalPairCount: 2,
            bombCount: 2 + Math.round(t), // 2 -> 3
            splitterCount: 1,
            difficulty: "master",
        };
    }

    if (levelNumber <= 120) {
        const t = (levelNumber - 81) / 39;
        return {
            gridSize: 10,
            mirrorCount: 9 + Math.round(t * 2), // 9 -> 11
            wallCount: 7 + Math.round(t),       // 7 -> 8
            lives: 2,
            fixedMirrorCount: 3,
            decoyFillFraction: 0.65 + t * 0.10,
            portalPairCount: 2,
            bombCount: 3,
            splitterCount: 1,
            difficulty: "master",
        };
    }

    if (levelNumber <= 170) {
        const t = (levelNumber - 121) / 49;
        return {
            gridSize: 11,
            mirrorCount: 11 + Math.round(t * 2), // 11 -> 13
            wallCount: 8 + Math.round(t),        // 8 -> 9
            lives: 1,
            fixedMirrorCount: 4,
            decoyFillFraction: 0.70 + t * 0.10,
            portalPairCount: 3,
            bombCount: 4,
            splitterCount: 2,
            difficulty: "master",
        };
    }

    // 171 - 1000+
    return {
        gridSize: 12,
        mirrorCount: 14,
        wallCount: 10,
        lives: 1,
        fixedMirrorCount: 4,
        decoyFillFraction: 0.85,
        portalPairCount: 3,
        bombCount: 4,
        splitterCount: 2,
        difficulty: "master",
    };
}

// ─── Laser Trace ────────────────────────────────────────────────

/**
 * Trace the laser beam through the grid.
 * Supports mirrors, portals, splitters, walls, bombs.
 * Uses BFS for splitter beam branching.
 * Returns which targets were hit and whether a bomb was struck.
 */
export function traceLaser(
    grid: CellType[][],
    cells: Map<string, Cell>,
    size: number
): TraceResult {
    // Find source
    let sourceRow = 0, sourceCol = 0;
    let sourceDir: Direction = "down";
    let totalTargets = 0;

    for (const [, cell] of cells) {
        if (cell.type === "source") {
            sourceRow = cell.row;
            sourceCol = cell.col;
            sourceDir = cell.direction!;
        }
        if (cell.type === "target") {
            totalTargets++;
        }
    }

    const hitTargets = new Set<string>();
    let hitBomb = false;

    interface Beam {
        row: number;
        col: number;
        dir: Direction;
    }

    const beamQueue: Beam[] = [{ row: sourceRow, col: sourceCol, dir: sourceDir }];
    const globalVisited = new Set<string>();

    while (beamQueue.length > 0) {
        const beam = beamQueue.shift()!;
        const maxIter = size * size * 4;

        for (let iter = 0; iter < maxIter; iter++) {
            const nextRow = beam.row + DR[beam.dir];
            const nextCol = beam.col + DC[beam.dir];

            // Out of bounds
            if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
                break;
            }

            const key = `${nextRow},${nextCol},${beam.dir}`;
            if (globalVisited.has(key)) break; // infinite loop protection
            globalVisited.add(key);

            beam.row = nextRow;
            beam.col = nextCol;

            const cellType = grid[nextRow][nextCol];
            const cell = cells.get(`${nextRow},${nextCol}`);

            switch (cellType) {
                case "target":
                    hitTargets.add(`${nextRow},${nextCol}`);
                    iter = maxIter; // stop this beam
                    break;

                case "wall":
                case "source":
                    iter = maxIter; // stop
                    break;

                case "mirror": {
                    const angle = cell?.mirrorAngle ?? 0;
                    beam.dir = reflect(beam.dir, angle);
                    break;
                }

                case "bomb":
                    hitBomb = true;
                    iter = maxIter; // stop
                    break;

                case "portal": {
                    const pairId = cell?.portalPairId ?? 0;
                    // Find the exit portal with same pairId but different position
                    for (const [, other] of cells) {
                        if (
                            other.type === "portal" &&
                            other.portalPairId === pairId &&
                            (other.row !== nextRow || other.col !== nextCol)
                        ) {
                            beam.row = other.row;
                            beam.col = other.col;
                            // Direction stays the same
                            break;
                        }
                    }
                    break;
                }

                case "splitter": {
                    const angle = cell?.mirrorAngle ?? 0;
                    // Pass-through: beam continues in same direction
                    // Reflect: new beam goes in reflected direction
                    const reflectDir = reflect(beam.dir, angle);
                    beamQueue.push({
                        row: nextRow,
                        col: nextCol,
                        dir: reflectDir,
                    });
                    // Current beam continues in same direction (no change)
                    break;
                }

                case "empty":
                default:
                    // Continue
                    break;
            }
        }
    }

    return {
        hitTargets,
        hitBomb,
        allTargetsHit: hitTargets.size >= totalTargets && !hitBomb,
    };
}

// ─── Internal Grid Helpers ──────────────────────────────────────

type InternalGrid = CellType[][];

function createEmptyGrid(size: number): InternalGrid {
    return Array.from({ length: size }, () =>
        Array(size).fill("empty" as CellType)
    );
}

function cellKey(row: number, col: number): string {
    return `${row},${col}`;
}

// ─── Level Generation (15-step algorithm) ───────────────────────

/**
 * Attempt to generate a single valid laser puzzle.
 * Returns null if this attempt fails (caller retries).
 */
function attemptGeneration(
    config: DifficultyConfig,
    rand: () => number
): { grid: InternalGrid; cells: Map<string, Cell>; solutionMirrors: Cell[]; correctAngles: number[] } | null {
    const size = config.gridSize;

    // Step 1: Create empty grid
    const grid = createEmptyGrid(size);
    const cells = new Map<string, Cell>();

    // Step 2: Place source on a random edge (not corner)
    const edge = Math.floor(rand() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let sourceRow: number, sourceCol: number;
    let sourceDir: Direction;

    const edgeRange = size - 2; // positions 1..<(size-1)
    const edgePos = 1 + Math.floor(rand() * edgeRange);

    switch (edge) {
        case 0: // top
            sourceRow = 0; sourceCol = edgePos; sourceDir = "down";
            break;
        case 1: // right
            sourceRow = edgePos; sourceCol = size - 1; sourceDir = "left";
            break;
        case 2: // bottom
            sourceRow = size - 1; sourceCol = edgePos; sourceDir = "up";
            break;
        default: // left
            sourceRow = edgePos; sourceCol = 0; sourceDir = "right";
            break;
    }

    grid[sourceRow][sourceCol] = "source";
    const sourceCell: Cell = {
        row: sourceRow, col: sourceCol,
        type: "source", direction: sourceDir,
    };
    cells.set(cellKey(sourceRow, sourceCol), sourceCell);

    // Step 3: Random walk to place solution mirrors + solution portals
    let curRow = sourceRow;
    let curCol = sourceCol;
    let curDir = sourceDir;
    const pathCells = new Set<string>();
    pathCells.add(cellKey(sourceRow, sourceCol));
    const solutionMirrors: Cell[] = [];

    // Decide when to insert solution portal (after ~half the mirrors)
    const insertPortalAfterMirror = config.portalPairCount > 0
        ? Math.max(1, Math.floor(config.mirrorCount / 2))
        : -1; // never
    let solutionPortalPlaced = false;
    let solutionPortalPairId = 0;

    for (let i = 0; i < config.mirrorCount; i++) {
        // ── Insert solution portal after placing enough mirrors ──
        if (
            !solutionPortalPlaced &&
            config.portalPairCount > 0 &&
            i === insertPortalAfterMirror
        ) {
            // Walk 1 step in current direction for portal A position
            const paRow = curRow + DR[curDir];
            const paCol = curCol + DC[curDir];

            if (
                paRow >= 0 && paRow < size && paCol >= 0 && paCol < size &&
                !pathCells.has(cellKey(paRow, paCol)) &&
                grid[paRow][paCol] === "empty"
            ) {
                // Find a valid exit position (portal B) — must have room to continue
                const exitCandidates: { row: number; col: number }[] = [];
                for (let r = 1; r < size - 1; r++) {
                    for (let c = 1; c < size - 1; c++) {
                        if (grid[r][c] !== "empty") continue;
                        if (pathCells.has(cellKey(r, c))) continue;
                        if (r === paRow && c === paCol) continue;
                        // Must have at least 2 empty cells ahead in current direction
                        // (for next mirror + turn)
                        const ahead1r = r + DR[curDir];
                        const ahead1c = c + DC[curDir];
                        if (ahead1r < 0 || ahead1r >= size || ahead1c < 0 || ahead1c >= size) continue;
                        if (grid[ahead1r][ahead1c] !== "empty" || pathCells.has(cellKey(ahead1r, ahead1c))) continue;
                        exitCandidates.push({ row: r, col: c });
                    }
                }

                if (exitCandidates.length > 0) {
                    const exitPos = exitCandidates[Math.floor(rand() * exitCandidates.length)];

                    // Place portal A (entry)
                    grid[paRow][paCol] = "portal";
                    const portalA: Cell = {
                        row: paRow, col: paCol,
                        type: "portal", portalPairId: solutionPortalPairId,
                    };
                    cells.set(cellKey(paRow, paCol), portalA);
                    pathCells.add(cellKey(paRow, paCol));

                    // Place portal B (exit)
                    grid[exitPos.row][exitPos.col] = "portal";
                    const portalB: Cell = {
                        row: exitPos.row, col: exitPos.col,
                        type: "portal", portalPairId: solutionPortalPairId,
                    };
                    cells.set(cellKey(exitPos.row, exitPos.col), portalB);
                    pathCells.add(cellKey(exitPos.row, exitPos.col));

                    // Continue walk from portal B
                    curRow = exitPos.row;
                    curCol = exitPos.col;
                    // curDir stays the same (portals preserve direction)

                    solutionPortalPlaced = true;
                    solutionPortalPairId++;
                }
            }
        }

        // Walk 1–3 steps in current direction
        const maxSteps = Math.min(3, size - 2);
        const steps = 1 + Math.floor(rand() * maxSteps);
        let moved = false;

        for (let s = 0; s < steps; s++) {
            const nr = curRow + DR[curDir];
            const nc = curCol + DC[curDir];

            if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
            if (pathCells.has(cellKey(nr, nc))) break;

            curRow = nr;
            curCol = nc;
            pathCells.add(cellKey(curRow, curCol));
            moved = true;
        }

        if (!moved) break;

        // Check if we're at the edge — can't place mirror if we'd exit
        if (curRow <= 0 || curRow >= size - 1 || curCol <= 0 || curCol >= size - 1) {
            // Still OK to place mirror if there's room to turn
        }

        // Pick a perpendicular direction
        const perpDirs = PERPENDICULAR[curDir];
        // Filter: at least 1 step must be possible in the new direction
        const validPerps = perpDirs.filter((d) => {
            const nr = curRow + DR[d];
            const nc = curCol + DC[d];
            return nr >= 0 && nr < size && nc >= 0 && nc < size && !pathCells.has(cellKey(nr, nc));
        });

        if (validPerps.length === 0) break;

        const newDir = validPerps[Math.floor(rand() * validPerps.length)];
        const angle = angleForReflection(curDir, newDir);

        // Place mirror
        grid[curRow][curCol] = "mirror";
        const mirrorCell: Cell = {
            row: curRow, col: curCol,
            type: "mirror", mirrorAngle: angle, isFixed: false,
        };
        cells.set(cellKey(curRow, curCol), mirrorCell);
        solutionMirrors.push(mirrorCell);

        curDir = newDir;
    }

    // Must have placed at least 1 mirror (guarantee the laser can't go straight)
    if (solutionMirrors.length === 0) return null;

    // Step 4: Place target
    // Walk in current direction from last mirror to find target position
    let targetRow = curRow;
    let targetCol = curCol;

    for (let s = 0; s < size; s++) {
        const nr = targetRow + DR[curDir];
        const nc = targetCol + DC[curDir];
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
        if (pathCells.has(cellKey(nr, nc))) break;
        targetRow = nr;
        targetCol = nc;
        pathCells.add(cellKey(targetRow, targetCol));
    }

    // Target must not be same as source
    if (targetRow === sourceRow && targetCol === sourceCol) return null;

    // Manhattan distance check
    const manhattan = Math.abs(targetRow - sourceRow) + Math.abs(targetCol - sourceCol);
    if (manhattan < size) return null;

    grid[targetRow][targetCol] = "target";
    const targetCell: Cell = { row: targetRow, col: targetCol, type: "target" };
    cells.set(cellKey(targetRow, targetCol), targetCell);

    // Step 5: Verify solution (laser must reach target)
    const traceResult = traceLaser(grid, cells, size);
    if (!traceResult.allTargetsHit) return null;

    // Step 6: Place extra decorative portal pairs (beyond solution portals)
    const extraPortals = config.portalPairCount - solutionPortalPairId;
    if (extraPortals > 0) {
        const safeCells = getSafeCells(grid, size, pathCells);

        for (let p = 0; p < extraPortals; p++) {
            if (safeCells.length < 2) break;

            const idx1 = Math.floor(rand() * safeCells.length);
            const pos1 = safeCells.splice(idx1, 1)[0];

            const idx2 = Math.floor(rand() * safeCells.length);
            const pos2 = safeCells.splice(idx2, 1)[0];

            grid[pos1.row][pos1.col] = "portal";
            grid[pos2.row][pos2.col] = "portal";

            const pairId = solutionPortalPairId + p;
            const portal1: Cell = { row: pos1.row, col: pos1.col, type: "portal", portalPairId: pairId };
            const portal2: Cell = { row: pos2.row, col: pos2.col, type: "portal", portalPairId: pairId };
            cells.set(cellKey(pos1.row, pos1.col), portal1);
            cells.set(cellKey(pos2.row, pos2.col), portal2);
        }
    }

    // Step 7: Place bombs near laser path
    if (config.bombCount > 0) {
        const bombCandidates = getBombCandidates(grid, size, pathCells);
        const bombsToPlace = Math.min(config.bombCount, bombCandidates.length);

        for (let b = 0; b < bombsToPlace; b++) {
            const idx = Math.floor(rand() * bombCandidates.length);
            const pos = bombCandidates.splice(idx, 1)[0];

            grid[pos.row][pos.col] = "bomb";
            const bombCell: Cell = { row: pos.row, col: pos.col, type: "bomb" };
            cells.set(cellKey(pos.row, pos.col), bombCell);
        }
    }

    // Step 8: Splitter + extra target
    if (config.splitterCount > 0 && solutionMirrors.length >= 3) {
        // Pick a middle mirror to convert to splitter
        const midIdx = 1 + Math.floor(rand() * (solutionMirrors.length - 2));
        const splitterMirror = solutionMirrors[midIdx];

        // Try to place extra target in pass-through direction
        // The splitter's pass-through is the same direction the beam was going
        // We need to find an empty cell in that direction
        // Find incoming direction to this mirror
        // The mirror is at solutionMirrors[midIdx], the previous mirror (or source) leads here
        // We'll try all 4 directions for the extra target
        let extraTargetPlaced = false;

        for (const tryDir of (["up", "down", "left", "right"] as Direction[])) {
            let r = splitterMirror.row;
            let c = splitterMirror.col;
            let extraR = -1, extraC = -1;

            for (let s = 0; s < size; s++) {
                r += DR[tryDir];
                c += DC[tryDir];
                if (r < 0 || r >= size || c < 0 || c >= size) break;
                if (grid[r][c] !== "empty") break;
                extraR = r;
                extraC = c;
            }

            if (extraR >= 0 && extraC >= 0 && grid[extraR][extraC] === "empty") {
                // Convert mirror to splitter
                grid[splitterMirror.row][splitterMirror.col] = "splitter";
                splitterMirror.type = "splitter";
                cells.set(cellKey(splitterMirror.row, splitterMirror.col), splitterMirror);

                // Place extra target
                grid[extraR][extraC] = "target";
                const extraTarget: Cell = { row: extraR, col: extraC, type: "target" };
                cells.set(cellKey(extraR, extraC), extraTarget);
                extraTargetPlaced = true;
                break;
            }
        }

        // If failed, revert — keep as mirror
        if (!extraTargetPlaced) {
            grid[splitterMirror.row][splitterMirror.col] = "mirror";
            splitterMirror.type = "mirror";
            cells.set(cellKey(splitterMirror.row, splitterMirror.col), splitterMirror);
        }
    }

    // Step 9: Place walls
    const remainingSafe = getSafeCells(grid, size, pathCells);
    const wallsToPlace = Math.min(config.wallCount, remainingSafe.length);
    for (let w = 0; w < wallsToPlace; w++) {
        const idx = Math.floor(rand() * remainingSafe.length);
        const pos = remainingSafe.splice(idx, 1)[0];

        grid[pos.row][pos.col] = "wall";
        const wallCell: Cell = { row: pos.row, col: pos.col, type: "wall" };
        cells.set(cellKey(pos.row, pos.col), wallCell);
    }

    // Step 10: Place decoy mirrors
    const decoySafe = getSafeCells(grid, size, pathCells);
    const decoyCount = Math.floor(decoySafe.length * config.decoyFillFraction);

    for (let d = 0; d < decoyCount; d++) {
        if (decoySafe.length === 0) break;
        const idx = Math.floor(rand() * decoySafe.length);
        const pos = decoySafe.splice(idx, 1)[0];

        const decoyAngle = Math.floor(rand() * 2);
        grid[pos.row][pos.col] = "mirror";
        const decoyCell: Cell = {
            row: pos.row, col: pos.col,
            type: "mirror", mirrorAngle: decoyAngle, isFixed: false,
        };
        cells.set(cellKey(pos.row, pos.col), decoyCell);
    }

    // Step 11: Re-validate after decorations
    const recheck = traceLaser(grid, cells, size);
    if (!recheck.allTargetsHit) return null;

    // Step 12: Mark fixed mirrors
    const fixCount = Math.min(config.fixedMirrorCount, solutionMirrors.length);
    const fixIndices: number[] = [];
    const available = solutionMirrors.map((_, i) => i);

    for (let f = 0; f < fixCount; f++) {
        if (available.length === 0) break;
        const idx = Math.floor(rand() * available.length);
        const mirrorIdx = available.splice(idx, 1)[0];
        fixIndices.push(mirrorIdx);
    }

    for (const idx of fixIndices) {
        solutionMirrors[idx].isFixed = true;
        cells.set(
            cellKey(solutionMirrors[idx].row, solutionMirrors[idx].col),
            solutionMirrors[idx]
        );
    }

    // ★ Save correct angles BEFORE scrambling (this is the ground truth)
    const correctAngles: number[] = solutionMirrors.map((m) => m.mirrorAngle ?? 0);

    // Step 13: Scramble non-fixed mirrors (set to wrong angle)
    for (const mirror of solutionMirrors) {
        if (!mirror.isFixed) {
            mirror.mirrorAngle = ((mirror.mirrorAngle ?? 0) + 1) % 2;
            cells.set(cellKey(mirror.row, mirror.col), mirror);
            grid[mirror.row][mirror.col] = mirror.type; // could be splitter
        }
    }

    // Step 14: Verify scrambled state doesn't accidentally solve
    const scrambledCheck = traceLaser(grid, cells, size);
    if (scrambledCheck.allTargetsHit) {
        // Try random scramble up to 10 times
        let fixed = false;
        for (let t = 0; t < 10; t++) {
            for (let mi = 0; mi < solutionMirrors.length; mi++) {
                const mirror = solutionMirrors[mi];
                if (!mirror.isFixed) {
                    // Pick a random angle that is NOT the correct one
                    const wrong = (correctAngles[mi] + 1) % 2;
                    mirror.mirrorAngle = wrong;
                    cells.set(cellKey(mirror.row, mirror.col), mirror);
                }
            }
            const recheck2 = traceLaser(grid, cells, size);
            if (!recheck2.allTargetsHit) {
                fixed = true;
                break;
            }
        }
        if (!fixed) return null; // can't scramble away from solution
    }

    // Step 15: Final validation — restore correct angles and verify solvable
    // Save current scrambled angles
    const scrambledAngles: number[] = solutionMirrors.map((m) => m.mirrorAngle ?? 0);

    // Restore correct angles from saved values
    for (let i = 0; i < solutionMirrors.length; i++) {
        solutionMirrors[i].mirrorAngle = correctAngles[i];
        cells.set(
            cellKey(solutionMirrors[i].row, solutionMirrors[i].col),
            solutionMirrors[i]
        );
    }

    const finalCheck = traceLaser(grid, cells, size);

    // Restore scrambled angles (this is what we ship)
    for (let i = 0; i < solutionMirrors.length; i++) {
        solutionMirrors[i].mirrorAngle = scrambledAngles[i];
        cells.set(
            cellKey(solutionMirrors[i].row, solutionMirrors[i].col),
            solutionMirrors[i]
        );
    }

    if (!finalCheck.allTargetsHit) return null;

    return { grid, cells, solutionMirrors, correctAngles };
}

// ─── Safe Cell Helpers ──────────────────────────────────────────

interface Pos { row: number; col: number; }

function getSafeCells(
    grid: InternalGrid,
    size: number,
    pathCells: Set<string>
): Pos[] {
    const safe: Pos[] = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (grid[r][c] === "empty" && !pathCells.has(cellKey(r, c))) {
                safe.push({ row: r, col: c });
            }
        }
    }
    return safe;
}

function getBombCandidates(
    grid: InternalGrid,
    size: number,
    pathCells: Set<string>
): Pos[] {
    const candidates = new Set<string>();
    const result: Pos[] = [];

    // Find cells adjacent to path but NOT on the path
    for (const key of pathCells) {
        const [r, c] = key.split(",").map(Number);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
                const nk = cellKey(nr, nc);
                if (grid[nr][nc] === "empty" && !pathCells.has(nk) && !candidates.has(nk)) {
                    candidates.add(nk);
                    result.push({ row: nr, col: nc });
                }
            }
        }
    }

    return result;
}

// ─── Main Level Generator ───────────────────────────────────────

/**
 * Generate a complete, solvable Laser Puzzle level.
 * Retries up to 100 times until a valid puzzle is produced.
 *
 * Guarantees:
 * - Laser NEVER reaches target directly (always needs mirror interaction)
 * - Scrambled state does NOT solve the puzzle
 * - Solution angles DO solve the puzzle
 */
export function generateLevel(
    levelNumber: number,
    rand: () => number
): LaserPuzzleLevel {
    const config = getDifficultyConfig(levelNumber);

    for (let attempt = 0; attempt < 100; attempt++) {
        const result = attemptGeneration(config, rand);
        if (!result) continue;

        const { cells, solutionMirrors, correctAngles } = result;

        // Build solution array (non-fixed mirrors/splitters with correct angle)
        const solution: SolutionEntry[] = [];
        for (let i = 0; i < solutionMirrors.length; i++) {
            const mirror = solutionMirrors[i];
            if (!mirror.isFixed) {
                solution.push({
                    row: mirror.row,
                    col: mirror.col,
                    correctAngle: correctAngles[i],
                });
            }
        }

        // Build cells array (non-empty only)
        const cellArray: Cell[] = [];
        for (const [, cell] of cells) {
            cellArray.push({ ...cell });
        }

        return {
            levelNumber,
            gridSize: config.gridSize,
            difficulty: config.difficulty,
            lives: config.lives,
            cells: cellArray,
            solution,
        };
    }

    // Fallback: guaranteed simple puzzle
    return createFallbackLevel(levelNumber, config, rand);
}

/**
 * Create a guaranteed simple fallback puzzle.
 * L-shape: source (0,1)→down, mirror at (size-2, 1) angle 1 (\),
 * reflects down→right, target at (size-2, size-2).
 * Shipped with wrong angle (0), correct is 1.
 */
function createFallbackLevel(
    levelNumber: number,
    config: DifficultyConfig,
    _rand: () => number
): LaserPuzzleLevel {
    const size = config.gridSize;
    const mirrorRow = size - 2;
    const mirrorCol = 1;
    const targetRow = mirrorRow;
    const targetCol = size - 2;

    const cells: Cell[] = [
        { row: 0, col: 1, type: "source", direction: "down" },
        { row: mirrorRow, col: mirrorCol, type: "mirror", mirrorAngle: 0, isFixed: false }, // wrong angle (shipped scrambled)
        { row: targetRow, col: targetCol, type: "target" },
    ];

    return {
        levelNumber,
        gridSize: size,
        difficulty: config.difficulty,
        lives: config.lives,
        cells,
        solution: [{ row: mirrorRow, col: mirrorCol, correctAngle: 1 }], // \ reflects down→right
    };
}

// ─── Batch Generation ───────────────────────────────────────────

/**
 * Generate multiple levels deterministically.
 * Each level uses a seed derived from "LaserPuzzle-level-{N}".
 */
export function generateLevels(
    startFrom: number,
    count: number
): LaserPuzzleLevel[] {
    const levels: LaserPuzzleLevel[] = [];
    for (let i = 0; i < count; i++) {
        const levelNumber = startFrom + i;
        const seed = hashString(`LaserPuzzle-level-${levelNumber}`);
        const rand = createSeededRandom(seed);
        levels.push(generateLevel(levelNumber, rand));
    }
    return levels;
}
