/**
 * Daily Puzzle Generator
 *
 * Her gün 10 oyundan 5 tanesini seçer (deterministic shuffle).
 * Tüm oyuncular aynı gün aynı 5 oyunu görür.
 *
 * Seeded PRNG kullanır → aynı tarih = aynı sonuç.
 */

// ─── Seeded Random (mulberry32) ─────────────────────────────────

function createSeededRandom(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        hash = ((hash << 5) - hash + ch) | 0;
    }
    return hash;
}

// ─── Game Pool ──────────────────────────────────────────────────

export interface DailyPuzzleEntry {
    puzzleIndex: number;        // 1-5
    gameId: string;
}

/**
 * Havuzdaki 10 oyun.
 */
const GAME_POOL: string[] = [
    "pipeConnect",
    "laserPuzzle",
    "hiddenPair",
    "pixelExcavation",
    "slitherlink",
    "blockFit",
    "neuralLink",
    "galacticBeacons",
    "numberCircuit",
    "wordPuzzle",
];

const PUZZLES_PER_DAY = 5;

/**
 * Fisher–Yates shuffle (deterministic with seeded PRNG).
 */
function shuffle<T>(arr: T[], rand: () => number): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Generates today's 5 daily puzzles from the 10-game pool.
 *
 * @param dateString - "YYYY-MM-DD" format (UTC)
 * @returns Array of 5 DailyPuzzleEntry
 */
export function generateDailyPuzzles(dateString: string): DailyPuzzleEntry[] {
    const seed = hashString(`DailyChallenge-${dateString}`);
    const rand = createSeededRandom(seed);

    // Shuffle the 10-game pool and pick first 5
    const shuffled = shuffle(GAME_POOL, rand);
    const selected = shuffled.slice(0, PUZZLES_PER_DAY);

    return selected.map((game, index) => {
        return {
            puzzleIndex: index + 1,   // 1-based
            gameId: game,
        };
    });
}

/**
 * Returns today's UTC date string (YYYY-MM-DD).
 */
export function getTodayUTC(): string {
    return new Date().toISOString().split("T")[0];
}

/**
 * Seconds remaining until next UTC midnight.
 */
export function getSecondsUntilNextDay(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
    ));
    return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
}
