import { getTier } from "../utils/tiers";

describe("getTier", () => {
    it("should return Bronze for rating 0-999", () => {
        expect(getTier(0)).toBe("Bronze");
        expect(getTier(500)).toBe("Bronze");
        expect(getTier(999)).toBe("Bronze");
    });

    it("should return Silver for rating 1000-1199", () => {
        expect(getTier(1000)).toBe("Silver");
        expect(getTier(1100)).toBe("Silver");
        expect(getTier(1199)).toBe("Silver");
    });

    it("should return Gold for rating 1200-1499", () => {
        expect(getTier(1200)).toBe("Gold");
        expect(getTier(1350)).toBe("Gold");
        expect(getTier(1499)).toBe("Gold");
    });

    it("should return Platinum for rating 1500-1799", () => {
        expect(getTier(1500)).toBe("Platinum");
        expect(getTier(1650)).toBe("Platinum");
        expect(getTier(1799)).toBe("Platinum");
    });

    it("should return Diamond for rating 1800+", () => {
        expect(getTier(1800)).toBe("Diamond");
        expect(getTier(2000)).toBe("Diamond");
        expect(getTier(5000)).toBe("Diamond");
    });
});
