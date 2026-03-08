/**
 * Story System — TypeScript Interfaces
 *
 * These interfaces match the iOS GameStory / StoryLevel models.
 * Used by the seed script to populate the gameStories Firestore collection.
 */

/**
 * A single narrative event within a level.
 * Each level can contain one or more events — the player plays
 * the level once per event before advancing to the next level.
 */
export interface StoryEvent {
    order: number;                    // 1, 2, 3... sıra
    startMessages: string[];          // Typewriter mesajları
    endTitle: string;                 // "Memory Fragment Recovered"
    endMessage: string;               // Sonuç mesajı
    artifactText: string;             // İtalik gösterilecek metin
    artifactImageURL?: string | null; // Firebase Storage URL

    // Pixel Excavation extras (Neural Link için null bırak)
    expeditionLog?: string;
    scanDepth?: string;               // "1.5m"
    densitySignal?: string;           // "Low", "Medium", "High"
}

export interface StoryLevel {
    order: number;
    title: string;
    subtitle: string;

    // Grid config
    gridSize: number;
    flowCount?: number;          // Neural Link: synapse connection count
    deadNeuronCount?: number;    // Neural Link: blocker neuron count
    fillFraction?: number;       // Pixel Excavation: 0.35–0.50

    // Events — replaces the old single-event fields
    events: StoryEvent[];
}

export interface GameStory {
    id: string;
    gameType: "neuralLink" | "pixelExcavation";
    title: string;
    subtitle: string;
    icon: string;
    coverImageURL: string | null;
    themeColors: string[];
    order: number;
    levels: StoryLevel[];
}
