/**
 * Tier / League system.
 *
 * Rating thresholds:
 *  0–999     → Bronze
 *  1000–1199 → Silver
 *  1200–1499 → Gold
 *  1500–1799 → Platinum
 *  1800+     → Diamond
 */

export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export function getTier(rating: number): Tier {
    if (rating >= 1800) return "Diamond";
    if (rating >= 1500) return "Platinum";
    if (rating >= 1200) return "Gold";
    if (rating >= 1000) return "Silver";
    return "Bronze";
}
