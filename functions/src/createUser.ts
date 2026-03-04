import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * createUser
 *
 * Firebase Auth trigger: automatically creates a Firestore user
 * document when a new user signs up (anonymous or Apple Sign In).
 */
export const createUser = functions.auth.user().onCreate(async (user) => {
    const db = admin.firestore();

    const userData = {
        username: user.displayName || `Player_${user.uid.substring(0, 6)}`,
        rating: 1000,
        seasonRating: 1000,
        tier: "Silver",
        country: "",
        gamesPlayed: 0,
        correctAnswers: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(user.uid).set(userData);

    functions.logger.info(`Created user document for ${user.uid}`, {
        uid: user.uid,
        username: userData.username,
    });

    return userData;
});
