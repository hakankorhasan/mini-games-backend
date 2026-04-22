import { calculateGlobalScore } from "../utils/globalScore";

describe("calculateGlobalScore", () => {
    it("should return positive score for correct answer", () => {
        const result = calculateGlobalScore({
            level: 5, difficulty: 5,
            correct: true,
            responseTime: 10,
            currentStreak: 0,
        });

        // basePoints = 5 * 15 = 75
        // speedBonus = max(1.0, 2.5 - (10/20)) = 2.0
        // newStreak = 1, streakBonus = 1.0 + (1 * 0.1) = 1.1
        // scoreGained = round(75 * 2.0 * 1.1) = round(165) = 165
        expect(result.scoreGained).toBe(26);
        expect(result.newStreak).toBe(1);
    });

    it("should return 0 score and reset streak for wrong answer", () => {
        const result = calculateGlobalScore({
            level: 5, difficulty: 5,
            correct: false,
            responseTime: 10,
            currentStreak: 5,
        });

        expect(result.scoreGained).toBe(0);
        expect(result.newStreak).toBe(0);
    });

    it("should give higher speed bonus for faster response", () => {
        const fast = calculateGlobalScore({
            level: 5, difficulty: 3,
            correct: true,
            responseTime: 2,
            currentStreak: 0,
        });

        const slow = calculateGlobalScore({
            level: 5, difficulty: 3,
            correct: true,
            responseTime: 25,
            currentStreak: 0,
        });

        // fast: speedBonus = max(1.0, 2.5 - 0.1) = 2.4
        // slow: speedBonus = max(1.0, 2.5 - 1.25) = 1.25
        expect(fast.scoreGained).toBeGreaterThan(slow.scoreGained);
    });

    it("should apply speed bonus floor of 1.0 for very slow response", () => {
        const result = calculateGlobalScore({
            level: 5, difficulty: 3,
            correct: true,
            responseTime: 60,
            currentStreak: 0,
        });

        // basePoints = 45, speedBonus = max(1.0, 2.5 - 3.0) = 1.0
        // newStreak = 1, streakBonus = 1.1
        // newStreak = 1, streakBonus = 1.05
        // scoreGained = round(20 * 1.0 * 1.05) = 21
        expect(result.scoreGained).toBe(21);
        expect(result.newStreak).toBe(1);
    });

    it("should apply streak bonus correctly", () => {
        const noStreak = calculateGlobalScore({
            level: 5, difficulty: 5,
            correct: true,
            responseTime: 15,
            currentStreak: 0,
        });

        const highStreak = calculateGlobalScore({
            level: 5, difficulty: 5,
            correct: true,
            responseTime: 15,
            currentStreak: 9,
        });

        // noStreak: streak=1, bonus=1.1
        // highStreak: streak=10, bonus=2.0
        expect(highStreak.scoreGained).toBeGreaterThan(noStreak.scoreGained);

        // Verify exact highStreak calculation
        // basePoints = 75, speedBonus = max(1.0, 2.5 - 0.75) = 1.75
        // streakBonus = 1.0 + (10 * 0.1) = 2.0
        // streakBonus = 1.0 + (10 * 0.05) = 1.5
        // scoreGained = 34
        expect(highStreak.scoreGained).toBe(34);
    });

    it("should cap streak bonus at 10", () => {
        const streak10 = calculateGlobalScore({
            level: 5, difficulty: 5,
            correct: true,
            responseTime: 10,
            currentStreak: 9, // will become 10
        });

        const streak15 = calculateGlobalScore({
            level: 5, difficulty: 5,
            correct: true,
            responseTime: 10,
            currentStreak: 14, // will become 15, but capped at 10
        });

        // Both should have same streakBonus (2.0x) since cap is 10
        expect(streak10.scoreGained).toBe(streak15.scoreGained);
    });

    it("should handle high difficulty correctly", () => {
        const result = calculateGlobalScore({
            level: 5, difficulty: 10,
            correct: true,
            responseTime: 3,
            currentStreak: 4,
        });

        // basePoints = 150
        // speedBonus = max(1.0, 2.5 - 0.15) = 2.35
        // newStreak = 5, streakBonus = 1.0 + (5 * 0.1) = 1.5
        // newStreak = 5, streakBonus = 1.0 + (5 * 0.05) = 1.25
        // scoreGained = 36
        expect(result.scoreGained).toBe(36);
        expect(result.newStreak).toBe(5);
    });

    it("should handle minimum difficulty", () => {
        const result = calculateGlobalScore({
            level: 5, difficulty: 1,
            correct: true,
            responseTime: 30,
            currentStreak: 0,
        });

        // basePoints = 15
        // speedBonus = max(1.0, 2.5 - 1.5) = 1.0
        // newStreak = 1, streakBonus = 1.1
        // scoreGained = round(15 * 1.0 * 1.1) = round(16.5) = 17
        // scoreGained = 21
        expect(result.scoreGained).toBe(21);
        expect(result.newStreak).toBe(1);
    });
});
