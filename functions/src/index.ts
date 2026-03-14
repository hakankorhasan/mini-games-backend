import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all Cloud Functions
export { submitGameResult } from "./submitGameResult";
export { createUser } from "./createUser";
export { getLeaderboard } from "./getLeaderboard";
export { resetSeasonScheduled, resetSeasonManual } from "./resetSeason";
export { seedStories } from "./seedStories";
export { seedGames } from "./seedGames";
export { uploadImage } from "./uploadImage";
export { saveStoryProgress, getStoryProgress } from "./storyProgress";
export { submitScore } from "./submitScore";
export { getPlayerLeaderboard } from "./getPlayerLeaderboard";
export { getPlayerStats } from "./getPlayerStats";
export { getDailyChallenge } from "./numberCircuitDaily";
export { getGlobalLeaderboard } from "./getGlobalLeaderboard";
export { getGameLeaderboard } from "./getGameLeaderboard";
export { getGameList } from "./getGameList";
export { getPlayerGameScores } from "./getPlayerGameScores";
export { seedNonogramLevels } from "./seedNonogramLevels";
export { getNonogramLevels } from "./getNonogramLevels";
export { saveNonogramProgress, getNonogramProgress } from "./nonogramProgress";
export { seedLaserPuzzleLevels } from "./seedLaserPuzzleLevels";
export { getLaserPuzzleLevels } from "./getLaserPuzzleLevels";
export { saveLaserPuzzleProgress, getLaserPuzzleProgress } from "./laserPuzzleProgress";
export { saveGameProgress, getGameProgress } from "./gameProgress";
export { seedWordPuzzleLevels } from "./seedWordPuzzleLevels";
export { getWordPuzzleLevel, checkWordPuzzleGuess, resetWordPuzzleSession, getWordPuzzleHint } from "./wordPuzzle";
