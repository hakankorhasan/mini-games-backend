import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all Cloud Functions
export { submitGameResult } from "./submitGameResult";
export { createUser } from "./createUser";
export { getLeaderboard } from "./getLeaderboard";
export { resetSeasonScheduled, resetSeasonManual } from "./resetSeason";
export { seedStories } from "./seedStories";
