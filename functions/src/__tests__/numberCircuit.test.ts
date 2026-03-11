import {
    createSeededRandom,
    getLevelConfig,
    generateGrid,
    generatePath,
    assignOperators,
    evaluateExpression,
    generateHints,
    generateLevel,
    generateDailyChallenge,
    buildExpressionString,
} from "../utils/numberCircuit";

describe("Number Circuit — Level Generator", () => {

    // ── Seeded Random ────────────────────────────────

    describe("createSeededRandom", () => {
        it("should produce deterministic values from same seed", () => {
            const r1 = createSeededRandom(42);
            const r2 = createSeededRandom(42);
            const values1 = Array.from({ length: 10 }, () => r1());
            const values2 = Array.from({ length: 10 }, () => r2());
            expect(values1).toEqual(values2);
        });

        it("should produce values between 0 and 1", () => {
            const r = createSeededRandom(123);
            for (let i = 0; i < 100; i++) {
                const v = r();
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThan(1);
            }
        });
    });

    // ── Level Config ──────────────────────────────────

    describe("getLevelConfig", () => {
        it("should return 3x3 grid for levels 1-10", () => {
            expect(getLevelConfig(1).gridSize).toBe(3);
            expect(getLevelConfig(10).gridSize).toBe(3);
        });

        it("should return 4x4 grid for levels 11-25", () => {
            expect(getLevelConfig(11).gridSize).toBe(4);
            expect(getLevelConfig(25).gridSize).toBe(4);
        });

        it("should return 5x5 grid for levels 26-60", () => {
            expect(getLevelConfig(26).gridSize).toBe(5);
            expect(getLevelConfig(60).gridSize).toBe(5);
        });

        it("should return 6x6 grid for levels 61+", () => {
            expect(getLevelConfig(61).gridSize).toBe(6);
            expect(getLevelConfig(100).gridSize).toBe(6);
        });

        it("should only allow + - for early levels", () => {
            const config = getLevelConfig(5);
            expect(config.allowedOperators).toEqual(["+", "-"]);
        });

        it("should include × for mid levels", () => {
            const config = getLevelConfig(15);
            expect(config.allowedOperators).toContain("×");
        });

        it("should include all operators for high levels", () => {
            const config = getLevelConfig(70);
            expect(config.allowedOperators).toContain("^");
            expect(config.allowedOperators).toContain("combine");
        });
    });

    // ── Grid Generation ───────────────────────────────

    describe("generateGrid", () => {
        it("should generate grid of correct size", () => {
            const r = createSeededRandom(1);
            const grid = generateGrid(3, r);
            expect(grid.length).toBe(3);
            grid.forEach((row) => expect(row.length).toBe(3));
        });

        it("should contain values between 1 and 9", () => {
            const r = createSeededRandom(2);
            const grid = generateGrid(5, r);
            for (const row of grid) {
                for (const val of row) {
                    expect(val).toBeGreaterThanOrEqual(1);
                    expect(val).toBeLessThanOrEqual(9);
                }
            }
        });

        it("should produce different grids for different seeds", () => {
            const g1 = generateGrid(3, createSeededRandom(10));
            const g2 = generateGrid(3, createSeededRandom(20));
            expect(g1).not.toEqual(g2);
        });
    });

    // ── Path Generation ───────────────────────────────

    describe("generatePath", () => {
        it("should generate path with minimum required length", () => {
            const r = createSeededRandom(3);
            const path = generatePath(3, 2, 3, r);
            expect(path.length).toBeGreaterThanOrEqual(2);
        });

        it("should not exceed maximum length", () => {
            const r = createSeededRandom(4);
            const path = generatePath(3, 2, 3, r);
            expect(path.length).toBeLessThanOrEqual(3);
        });

        it("should only contain adjacent cells", () => {
            const r = createSeededRandom(5);
            const path = generatePath(4, 3, 5, r);
            for (let i = 1; i < path.length; i++) {
                const dr = Math.abs(path[i].row - path[i - 1].row);
                const dc = Math.abs(path[i].col - path[i - 1].col);
                expect(dr).toBeLessThanOrEqual(1);
                expect(dc).toBeLessThanOrEqual(1);
                expect(dr + dc).toBeGreaterThan(0); // not same cell
            }
        });

        it("should not revisit cells", () => {
            const r = createSeededRandom(6);
            const path = generatePath(5, 3, 6, r);
            const keys = path.map((p) => `${p.row},${p.col}`);
            expect(new Set(keys).size).toBe(keys.length);
        });
    });

    // ── Operator Assignment ───────────────────────────

    describe("assignOperators", () => {
        it("should assign n-1 operators for n-length path", () => {
            const r = createSeededRandom(7);
            const ops = assignOperators(4, ["+", "-", "×"], r);
            expect(ops.length).toBe(3);
        });

        it("should only use allowed operators", () => {
            const r = createSeededRandom(8);
            const allowed = ["+", "-"] as const;
            const ops = assignOperators(5, [...allowed], r);
            ops.forEach((op) => {
                expect(["+", "-"]).toContain(op);
            });
        });
    });

    // ── Expression Evaluation ─────────────────────────

    describe("evaluateExpression", () => {
        it("should handle simple addition", () => {
            expect(evaluateExpression([3, 5], ["+"])).toBe(8);
        });

        it("should handle subtraction", () => {
            expect(evaluateExpression([10, 3], ["-"])).toBe(7);
        });

        it("should handle multiplication", () => {
            expect(evaluateExpression([6, 4], ["×"])).toBe(24);
        });

        it("should handle division", () => {
            expect(evaluateExpression([8, 2], ["÷"])).toBe(4);
        });

        it("should handle exponentiation", () => {
            expect(evaluateExpression([2, 3], ["^"])).toBe(8);
        });

        it("should respect math precedence (× before +)", () => {
            // 3 + 5 × 4 = 3 + 20 = 23
            expect(evaluateExpression([3, 5, 4], ["+", "×"])).toBe(23);
        });

        it("should respect math precedence (÷ before -)", () => {
            // 10 - 6 ÷ 2 = 10 - 3 = 7
            expect(evaluateExpression([10, 6, 2], ["-", "÷"])).toBe(7);
        });

        it("should handle digit combine", () => {
            // 1 combine 2 = 12
            expect(evaluateExpression([1, 2], ["combine"])).toBe(12);
        });

        it("should handle combine with operators", () => {
            // 1 combine 2 + 3 = 12 + 3 = 15
            expect(evaluateExpression([1, 2, 3], ["combine", "+"])).toBe(15);
        });

        it("should handle single value", () => {
            expect(evaluateExpression([5], [])).toBe(5);
        });

        it("should handle empty values", () => {
            expect(evaluateExpression([], [])).toBe(0);
        });

        it("should handle complex expression", () => {
            // 2 + 3 × 4 - 1 = 2 + 12 - 1 = 13
            expect(evaluateExpression([2, 3, 4, 1], ["+", "×", "-"])).toBe(13);
        });
    });

    // ── Hints ─────────────────────────────────────────

    describe("generateHints", () => {
        it("should provide first position as hint1", () => {
            const path = [
                { row: 0, col: 0 },
                { row: 0, col: 1 },
                { row: 1, col: 1 },
            ];
            const hints = generateHints(path, ["+", "×"]);
            expect(hints.hint1.position).toEqual({ row: 0, col: 0 });
        });

        it("should provide first two positions as hint2", () => {
            const path = [
                { row: 0, col: 0 },
                { row: 0, col: 1 },
                { row: 1, col: 1 },
            ];
            const hints = generateHints(path, ["+", "×"]);
            expect(hints.hint2.positions).toEqual([
                { row: 0, col: 0 },
                { row: 0, col: 1 },
            ]);
        });

        it("should reveal first operator in hint3", () => {
            const path = [
                { row: 0, col: 0 },
                { row: 0, col: 1 },
            ];
            const hints = generateHints(path, ["×"]);
            expect(hints.hint3.operator).toBe("×");
        });
    });

    // ── Expression String ─────────────────────────────

    describe("buildExpressionString", () => {
        it("should build correct expression", () => {
            const grid = [
                [6, 4, 2],
                [3, 5, 7],
                [1, 8, 9],
            ];
            const path = [
                { row: 0, col: 0 },
                { row: 0, col: 1 },
            ];
            const expr = buildExpressionString(grid, path, ["×"]);
            expect(expr).toBe("6 × 4");
        });
    });

    // ── Full Level Generation ─────────────────────────

    describe("generateLevel", () => {
        it("should generate a valid level for easy difficulty", () => {
            const r = createSeededRandom(100);
            const level = generateLevel(5, r);

            expect(level.gridSize).toBe(3);
            expect(level.grid.length).toBe(3);
            expect(level.target).toBeGreaterThan(0);
            expect(Number.isInteger(level.target)).toBe(true);
            expect(level.solution.length).toBeGreaterThanOrEqual(2);
            expect(level.hints).toBeDefined();
        });

        it("should generate a valid level for medium difficulty", () => {
            const r = createSeededRandom(200);
            const level = generateLevel(30, r);

            expect(level.gridSize).toBe(5);
            expect(level.target).toBeGreaterThan(0);
        });

        it("should generate a valid level for hard difficulty", () => {
            const r = createSeededRandom(300);
            const level = generateLevel(70, r);

            expect(level.gridSize).toBe(6);
            expect(level.target).toBeGreaterThan(0);
        });

        it("solution path should reference valid grid positions", () => {
            const r = createSeededRandom(400);
            const level = generateLevel(20, r);

            for (const step of level.solution) {
                expect(step.position.row).toBeLessThan(level.gridSize);
                expect(step.position.col).toBeLessThan(level.gridSize);
                expect(step.position.row).toBeGreaterThanOrEqual(0);
                expect(step.position.col).toBeGreaterThanOrEqual(0);
            }
        });
    });

    // ── Daily Challenge ───────────────────────────────

    describe("generateDailyChallenge", () => {
        it("should be deterministic for the same date", () => {
            const level1 = generateDailyChallenge("2026-03-11");
            const level2 = generateDailyChallenge("2026-03-11");
            expect(level1).toEqual(level2);
        });

        it("should produce different puzzles for different dates", () => {
            const level1 = generateDailyChallenge("2026-03-11");
            const level2 = generateDailyChallenge("2026-03-12");
            expect(level1.grid).not.toEqual(level2.grid);
        });

        it("should use 5x5 grid (medium difficulty)", () => {
            const level = generateDailyChallenge("2026-01-01");
            expect(level.gridSize).toBe(5);
        });
    });
});
