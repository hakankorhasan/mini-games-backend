/**
 * Story System — TypeScript Interfaces
 *
 * These interfaces match the iOS GameStory / StoryLevel models exactly.
 * Used by the seed script to populate the gameStories Firestore collection.
 */

export interface StoryLevel {
    order: number;
    title: string;
    subtitle: string;

    // Grid config
    gridSize: number;
    flowCount?: number;          // Neural Link: synapse connection count
    deadNeuronCount?: number;    // Neural Link: blocker neuron count
    fillFraction?: number;       // Pixel Excavation: 0.35–0.50

    // Story content
    startMessages: string[];
    endTitle: string;
    endMessage: string;
    artifactText: string;
    artifactImageURL?: string | null;

    // Pixel Excavation extras
    expeditionLog?: string;
    scanDepth?: string;
    densitySignal?: string;
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
