import {
    reflect,
    angleForReflection,
    getDifficultyConfig,
    traceLaser,
    generateLevel,
    generateLevels,
} from "../utils/laserPuzzle";
import { createSeededRandom } from "../utils/numberCircuit";
import { Cell, CellType } from "../types/laserPuzzleTypes";

// ── Helper: build grid + cells map from a Cell array ──
function buildGridAndCells(
    cells: Cell[],
    size: number
): { grid: CellType[][]; cellMap: Map<string, Cell> } {
    const grid: CellType[][] = Array.from({ length: size }, () =>
        Array(size).fill("empty" as CellType)
    );
    const cellMap = new Map<string, Cell>();

    for (const cell of cells) {
        grid[cell.row][cell.col] = cell.type;
        cellMap.set(`${cell.row},${cell.col}`, cell);
    }

    return { grid, cellMap };
}

describe("Laser Puzzle — Level Generator", () => {
    // ── Reflection Tables ─────────────────────────────
    describe("reflect", () => {
        it("should reflect correctly for / (angle 0)", () => {
            expect(reflect("right", 0)).toBe("up");
            expect(reflect("down", 0)).toBe("left");
            expect(reflect("left", 0)).toBe("down");
            expect(reflect("up", 0)).toBe("right");
        });

        it("should reflect correctly for \\ (angle 1)", () => {
            expect(reflect("right", 1)).toBe("down");
            expect(reflect("up", 1)).toBe("left");
            expect(reflect("left", 1)).toBe("up");
            expect(reflect("down", 1)).toBe("right");
        });
    });

    // ── Angle For Reflection ──────────────────────────
    describe("angleForReflection", () => {
        it("should return 0 for slash (/) pairs", () => {
            expect(angleForReflection("right", "up")).toBe(0);
            expect(angleForReflection("down", "left")).toBe(0);
            expect(angleForReflection("left", "down")).toBe(0);
            expect(angleForReflection("up", "right")).toBe(0);
        });

        it("should return 1 for backslash (\\) pairs", () => {
            expect(angleForReflection("right", "down")).toBe(1);
            expect(angleForReflection("up", "left")).toBe(1);
            expect(angleForReflection("left", "up")).toBe(1);
            expect(angleForReflection("down", "right")).toBe(1);
        });
    });

    // ── Difficulty Config ─────────────────────────────
    describe("getDifficultyConfig", () => {
        it("should return beginner for levels 1–15 (5×5)", () => {
            expect(getDifficultyConfig(1).difficulty).toBe("beginner");
            expect(getDifficultyConfig(1).gridSize).toBe(5);
            expect(getDifficultyConfig(1).mirrorCount).toBe(3);
            expect(getDifficultyConfig(15).difficulty).toBe("beginner");
        });

        it("should return intermediate for levels 16–80", () => {
            expect(getDifficultyConfig(16).difficulty).toBe("intermediate");
            expect(getDifficultyConfig(16).gridSize).toBe(5);
            expect(getDifficultyConfig(50).gridSize).toBe(6);
            expect(getDifficultyConfig(80).difficulty).toBe("intermediate");
        });

        it("should return advanced for levels 81–140 (7×7)", () => {
            expect(getDifficultyConfig(81).difficulty).toBe("advanced");
            expect(getDifficultyConfig(81).gridSize).toBe(7);
            expect(getDifficultyConfig(140).difficulty).toBe("advanced");
        });

        it("should return expert for levels 141–220 (8×8)", () => {
            expect(getDifficultyConfig(141).difficulty).toBe("expert");
            expect(getDifficultyConfig(141).gridSize).toBe(8);
            expect(getDifficultyConfig(220).difficulty).toBe("expert");
        });

        it("should return master for levels 221+ (9×9→10×10)", () => {
            expect(getDifficultyConfig(221).difficulty).toBe("master");
            expect(getDifficultyConfig(221).gridSize).toBe(9);
            expect(getDifficultyConfig(321).gridSize).toBe(10);
            expect(getDifficultyConfig(500).difficulty).toBe("master");
        });

        it("beginner should have high decoy fill (8+ mirrors visible)", () => {
            const cfg = getDifficultyConfig(1);
            expect(cfg.decoyFillFraction).toBeGreaterThanOrEqual(0.55);
        });

        it("walls should appear at level 10 in beginner", () => {
            expect(getDifficultyConfig(9).wallCount).toBe(0);
            expect(getDifficultyConfig(10).wallCount).toBe(1);
        });

        it("advanced should have portals and bombs", () => {
            const cfg = getDifficultyConfig(100);
            expect(cfg.portalPairCount).toBeGreaterThan(0);
            expect(cfg.bombCount).toBeGreaterThan(0);
        });

        it("expert should have bombs and walls", () => {
            const cfg = getDifficultyConfig(200);
            expect(cfg.bombCount).toBeGreaterThan(0);
            expect(cfg.wallCount).toBeGreaterThan(0);
        });

        it("master should have splitters", () => {
            const cfg = getDifficultyConfig(300);
            expect(cfg.splitterCount).toBeGreaterThan(0);
        });
    });

    // ── Laser Trace ───────────────────────────────────
    describe("traceLaser", () => {
        it("should trace a simple 2-mirror path", () => {
            // 5×5 grid:
            // Source at (0,2) going down
            // Mirror at (2,2) angle 0 "/" → turns right to up... wait
            // Let's do: source (0,2) down, mirror (2,2) angle 1 "\" → turns right
            // Mirror at (2,4) angle 0 "/" → turns down
            // Target at (4,4)
            // Actually, let's do a cleaner setup:
            // Source (0,2) down → mirror (3,2) angle 1 "\" → down→right →
            // target (3,4)
            const cells2: Cell[] = [
                { row: 0, col: 2, type: "source", direction: "down" },
                { row: 3, col: 2, type: "mirror", mirrorAngle: 1 }, // down → right
                { row: 3, col: 4, type: "target" },
            ];
            const { grid, cellMap } = buildGridAndCells(cells2, 5);
            const result = traceLaser(grid, cellMap, 5);

            expect(result.allTargetsHit).toBe(true);
            expect(result.hitBomb).toBe(false);
        });

        it("should stop at walls", () => {
            const cells: Cell[] = [
                { row: 0, col: 2, type: "source", direction: "down" },
                { row: 2, col: 2, type: "wall" },
                { row: 4, col: 2, type: "target" },
            ];
            const { grid, cellMap } = buildGridAndCells(cells, 5);
            const result = traceLaser(grid, cellMap, 5);

            expect(result.allTargetsHit).toBe(false);
        });

        it("should detect bomb hits", () => {
            const cells: Cell[] = [
                { row: 0, col: 2, type: "source", direction: "down" },
                { row: 2, col: 2, type: "bomb" },
            ];
            const { grid, cellMap } = buildGridAndCells(cells, 5);
            const result = traceLaser(grid, cellMap, 5);

            expect(result.hitBomb).toBe(true);
            expect(result.allTargetsHit).toBe(false);
        });

        it("should handle portal teleportation", () => {
            // Source (0,1) down → portal (2,1) pairId=0 → exits (2,3) keeps going down → target (4,3)
            const cells: Cell[] = [
                { row: 0, col: 1, type: "source", direction: "down" },
                { row: 2, col: 1, type: "portal", portalPairId: 0 },
                { row: 2, col: 3, type: "portal", portalPairId: 0 },
                { row: 4, col: 3, type: "target" },
            ];
            const { grid, cellMap } = buildGridAndCells(cells, 5);
            const result = traceLaser(grid, cellMap, 5);

            expect(result.allTargetsHit).toBe(true);
        });

        it("should stop laser at source if it bounces back", () => {
            // Source (2,0) right → mirror (2,3) angle 0 "/" → right → up
            // Nothing else → goes out of grid, doesn't hit target
            const cells: Cell[] = [
                { row: 2, col: 0, type: "source", direction: "right" },
                { row: 2, col: 3, type: "mirror", mirrorAngle: 0 }, // right → up
                { row: 4, col: 4, type: "target" },
            ];
            const { grid, cellMap } = buildGridAndCells(cells, 5);
            const result = traceLaser(grid, cellMap, 5);

            expect(result.allTargetsHit).toBe(false);
        });
    });

    // ── Level Generation ──────────────────────────────
    describe("generateLevel", () => {
        it("should generate valid beginner level", () => {
            const rand = createSeededRandom(42);
            const level = generateLevel(1, rand);

            expect(level.levelNumber).toBe(1);
            expect(level.gridSize).toBe(5);
            expect(level.difficulty).toBe("beginner");
            expect(level.lives).toBe(5);

            // Must have exactly 1 source
            const sources = level.cells.filter((c) => c.type === "source");
            expect(sources.length).toBe(1);

            // Must have at least 1 target
            const targets = level.cells.filter((c) => c.type === "target");
            expect(targets.length).toBeGreaterThanOrEqual(1);

            // Solution should have at least 1 entry (laser never goes straight)
            expect(level.solution.length).toBeGreaterThanOrEqual(1);
        });

        it("should generate valid intermediate level", () => {
            const rand = createSeededRandom(100);
            const level = generateLevel(50, rand);

            expect(level.gridSize).toBe(6);
            expect(level.difficulty).toBe("intermediate");
        });

        it("should generate valid advanced level", () => {
            const rand = createSeededRandom(200);
            const level = generateLevel(100, rand);

            expect(level.gridSize).toBe(7);
            expect(level.difficulty).toBe("advanced");
        });

        it("should generate valid expert level", () => {
            const rand = createSeededRandom(300);
            const level = generateLevel(200, rand);

            expect(level.gridSize).toBe(8);
            expect(level.difficulty).toBe("expert");
        });

        it("should generate valid master level", () => {
            const rand = createSeededRandom(400);
            const level = generateLevel(400, rand);

            expect(level.gridSize).toBe(10);
            expect(level.difficulty).toBe("master");
        });

        it("should be solvable with solution angles", () => {
            const rand = createSeededRandom(50);
            const level = generateLevel(5, rand);

            // Apply solution angles
            const solvedCells = level.cells.map((c) => ({ ...c }));
            for (const sol of level.solution) {
                const cell = solvedCells.find(
                    (c) => c.row === sol.row && c.col === sol.col
                );
                if (cell) {
                    cell.mirrorAngle = sol.correctAngle;
                }
            }

            const { grid, cellMap } = buildGridAndCells(solvedCells, level.gridSize);
            const result = traceLaser(grid, cellMap, level.gridSize);

            expect(result.allTargetsHit).toBe(true);
        });

        it("scrambled state should NOT solve the puzzle", () => {
            const rand = createSeededRandom(50);
            const level = generateLevel(5, rand);

            // Use shipped (scrambled) angles
            const { grid, cellMap } = buildGridAndCells(level.cells, level.gridSize);
            const result = traceLaser(grid, cellMap, level.gridSize);

            expect(result.allTargetsHit).toBe(false);
        });

        it("laser should never go straight to target (no mirror needed)", () => {
            for (let lvl = 1; lvl <= 15; lvl++) {
                const rand = createSeededRandom(lvl * 7);
                const level = generateLevel(lvl, rand);
                expect(level.solution.length).toBeGreaterThanOrEqual(1);
            }
        });
    });

    // ── Batch Generation ──────────────────────────────
    describe("generateLevels", () => {
        it("should generate correct number of levels", () => {
            const levels = generateLevels(1, 5);
            expect(levels.length).toBe(5);
        });

        it("should have sequential level numbers", () => {
            const levels = generateLevels(10, 3);
            expect(levels.map((l) => l.levelNumber)).toEqual([10, 11, 12]);
        });

        it("should be deterministic (same input → same output)", () => {
            const levels1 = generateLevels(1, 5);
            const levels2 = generateLevels(1, 5);
            expect(levels1).toEqual(levels2);
        });
    });

    // ── Stress Test: All 500 Levels ───────────────────
    describe("500-level stress test", () => {
        it("should generate all 500 levels successfully", () => {
            const levels = generateLevels(1, 500);
            expect(levels.length).toBe(500);

            for (const level of levels) {
                const sources = level.cells.filter((c) => c.type === "source");
                expect(sources.length).toBe(1);

                const targets = level.cells.filter((c) => c.type === "target");
                expect(targets.length).toBeGreaterThanOrEqual(1);

                expect(level.solution.length).toBeGreaterThanOrEqual(1);
            }
        }, 120_000);

        it("all 500 levels should be solvable with solution angles", () => {
            const levels = generateLevels(1, 500);
            const failedLevels: number[] = [];

            for (const level of levels) {
                // Apply solution angles
                const solvedCells = level.cells.map((c) => ({ ...c }));
                for (const sol of level.solution) {
                    const cell = solvedCells.find(
                        (c) => c.row === sol.row && c.col === sol.col
                    );
                    if (cell) {
                        cell.mirrorAngle = sol.correctAngle;
                    }
                }

                const { grid, cellMap } = buildGridAndCells(solvedCells, level.gridSize);
                const result = traceLaser(grid, cellMap, level.gridSize);

                if (!result.allTargetsHit) {
                    failedLevels.push(level.levelNumber);
                    console.log(`FAIL Level ${level.levelNumber} (${level.difficulty})`);
                    console.log(`  hitBomb=${result.hitBomb}, hitTargets=[${[...result.hitTargets]}]`);
                    console.log(`  targets: ${level.cells.filter(c => c.type === "target").map(c => `(${c.row},${c.col})`).join(", ")}`);
                    console.log(`  source: ${level.cells.filter(c => c.type === "source").map(c => `(${c.row},${c.col})→${c.direction}`).join(", ")}`);
                    console.log(`  solution: ${level.solution.map(s => `(${s.row},${s.col})=a${s.correctAngle}`).join(", ")}`);
                    for (const sol of level.solution) {
                        const shipped = level.cells.find(c => c.row === sol.row && c.col === sol.col);
                        console.log(`    cell(${sol.row},${sol.col}): type=${shipped?.type} shipped_angle=${shipped?.mirrorAngle} correct=${sol.correctAngle}`);
                    }
                    if (failedLevels.length >= 3) break; // enough info
                }
            }

            expect(failedLevels).toEqual([]);
        }, 120_000);
    });
});
