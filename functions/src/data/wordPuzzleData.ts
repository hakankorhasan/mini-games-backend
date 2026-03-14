/**
 * Word Puzzle — Level configuration
 *
 * Level dağılımı (harf uzunluğuna göre):
 *   3 harf → Level   1–15   (15 level)
 *   4 harf → Level  16–55   (40 level)
 *   5 harf → Level  56–115  (60 level)
 *   6 harf → Level 116–175  (60 level)
 *   7 harf → Level 176–215  (40 level)
 *   8 harf → Level 216–235  (20 level)
 *                            ──────────
 *                            TOPLAM: 235 level
 *
 * Kelimeler 1000-most-common-words.txt dosyasından okunur
 * ve Firestore'a wordPool/{length} olarak yüklenir.
 * Her kullanıcıya her levelde rastgele kelime atanır.
 */

export interface WordPuzzleLevelConfig {
    minLevel: number;
    maxLevel: number;
    wordLength: number;
    difficulty: string;
}

export const levelConfig: WordPuzzleLevelConfig[] = [
    { minLevel: 1, maxLevel: 15, wordLength: 3, difficulty: "easy" },
    { minLevel: 16, maxLevel: 55, wordLength: 4, difficulty: "medium" },
    { minLevel: 56, maxLevel: 115, wordLength: 5, difficulty: "hard" },
    { minLevel: 116, maxLevel: 175, wordLength: 6, difficulty: "expert" },
    { minLevel: 176, maxLevel: 215, wordLength: 7, difficulty: "master" },
    { minLevel: 216, maxLevel: 235, wordLength: 8, difficulty: "grandmaster" },
];

export const TOTAL_LEVELS = 235;

/**
 * Level numarasından harf uzunluğu ve zorluk bilgisini döndürür.
 */
export function getLevelInfo(
    levelNumber: number
): { wordLength: number; difficulty: string } | null {
    for (const config of levelConfig) {
        if (levelNumber >= config.minLevel && levelNumber <= config.maxLevel) {
            return {
                wordLength: config.wordLength,
                difficulty: config.difficulty,
            };
        }
    }
    return null;
}
