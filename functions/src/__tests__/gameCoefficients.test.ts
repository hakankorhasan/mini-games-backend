import { getCoefficient, calculateWeightedGlobalScore } from "../utils/gameCoefficients";

describe("gameCoefficients", () => {
    describe("getCoefficient", () => {
        it("should return correct coefficient for known games", () => {
            expect(getCoefficient("pipeConnect")).toBe(1.0);
            expect(getCoefficient("laserPuzzle")).toBe(1.2);
            expect(getCoefficient("hiddenPair")).toBe(0.8);
            expect(getCoefficient("binaryPuzzle")).toBe(1.3);
            expect(getCoefficient("pixelExcavation")).toBe(1.5);
            expect(getCoefficient("slitherlink")).toBe(1.5);
            expect(getCoefficient("blockFit")).toBe(1.0);
            expect(getCoefficient("cryptoCage")).toBe(1.4);
            expect(getCoefficient("neuralLink")).toBe(1.3);
            expect(getCoefficient("galacticBeacons")).toBe(1.5);
            expect(getCoefficient("numberCircuit")).toBe(1.2);
        });

        it("should return 1.0 for unknown game ids", () => {
            expect(getCoefficient("unknownGame")).toBe(1.0);
            expect(getCoefficient("")).toBe(1.0);
            expect(getCoefficient("notAGame")).toBe(1.0);
        });
    });

    describe("calculateWeightedGlobalScore", () => {
        it("should calculate correct weighted total for single game", () => {
            const result = calculateWeightedGlobalScore({
                laserPuzzle: 100,
            });

            // 100 × 1.2 = 120
            expect(result.weightedTotal).toBe(120);
            expect(result.breakdown).toHaveLength(1);
            expect(result.breakdown[0]).toEqual({
                gameId: "laserPuzzle",
                bestScore: 100,
                coefficient: 1.2,
                weightedScore: 120,
            });
        });

        it("should calculate correct weighted total for multiple games", () => {
            const result = calculateWeightedGlobalScore({
                pipeConnect: 100,     // 100 × 1.0 = 100
                hiddenPair: 200,      // 200 × 0.8 = 160
                slitherlink: 150,     // 150 × 1.5 = 225
            });

            // 100 + 160 + 225 = 485
            expect(result.weightedTotal).toBe(485);
            expect(result.breakdown).toHaveLength(3);
        });

        it("should return 0 for empty game scores", () => {
            const result = calculateWeightedGlobalScore({});

            expect(result.weightedTotal).toBe(0);
            expect(result.breakdown).toHaveLength(0);
        });

        it("should handle unknown game ids with default coefficient 1.0", () => {
            const result = calculateWeightedGlobalScore({
                unknownGame: 100,
            });

            // 100 × 1.0 = 100
            expect(result.weightedTotal).toBe(100);
            expect(result.breakdown[0].coefficient).toBe(1.0);
        });

        it("should round weighted scores correctly", () => {
            const result = calculateWeightedGlobalScore({
                laserPuzzle: 33, // 33 × 1.2 = 39.6 → 40
            });

            expect(result.weightedTotal).toBe(40);
            expect(result.breakdown[0].weightedScore).toBe(40);
        });

        it("should handle all games at once", () => {
            const result = calculateWeightedGlobalScore({
                pipeConnect: 100,
                laserPuzzle: 100,
                hiddenPair: 100,
                binaryPuzzle: 100,
                pixelExcavation: 100,
                slitherlink: 100,
                blockFit: 100,
                cryptoCage: 100,
                neuralLink: 100,
                galacticBeacons: 100,
                numberCircuit: 100,
            });

            // Sum of all coefficients × 100:
            // (1.0 + 1.2 + 0.8 + 1.3 + 1.5 + 1.5 + 1.0 + 1.4 + 1.3 + 1.5 + 1.2) × 100
            // = 13.7 × 100 = 1370
            expect(result.weightedTotal).toBe(1370);
            expect(result.breakdown).toHaveLength(11);
        });
    });
});
