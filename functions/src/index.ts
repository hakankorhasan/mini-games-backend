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
export { getDailyChallenge as getNumberCircuitDaily } from "./numberCircuitDaily";
export { getGlobalLeaderboard } from "./getGlobalLeaderboard";
export { getGameLeaderboard } from "./getGameLeaderboard";
export { getGameList } from "./getGameList";
export { getPlayerGameScores } from "./getPlayerGameScores";
export { getPlayerProfile } from "./getPlayerProfile";
export { seedNonogramLevels } from "./seedNonogramLevels";
export { getNonogramLevels } from "./getNonogramLevels";
export { saveNonogramProgress, getNonogramProgress } from "./nonogramProgress";
export { seedLaserPuzzleLevels } from "./seedLaserPuzzleLevels";
export { getLaserPuzzleLevels } from "./getLaserPuzzleLevels";
export { saveLaserPuzzleProgress, getLaserPuzzleProgress } from "./laserPuzzleProgress";
export { saveGameProgress, getGameProgress } from "./gameProgress";
export { seedWordPuzzleLevels } from "./seedWordPuzzleLevels";
export { getWordPuzzleLevel, checkWordPuzzleGuess, resetWordPuzzleSession, getWordPuzzleHint } from "./wordPuzzle";
export { seedPipeConnectLevels } from "./seedPipeConnectLevels";
export { getPipeConnectLevels } from "./getPipeConnectLevels";
export { seedBlockFitLevels } from "./seedBlockFitLevels";
export { getBlockFitLevels } from "./getBlockFitLevels";
export { seedSlitherlinkLevels } from "./seedSlitherlinkLevels";
export { getSlitherlinkLevels } from "./getSlitherlinkLevels";
export { seedNeuralLinkLevels } from "./seedNeuralLinkLevels";
export { getNeuralLinkLevels } from "./getNeuralLinkLevels";
export { getAvatars, createProfile, updateProfile, getProfile, checkDevice } from "./userProfile";
export { getOnboardings, manageOnboarding } from "./getOnboardings";
export { seedOnboardings } from "./seedOnboardings";
export {
    getDailyChallenge,
    submitDailyPuzzle,
    getDailyProgress,
    getDailyStreak,
} from "./dailyChallenge";
export { verifyPurchase, getPremiumStatus, handleAppStoreNotification } from "./premium";
export {
    registerFCMToken,
    updateNotificationSettings,
    sendDailyReminder,
    sendDailyReminderManual,
} from "./notifications";
export { seedStarBattleLevels } from "./seedStarBattleLevels";
export { getStarBattleLevels } from "./getStarBattleLevels";
export { seedArrowPuzzleLevels } from "./seedArrowPuzzleLevels";
export { getArrowPuzzleLevels } from "./getArrowPuzzleLevels";
export { getStorySliders } from "./getStorySliders";
export { migratePremiumField } from "./migratePremiumField";
