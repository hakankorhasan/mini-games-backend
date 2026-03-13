import {
    getLevelConfig,
    generateSolution,
    computeClues,
    computeAllClues,
    generateArrangements,
    solveNonogram,
    generateLevel,
    generateLevels,
} from "../utils/nonogram";
import { createSeededRandom } from "../utils/numberCircuit";

describe("Nonogram — Level Generator", () => {
    // ── Level Config ──────────────────────────────────

    describe("getLevelConfig", () => {
        it("should return 5×5 for levels 1–10", () => {
            expect(getLevelConfig(1).gridSize).toBe(5);
            expect(getLevelConfig(10).gridSize).toBe(5);
        });

        it("should return 6×6 for levels 11–25", () => {
            expect(getLevelConfig(11).gridSize).toBe(6);
            expect(getLevelConfig(25).gridSize).toBe(6);
        });

        it("should return 7×7 for levels 26–50", () => {
            expect(getLevelConfig(26).gridSize).toBe(7);
            expect(getLevelConfig(50).gridSize).toBe(7);
        });

        it("should return 8×8 for levels 51–80", () => {
            expect(getLevelConfig(51).gridSize).toBe(8);
            expect(getLevelConfig(80).gridSize).toBe(8);
        });

        it("should return 9×9 for levels 81–120", () => {
            expect(getLevelConfig(81).gridSize).toBe(9);
            expect(getLevelConfig(120).gridSize).toBe(9);
        });

        it("should return 10×10 for levels 121+", () => {
            expect(getLevelConfig(121).gridSize).toBe(10);
            expect(getLevelConfig(200).gridSize).toBe(10);
        });

        it("should never exceed 10×10", () => {
            expect(getLevelConfig(500).gridSize).toBe(10);
            expect(getLevelConfig(1000).gridSize).toBe(10);
        });

        it("should have decreasing fillFraction within a tier", () => {
            const start = getLevelConfig(1).fillFraction;
            const end = getLevelConfig(10).fillFraction;
            expect(start).toBeGreaterThan(end);
        });

        it("should return positive fillFraction for high levels", () => {
            expect(getLevelConfig(500).fillFraction).toBeGreaterThan(0.2);
        });
    });

    // ── Solution Generation ───────────────────────────

    describe("generateSolution", () => {
        it("should generate grid of correct size", () => {
            const rand = createSeededRandom(42);
            const solution = generateSolution(5, 0.5, rand);
            expect(solution.length).toBe(5);
            solution.forEach((row) => expect(row.length).toBe(5));
        });

        it("should have no fully-empty rows", () => {
            const rand = createSeededRandom(123);
            const solution = generateSolution(8, 0.35, rand);
            for (const row of solution) {
                expect(row.some(Boolean)).toBe(true);
            }
        });

        it("should have no fully-empty columns", () => {
            const rand = createSeededRandom(456);
            const solution = generateSolution(8, 0.35, rand);
            for (let c = 0; c < 8; c++) {
                const hasAny = solution.some((row) => row[c]);
                expect(hasAny).toBe(true);
            }
        });

        it("should have approximately correct fill ratio", () => {
            const rand = createSeededRandom(789);
            const solution = generateSolution(10, 0.4, rand);
            const filled = solution.flat().filter(Boolean).length;
            const ratio = filled / 100;
            expect(ratio).toBeGreaterThan(0.25);
            expect(ratio).toBeLessThan(0.60);
        });

        it("should produce different grids for different seeds", () => {
            const s1 = generateSolution(5, 0.5, createSeededRandom(1));
            const s2 = generateSolution(5, 0.5, createSeededRandom(2));
            expect(s1).not.toEqual(s2);
        });
    });

    // ── Clue Computation ──────────────────────────────

    describe("computeClues", () => {
        it("should return [0] for empty line", () => {
            expect(computeClues([false, false, false])).toEqual([0]);
        });

        it("should return single run", () => {
            expect(computeClues([true, true, true])).toEqual([3]);
        });

        it("should return multiple runs", () => {
            expect(
                computeClues([true, true, false, true, false, false, true])
            ).toEqual([2, 1, 1]);
        });

        it("should handle single filled cell", () => {
            expect(computeClues([false, true, false])).toEqual([1]);
        });

        it("should handle leading/trailing fills", () => {
            expect(computeClues([true, false, true])).toEqual([1, 1]);
        });

        it("should handle all filled", () => {
            expect(computeClues([true, true, true, true, true])).toEqual([5]);
        });
    });

    describe("computeAllClues", () => {
        it("should compute row and column clues correctly", () => {
            const solution = [
                [true, false, true],
                [false, true, false],
                [true, true, false],
            ];
            const { rowClues, colClues } = computeAllClues(solution);

            expect(rowClues).toEqual([[1, 1], [1], [2]]);
            expect(colClues).toEqual([[1, 1], [2], [1]]);
        });
    });

    // ── Arrangement Generation ────────────────────────

    describe("generateArrangements", () => {
        it("should return single all-empty arrangement for [0]", () => {
            const arrangements = generateArrangements([0], 5);
            expect(arrangements.length).toBe(1);
            expect(arrangements[0]).toEqual([
                false,
                false,
                false,
                false,
                false,
            ]);
        });

        it("should return correct number of arrangements for [1] in length 3", () => {
            // [1] in 3 cells: X.., .X., ..X → 3 arrangements
            const arrangements = generateArrangements([1], 3);
            expect(arrangements.length).toBe(3);
        });

        it("should return correct arrangements for [2] in length 4", () => {
            // XX.., .XX., ..XX → 3 arrangements
            const arrangements = generateArrangements([2], 4);
            expect(arrangements.length).toBe(3);
        });

        it("should return correct arrangements for [1,1] in length 4", () => {
            // X.X., X..X, .X.X → 3 arrangements
            const arrangements = generateArrangements([1, 1], 4);
            expect(arrangements.length).toBe(3);
        });

        it("should return 1 arrangement for [5] in length 5", () => {
            const arrangements = generateArrangements([5], 5);
            expect(arrangements.length).toBe(1);
            expect(arrangements[0]).toEqual([true, true, true, true, true]);
        });

        it("all arrangements should have correct length", () => {
            const arrangements = generateArrangements([2, 1], 7);
            for (const arr of arrangements) {
                expect(arr.length).toBe(7);
            }
        });
    });

    // ── Solver ────────────────────────────────────────

    describe("solveNonogram", () => {
        it("should solve a trivial 3×3 puzzle", () => {
            // Simple L-shape:
            // X . .
            // X . .
            // X X X
            const rowClues = [[1], [1], [3]];
            const colClues = [[3], [1], [1]];

            const solved = solveNonogram(rowClues, colClues, 3);
            expect(solved).not.toBeNull();
            expect(solved).toEqual([
                [true, false, false],
                [true, false, false],
                [true, true, true],
            ]);
        });

        it("should solve a 5×5 puzzle", () => {
            // Plus sign pattern:
            // . X .
            // X X X
            // . X .
            const solution = [
                [false, true, false],
                [true, true, true],
                [false, true, false],
            ];
            const rowClues = [[1], [3], [1]];
            const colClues = [[1], [3], [1]];

            const solved = solveNonogram(rowClues, colClues, 3);
            expect(solved).toEqual(solution);
        });

        it("should return null for ambiguous puzzle", () => {
            // 2×2 with clues [1],[1] for both rows and columns
            // This has 2 solutions: diagonal or anti-diagonal
            const rowClues = [[1], [1]];
            const colClues = [[1], [1]];

            const solved = solveNonogram(rowClues, colClues, 2);
            expect(solved).toBeNull();
        });
    });

    // ── Full Level Generation ─────────────────────────

    describe("generateLevel", () => {
        it("should generate a valid level for level 1", () => {
            const rand = createSeededRandom(100);
            const level = generateLevel(1, rand);

            expect(level.levelNumber).toBe(1);
            expect(level.gridSize).toBe(5);
            expect(level.solution.length).toBe(5);
            expect(level.rowClues.length).toBe(5);
            expect(level.colClues.length).toBe(5);
        });

        it("should generate a valid level for level 50", () => {
            const rand = createSeededRandom(200);
            const level = generateLevel(50, rand);

            expect(level.gridSize).toBe(7);
            expect(level.solution.length).toBe(7);
        });

        it("should generate a valid level for level 121 (max size)", () => {
            const rand = createSeededRandom(300);
            const level = generateLevel(121, rand);

            expect(level.gridSize).toBeLessThanOrEqual(10);
        });

        it("solution should match computed clues", () => {
            const rand = createSeededRandom(400);
            const level = generateLevel(5, rand);

            const { rowClues, colClues } = computeAllClues(level.solution);
            expect(level.rowClues).toEqual(rowClues);
            expect(level.colClues).toEqual(colClues);
        });

        it("should have no fully-empty rows or columns in solution", () => {
            const rand = createSeededRandom(500);
            const level = generateLevel(30, rand);

            for (const row of level.solution) {
                expect(row.some(Boolean)).toBe(true);
            }
            for (let c = 0; c < level.gridSize; c++) {
                expect(level.solution.some((row) => row[c])).toBe(true);
            }
        });

        it("puzzle should be solvable from clues alone", () => {
            const rand = createSeededRandom(600);
            const level = generateLevel(10, rand);

            const solved = solveNonogram(
                level.rowClues,
                level.colClues,
                level.gridSize
            );
            expect(solved).not.toBeNull();
            expect(solved).toEqual(level.solution);
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
            const levels1 = generateLevels(1, 3);
            const levels2 = generateLevels(1, 3);
            expect(levels1).toEqual(levels2);
        });

        it("all generated levels should have valid clues", () => {
            const levels = generateLevels(1, 10);
            for (const level of levels) {
                const { rowClues, colClues } = computeAllClues(level.solution);
                expect(level.rowClues).toEqual(rowClues);
                expect(level.colClues).toEqual(colClues);
            }
        });
    });
});
