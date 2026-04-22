/**
 * Tier / League system — Score-Based.
 *
 * Tiers are determined by the player's weightedGlobalScore:
 *   0       – 14,999   → Bronze
 *   15,000  – 49,999   → Silver
 *   50,000  – 149,999  → Gold
 *   150,000 – 299,999  → Platinum
 *   300,000 – 499,999  → Diamond
 *   500,000+           → Legend
 *
 * Rank (#47 Global) is a separate concept — shown alongside tier
 * but does NOT affect tier determination.
 */

export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Legend";

interface TierThreshold {
    name: Tier;
    minScore: number;
    maxScore: number; // Infinity for Legend
}

const TIER_THRESHOLDS: TierThreshold[] = [
    { name: "Bronze",   minScore: 0,       maxScore: 14999 },
    { name: "Silver",   minScore: 15000,   maxScore: 49999 },
    { name: "Gold",     minScore: 50000,   maxScore: 149999 },
    { name: "Platinum", minScore: 150000,  maxScore: 299999 },
    { name: "Diamond",  minScore: 300000,  maxScore: 499999 },
    { name: "Legend",   minScore: 500000,  maxScore: Infinity },
];

/**
 * Get tier from weightedGlobalScore (score-based).
 */
export function getTierByScore(weightedGlobalScore: number): Tier {
    for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
        if (weightedGlobalScore >= TIER_THRESHOLDS[i].minScore) {
            return TIER_THRESHOLDS[i].name;
        }
    }
    return "Bronze";
}

/**
 * Get tier progress info for the profile screen.
 * Returns current tier, next tier, progress percentage, and points remaining.
 */
export function getTierProgress(weightedGlobalScore: number) {
    const currentIndex = TIER_THRESHOLDS.findIndex(
        (t) => weightedGlobalScore >= t.minScore && weightedGlobalScore <= t.maxScore
    );
    const idx = currentIndex >= 0 ? currentIndex : 0;
    const current = TIER_THRESHOLDS[idx];
    const next = idx < TIER_THRESHOLDS.length - 1 ? TIER_THRESHOLDS[idx + 1] : null;

    let progress = 1.0; // Default for Legend (max tier)
    let pointsToNext = 0;

    if (next) {
        const range = next.minScore - current.minScore;
        const earned = weightedGlobalScore - current.minScore;
        progress = Math.min(1.0, Math.max(0, earned / range));
        pointsToNext = next.minScore - weightedGlobalScore;
    }

    return {
        currentTier: current.name,
        currentTierMin: current.minScore,
        currentTierMax: current.maxScore,
        nextTier: next?.name || null,
        nextTierMin: next?.minScore || null,
        progress: Math.round(progress * 1000) / 1000, // 3 decimal precision
        pointsToNext,
    };
}

// ── Legacy / backward compatibility ──────────────────────────────

/**
 * @deprecated Use getTierByScore instead. Kept for backward compatibility.
 * Now uses score-based logic internally.
 */
export function getTier(weightedGlobalScore: number): Tier {
    return getTierByScore(weightedGlobalScore);
}

/**
 * @deprecated Rank-based tier is no longer used.
 * Kept for backward compatibility — maps to score-based internally.
 */
export function getTierByRank(_rank: number): Tier {
    // No longer rank-based. Callers should migrate to getTierByScore.
    // Returns Bronze as placeholder — callers should pass score instead.
    return "Bronze";
}
