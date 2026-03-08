import { Game } from "../types/gameTypes";

/**
 * Seed data — All 9 mini-games
 * Order matches the intended display order in the app.
 */

export const allGames: Game[] = [
    {
        id: "pipeConnect",
        name: "Pipe Connect",
        subtitle: "Rotate pipes to complete the flow",
        gameType: ".pipeConnect",
        hasStoryMode: false,
        requiresPro: false,
        order: 1,
    },
    {
        id: "laserPuzzle",
        name: "Laser Puzzle",
        subtitle: "Redirect laser beams to hit targets",
        gameType: ".laserPuzzle",
        hasStoryMode: false,
        requiresPro: false,
        order: 2,
    },
    {
        id: "hiddenPair",
        name: "Hidden Pair",
        subtitle: "Find matching pairs from memory",
        gameType: ".hiddenPair",
        hasStoryMode: false,
        requiresPro: false,
        order: 3,
    },
    {
        id: "binaryPuzzle",
        name: "Binary Puzzle",
        subtitle: "Fill the grid with 0s and 1s",
        gameType: ".binaryPuzzle",
        hasStoryMode: false,
        requiresPro: false,
        order: 4,
    },
    {
        id: "pixelExcavation",
        name: "Pixel Excavation",
        subtitle: "Uncover hidden pixel art layer by layer",
        gameType: ".nonogram",
        hasStoryMode: true,
        requiresPro: false,
        order: 5,
    },
    {
        id: "slitherlink",
        name: "Slitherlink",
        subtitle: "Draw a single loop following the clues",
        gameType: ".slitherlink",
        hasStoryMode: false,
        requiresPro: false,
        order: 6,
    },
    {
        id: "blockFit",
        name: "Block Fit",
        subtitle: "Fit all blocks into the grid perfectly",
        gameType: ".blockFit",
        hasStoryMode: false,
        requiresPro: false,
        order: 7,
    },
    {
        id: "cryptoCage",
        name: "Crypto-Cage",
        subtitle: "Solve cages with math and logic",
        gameType: ".cryptoCage",
        hasStoryMode: false,
        requiresPro: false,
        order: 8,
    },
    {
        id: "neuralLink",
        name: "Neural Link",
        subtitle: "Connect neurons to restore the brain",
        gameType: ".neuralLink",
        hasStoryMode: true,
        requiresPro: false,
        order: 9,
    },
];
