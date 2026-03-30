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
    difficulty: number;         // 1-10
}

/**
 * Havuzdaki 10 oyun.
 * Her oyun için zorluk aralığı tanımlı.
 */
const GAME_POOL: { gameId: string; minDifficulty: number; maxDifficulty: number }[] = [
    { gameId: "pipeConnect",       minDifficulty: 3, maxDifficulty: 6 },
    { gameId: "laserPuzzle",       minDifficulty: 3, maxDifficulty: 7 },
    { gameId: "hiddenPair",        minDifficulty: 2, maxDifficulty: 5 },
    { gameId: "pixelExcavation",   minDifficulty: 3, maxDifficulty: 6 },
    { gameId: "slitherlink",       minDifficulty: 3, maxDifficulty: 6 },
    { gameId: "blockFit",          minDifficulty: 2, maxDifficulty: 5 },
    { gameId: "neuralLink",        minDifficulty: 3, maxDifficulty: 6 },
    { gameId: "galacticBeacons",   minDifficulty: 3, maxDifficulty: 6 },
    { gameId: "numberCircuit",     minDifficulty: 3, maxDifficulty: 7 },
    { gameId: "wordPuzzle",        minDifficulty: 3, maxDifficulty: 6 },
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
        // Deterministic difficulty within the game's range
        const diffRange = game.maxDifficulty - game.minDifficulty + 1;
        const difficulty = game.minDifficulty + Math.floor(rand() * diffRange);

        return {
            puzzleIndex: index + 1,   // 1-based
            gameId: game.gameId,
            difficulty,
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
