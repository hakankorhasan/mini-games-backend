import { validateGameResult } from "../utils/validation";

describe("validateGameResult", () => {
    const validData = {
        gameId: "pipeConnect",
        difficulty: 3,
        correct: true,
        responseTime: 12.5,
    };

    it("should accept valid input", () => {
        expect(validateGameResult(validData)).toEqual({ valid: true });
    });

    it("should reject unknown gameId", () => {
        const result = validateGameResult({ ...validData, gameId: "unknown" });
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("Invalid gameId");
    });

    it("should reject difficulty < 1", () => {
        const result = validateGameResult({ ...validData, difficulty: 0 });
        expect(result.valid).toBe(false);
    });

    it("should reject difficulty > 10", () => {
        const result = validateGameResult({ ...validData, difficulty: 11 });
        expect(result.valid).toBe(false);
    });

    it("should reject responseTime < 0.5s (anti-cheat)", () => {
        const result = validateGameResult({ ...validData, responseTime: 0.3 });
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("Suspicious");
    });

    it("should reject responseTime > 300s", () => {
        const result = validateGameResult({ ...validData, responseTime: 500 });
        expect(result.valid).toBe(false);
    });

    it("should reject non-boolean correct", () => {
        const result = validateGameResult({ ...validData, correct: "yes" });
        expect(result.valid).toBe(false);
    });

    it("should accept all valid game IDs", () => {
        const gameIds = [
            "pipeConnect", "laserPuzzle", "hiddenPair", "binaryPuzzle",
            "pixelExcavation", "slitherlink", "blockFit", "cryptoCage",
            "neuralLink", "galacticBeacons", "numberCircuit",
        ];
        gameIds.forEach((gameId) => {
            expect(validateGameResult({ ...validData, gameId }).valid).toBe(true);
        });
    });
});
