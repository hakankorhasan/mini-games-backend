/**
 * Game Registry — TypeScript Interface
 *
 * Represents a mini-game entry in the `games` Firestore collection.
 * Mobile clients fetch this list to know which games to display.
 */

export interface Game {
    id: string;                         // e.g. "neuralLink"
    name: string;                       // Display name: "Neural Link"
    subtitle: string;                   // Short description
    description?: string;               // Optional longer description (shown in detail screen)
    gameType: string;                   // iOS enum raw value: ".neuralLink"
    hasStoryMode: boolean;              // Whether story mode is available
    requiresPro: boolean;               // Whether Pro subscription is needed
    order: number;                      // Display order in the game list
    leaderboardCoefficient: number;     // Weight for global leaderboard (1.0 = normal)
}
