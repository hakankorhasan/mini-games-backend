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
