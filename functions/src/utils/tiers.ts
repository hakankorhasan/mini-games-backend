/**
 * Tier / League system — Rank-based.
 *
 * Tiers are determined by the player's global leaderboard rank:
 *   Top 3        → Legend
 *   1–100        → Diamond
 *   101–500      → Platinum
 *   501–1000     → Gold
 *   1001–2000    → Silver
 *   2001+        → Bronze
 */

export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Legend";

/**
 * Get tier from global leaderboard rank.
 * rank = 1 means the player is #1 in the world.
 */
export function getTierByRank(rank: number): Tier {
    if (rank <= 3) return "Legend";
    if (rank <= 100) return "Diamond";
    if (rank <= 500) return "Platinum";
    if (rank <= 1000) return "Gold";
    if (rank <= 2000) return "Silver";
    return "Bronze";
}

/**
 * @deprecated Use getTierByRank instead. Kept for backward compatibility.
 */
export function getTier(_rating: number): Tier {
    return "Bronze"; // Default — will be overwritten by scheduled rank update
}
