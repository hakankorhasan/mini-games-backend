import { calculateRatingChange } from "../utils/rating";

describe("calculateRatingChange", () => {
    it("should increase rating for correct answer", () => {
        const result = calculateRatingChange({
            currentRating: 1000,
            difficulty: 3,
            correct: true,
            responseTime: 15,
        });

        // basePoints = 3 * 10 = 30, speedMultiplier = 1.2 (< 20s)
        // ratingChange = round(30 * 1.2) = 36
        expect(result.ratingChange).toBe(36);
        expect(result.newRating).toBe(1036);
    });

    it("should apply 1.5x multiplier for fast response (< 10s)", () => {
        const result = calculateRatingChange({
            currentRating: 1000,
            difficulty: 5,
            correct: true,
            responseTime: 8,
        });

        // basePoints = 50, speedMultiplier = 1.5
        // ratingChange = round(50 * 1.5) = 75
        expect(result.ratingChange).toBe(75);
        expect(result.newRating).toBe(1075);
    });

    it("should apply 2.0x multiplier for very fast response (< 5s)", () => {
        const result = calculateRatingChange({
            currentRating: 1000,
            difficulty: 3,
            correct: true,
            responseTime: 3,
        });

        // basePoints = 30, speedMultiplier = 2.0
        // ratingChange = round(30 * 2.0) = 60
        expect(result.ratingChange).toBe(60);
        expect(result.newRating).toBe(1060);
    });

    it("should apply 1.0x multiplier for slow response (>= 20s)", () => {
        const result = calculateRatingChange({
            currentRating: 1000,
            difficulty: 3,
            correct: true,
            responseTime: 25,
        });

        // basePoints = 30, speedMultiplier = 1.0
        expect(result.ratingChange).toBe(30);
        expect(result.newRating).toBe(1030);
    });

    it("should decrease rating for wrong answer", () => {
        const result = calculateRatingChange({
            currentRating: 1000,
            difficulty: 3,
            correct: false,
            responseTime: 15,
        });

        // ratingChange = -round(30 * 0.5) = -15
        expect(result.ratingChange).toBe(-15);
        expect(result.newRating).toBe(985);
    });

    it("should not go below 0", () => {
        const result = calculateRatingChange({
            currentRating: 5,
            difficulty: 10,
            correct: false,
            responseTime: 15,
        });

        // ratingChange = -round(100 * 0.5) = -50
        // newRating = max(0, 5 - 50) = 0
        expect(result.ratingChange).toBe(-50);
        expect(result.newRating).toBe(0);
    });

    it("should handle high difficulty correctly", () => {
        const result = calculateRatingChange({
            currentRating: 1500,
            difficulty: 10,
            correct: true,
            responseTime: 4,
        });

        // basePoints = 100, speedMultiplier = 2.0
        // ratingChange = 200
        expect(result.ratingChange).toBe(200);
        expect(result.newRating).toBe(1700);
    });
});
