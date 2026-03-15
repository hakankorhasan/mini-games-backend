import {
    getDifficultyConfig,
    generateLevel,
    generateLevels,
    generatePrefill,
    buildBlockPool,
    BLOCK_TEMPLATES,
    GRID_SIZE,
    TOTAL_BLOCK_FIT_LEVELS,
    COLORS,
    PREFILL_COLOR_INDEX,
} from "../utils/blockFitGenerator";
import { createSeededRandom } from "../utils/numberCircuit";

describe("Block Fit — Level Generator", () => {
    // ── Difficulty Config ─────────────────────────────────────
    describe("getDifficultyConfig", () => {
        it("should return beginner for levels 1–100", () => {
            expect(getDifficultyConfig(1).difficulty).toBe("beginner");
            expect(getDifficultyConfig(1).difficultyValue).toBe(1);
            expect(getDifficultyConfig(40).difficulty).toBe("beginner");
            expect(getDifficultyConfig(41).difficultyValue).toBe(2);
            expect(getDifficultyConfig(100).difficulty).toBe("beginner");
        });

        it("should return intermediate for levels 101–280", () => {
            expect(getDifficultyConfig(101).difficulty).toBe("intermediate");
            expect(getDifficultyConfig(101).difficultyValue).toBe(3);
            expect(getDifficultyConfig(180).difficulty).toBe("intermediate");
            expect(getDifficultyConfig(181).difficultyValue).toBe(4);
            expect(getDifficultyConfig(280).difficulty).toBe("intermediate");
        });

        it("should return advanced for levels 281–500", () => {
            expect(getDifficultyConfig(281).difficulty).toBe("advanced");
            expect(getDifficultyConfig(281).difficultyValue).toBe(5);
            expect(getDifficultyConfig(400).difficulty).toBe("advanced");
            expect(getDifficultyConfig(401).difficultyValue).toBe(6);
            expect(getDifficultyConfig(500).difficulty).toBe("advanced");
        });

        it("should return expert for levels 501–750", () => {
            expect(getDifficultyConfig(501).difficulty).toBe("expert");
            expect(getDifficultyConfig(501).difficultyValue).toBe(7);
            expect(getDifficultyConfig(620).difficulty).toBe("expert");
            expect(getDifficultyConfig(621).difficultyValue).toBe(8);
            expect(getDifficultyConfig(750).difficulty).toBe("expert");
        });

        it("should return master for levels 751+", () => {
            expect(getDifficultyConfig(751).difficulty).toBe("master");
            expect(getDifficultyConfig(751).difficultyValue).toBe(9);
            expect(getDifficultyConfig(880).difficulty).toBe("master");
            expect(getDifficultyConfig(881).difficultyValue).toBe(10);
            expect(getDifficultyConfig(1000).difficulty).toBe("master");
        });

        it("should progressively increase targetScore", () => {
            const scores = [1, 50, 150, 250, 350, 450, 550, 700, 800, 950].map(
                (lvl) => getDifficultyConfig(lvl).targetScore
            );
            for (let i = 1; i < scores.length; i++) {
                expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
            }
        });

        it("should have difficultyValue between 1 and 10", () => {
            for (let lvl = 1; lvl <= 1000; lvl += 5) {
                const cfg = getDifficultyConfig(lvl);
                expect(cfg.difficultyValue).toBeGreaterThanOrEqual(1);
                expect(cfg.difficultyValue).toBeLessThanOrEqual(10);
            }
        });

        it("intermediate II should start introducing prefill", () => {
            // Second half of intermediate II (level 231+)
            const cfg = getDifficultyConfig(250);
            expect(cfg.prefillRows).toBeGreaterThanOrEqual(1);
        });

        it("expert II should have 2 prefillRows", () => {
            const cfg = getDifficultyConfig(700);
            expect(cfg.prefillRows).toBe(2);
        });

        it("master II should have 3-4 prefillRows", () => {
            const cfg = getDifficultyConfig(950);
            expect(cfg.prefillRows).toBeGreaterThanOrEqual(3);
            expect(cfg.prefillRows).toBeLessThanOrEqual(4);
        });

        it("maxBlockIndex should increase through tiers", () => {
            expect(getDifficultyConfig(1).maxBlockIndex).toBe(8);
            expect(getDifficultyConfig(150).maxBlockIndex).toBe(16);
            expect(getDifficultyConfig(350).maxBlockIndex).toBe(22);
            expect(getDifficultyConfig(450).maxBlockIndex).toBe(23);
            expect(getDifficultyConfig(550).maxBlockIndex).toBe(26);
            expect(getDifficultyConfig(700).maxBlockIndex).toBe(28);
        });
    });

    // ── Block Templates ───────────────────────────────────────
    describe("BLOCK_TEMPLATES", () => {
        it("should have 29 templates (indices 0–28)", () => {
            expect(BLOCK_TEMPLATES.length).toBe(29);
        });

        it("should have sequential indices", () => {
            BLOCK_TEMPLATES.forEach((tmpl, i) => {
                expect(tmpl.index).toBe(i);
            });
        });

        it("single block should have 1 cell", () => {
            expect(BLOCK_TEMPLATES[0].cells.length).toBe(1);
        });

        it("3x3 block should have 9 cells", () => {
            expect(BLOCK_TEMPLATES[24].cells.length).toBe(9);
        });

        it("corner shapes should have 5 cells each", () => {
            for (let i = 25; i <= 28; i++) {
                expect(BLOCK_TEMPLATES[i].cells.length).toBe(5);
            }
        });
    });

    // ── Prefill Generation ────────────────────────────────────
    describe("generatePrefill", () => {
        it("should return empty array for 0 prefillRows", () => {
            const rand = createSeededRandom(42);
            const prefill = generatePrefill(0, rand);
            expect(prefill).toEqual([]);
        });

        it("should generate correct number of cells for 1 row", () => {
            const rand = createSeededRandom(42);
            const prefill = generatePrefill(1, rand);
            expect(prefill.length).toBeGreaterThanOrEqual(6);
            expect(prefill.length).toBeLessThanOrEqual(7);
        });

        it("should place prefill on bottom rows", () => {
            const rand = createSeededRandom(42);
            const prefill = generatePrefill(2, rand);
            const rows = new Set(prefill.map((c) => c.row));
            expect(rows.has(GRID_SIZE - 1)).toBe(true);
            expect(rows.has(GRID_SIZE - 2)).toBe(true);
        });

        it("should handle 4 prefillRows", () => {
            const rand = createSeededRandom(42);
            const prefill = generatePrefill(4, rand);
            const rows = new Set(prefill.map((c) => c.row));
            expect(rows.size).toBe(4);
            expect(rows.has(GRID_SIZE - 1)).toBe(true);
            expect(rows.has(GRID_SIZE - 4)).toBe(true);
        });

        it("should use prefill color index", () => {
            const rand = createSeededRandom(42);
            const prefill = generatePrefill(1, rand);
            prefill.forEach((c) => {
                expect(c.colorIndex).toBe(PREFILL_COLOR_INDEX);
            });
        });

        it("should leave gaps in each row", () => {
            const rand = createSeededRandom(42);
            const prefill = generatePrefill(1, rand);
            const filledCols = prefill.map((c) => c.col);
            expect(filledCols.length).toBeLessThan(GRID_SIZE);
        });
    });

    // ── Block Pool ────────────────────────────────────────────
    describe("buildBlockPool", () => {
        it("should include indices 0 to maxBlockIndex", () => {
            const pool = buildBlockPool(8);
            expect(pool).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        });

        it("should include all 29 blocks for maxBlockIndex 28", () => {
            const pool = buildBlockPool(28);
            expect(pool.length).toBe(29);
            expect(pool[0]).toBe(0);
            expect(pool[28]).toBe(28);
        });
    });

    // ── Level Generation ──────────────────────────────────────
    describe("generateLevel", () => {
        it("should generate valid beginner level", () => {
            const rand = createSeededRandom(42);
            const level = generateLevel(1, rand);

            expect(level.levelNumber).toBe(1);
            expect(level.gridSize).toBe(9);
            expect(level.difficulty).toBe("beginner");
            expect(level.targetScore).toBeGreaterThan(0);
            expect(level.difficultyValue).toBeGreaterThanOrEqual(1);
            expect(level.prefill).toEqual([]);
            expect(level.blockPool.length).toBe(9);
        });

        it("should generate valid intermediate level", () => {
            const rand = createSeededRandom(100);
            const level = generateLevel(150, rand);

            expect(level.difficulty).toBe("intermediate");
            expect(level.blockPool.length).toBe(17); // indices 0–16
        });

        it("should generate valid expert level with prefill", () => {
            const rand = createSeededRandom(300);
            const level = generateLevel(600, rand);

            expect(level.difficulty).toBe("expert");
            expect(level.prefill.length).toBeGreaterThan(0);
        });

        it("should generate valid master level", () => {
            const rand = createSeededRandom(400);
            const level = generateLevel(900, rand);

            expect(level.difficulty).toBe("master");
            expect(level.blockPool.length).toBe(29);
            expect(level.prefill.length).toBeGreaterThan(0);
        });

        it("blockPool should only contain valid indices", () => {
            for (let lvl = 1; lvl <= 1000; lvl += 50) {
                const rand = createSeededRandom(lvl);
                const level = generateLevel(lvl, rand);
                const cfg = getDifficultyConfig(lvl);

                level.blockPool.forEach((idx) => {
                    expect(idx).toBeGreaterThanOrEqual(0);
                    expect(idx).toBeLessThanOrEqual(cfg.maxBlockIndex);
                });
            }
        });
    });

    // ── Batch Generation ──────────────────────────────────────
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

    // ── Stress Test: All 1000 Levels ──────────────────────────
    describe("1000-level stress test", () => {
        it("should generate all 1000 levels successfully", () => {
            const levels = generateLevels(1, TOTAL_BLOCK_FIT_LEVELS);
            expect(levels.length).toBe(1000);

            for (const level of levels) {
                expect(level.gridSize).toBe(9);
                expect(level.targetScore).toBeGreaterThan(0);
                expect([
                    "beginner",
                    "intermediate",
                    "advanced",
                    "expert",
                    "master",
                ]).toContain(level.difficulty);
                expect(level.difficultyValue).toBeGreaterThanOrEqual(1);
                expect(level.difficultyValue).toBeLessThanOrEqual(10);
                expect(level.blockPool.length).toBeGreaterThan(0);

                level.blockPool.forEach((idx) => {
                    expect(idx).toBeGreaterThanOrEqual(0);
                    expect(idx).toBeLessThanOrEqual(28);
                });

                level.prefill.forEach((cell) => {
                    expect(cell.row).toBeGreaterThanOrEqual(0);
                    expect(cell.row).toBeLessThan(GRID_SIZE);
                    expect(cell.col).toBeGreaterThanOrEqual(0);
                    expect(cell.col).toBeLessThan(GRID_SIZE);
                });
            }
        }, 60_000);

        it("difficulty should progress through tiers", () => {
            const levels = generateLevels(1, TOTAL_BLOCK_FIT_LEVELS);

            expect(levels[0].difficulty).toBe("beginner");
            expect(levels[99].difficulty).toBe("beginner");
            expect(levels[100].difficulty).toBe("intermediate");
            expect(levels[280].difficulty).toBe("advanced");
            expect(levels[500].difficulty).toBe("expert");
            expect(levels[750].difficulty).toBe("master");
            expect(levels[999].difficulty).toBe("master");
        });

        it("targetScore should generally increase across tiers", () => {
            const levels = generateLevels(1, TOTAL_BLOCK_FIT_LEVELS);

            // Compare first level of each major tier
            expect(levels[100].targetScore).toBeGreaterThan(levels[0].targetScore);
            expect(levels[280].targetScore).toBeGreaterThan(levels[100].targetScore);
            expect(levels[500].targetScore).toBeGreaterThan(levels[280].targetScore);
            expect(levels[750].targetScore).toBeGreaterThan(levels[500].targetScore);
            expect(levels[999].targetScore).toBeGreaterThan(levels[750].targetScore);
        });

        it("prefillRows should increase in later tiers", () => {
            const levels = generateLevels(1, TOTAL_BLOCK_FIT_LEVELS);

            // Beginner: no prefill
            expect(levels[0].prefill.length).toBe(0);
            // Master II: has prefill
            expect(levels[999].prefill.length).toBeGreaterThan(0);
        });
    });

    // ── Constants ─────────────────────────────────────────────
    describe("constants", () => {
        it("should have 8 colors", () => {
            expect(COLORS.length).toBe(8);
        });

        it("TOTAL_BLOCK_FIT_LEVELS should be 1000", () => {
            expect(TOTAL_BLOCK_FIT_LEVELS).toBe(1000);
        });

        it("GRID_SIZE should be 9", () => {
            expect(GRID_SIZE).toBe(9);
        });
    });
});
