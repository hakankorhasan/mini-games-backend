import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getTodayUTC } from "./utils/dailyPuzzleGenerator";

// ═══════════════════════════════════════════════════════════════
//  registerFCMToken
//
//  POST /registerFCMToken
//  Body: { deviceId, fcmToken, platform? }
//
//  iOS app calls this at launch and whenever the FCM token
//  refreshes. Stores the token in the user's doc for later
//  push notification delivery.
// ═══════════════════════════════════════════════════════════════

export const registerFCMToken = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { deviceId, fcmToken, platform } = req.body;

        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }
        if (!fcmToken || typeof fcmToken !== "string") {
            res.status(400).json({ success: false, error: "fcmToken is required." });
            return;
        }

        const db = admin.firestore();
        const userRef = db.collection("users").doc(deviceId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // User doesn't exist yet — store token in a pending collection
            // It will be associated when the profile is created
            await db.collection("fcmTokens").doc(deviceId).set({
                deviceId,
                fcmToken,
                platform: platform || "ios",
                notificationsEnabled: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            // User exists — update their doc + fcmTokens collection
            await userRef.update({
                fcmToken,
                fcmPlatform: platform || "ios",
                fcmUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await db.collection("fcmTokens").doc(deviceId).set({
                deviceId,
                fcmToken,
                platform: platform || "ios",
                notificationsEnabled: userDoc.data()?.notificationsEnabled !== false, // default true
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        functions.logger.info(`FCM token registered: device=${deviceId}`);
        res.status(200).json({ success: true });
    } catch (error) {
        functions.logger.error("registerFCMToken failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ═══════════════════════════════════════════════════════════════
//  updateNotificationSettings
//
//  POST /updateNotificationSettings
//  Body: { deviceId, enabled }
//
//  Allows users to opt-in/out of push notifications.
// ═══════════════════════════════════════════════════════════════

export const updateNotificationSettings = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { deviceId, enabled } = req.body;

        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }
        if (typeof enabled !== "boolean") {
            res.status(400).json({ success: false, error: "enabled must be a boolean." });
            return;
        }

        const db = admin.firestore();

        await db.collection("fcmTokens").doc(deviceId).set({
            notificationsEnabled: enabled,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // Also update user doc
        const userRef = db.collection("users").doc(deviceId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await userRef.update({ notificationsEnabled: enabled });
        }

        res.status(200).json({ success: true, notificationsEnabled: enabled });
    } catch (error) {
        functions.logger.error("updateNotificationSettings failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ═══════════════════════════════════════════════════════════════
//  sendDailyReminder — Scheduled Function
//
//  Runs every day at UTC 21:00 (3 hours before daily reset).
//  Checks which users haven't completed their daily challenge
//  and sends them a push notification reminder.
//
//  Cron: "0 21 * * *" → her gün UTC 21:00
//  (Türkiye saati ile 00:00, yani gece yarısı)
// ═══════════════════════════════════════════════════════════════

export const sendDailyReminder = functions.pubsub
    .schedule("0 21 * * *")
    .timeZone("UTC")
    .onRun(async () => {
        const db = admin.firestore();
        const todayDate = getTodayUTC();

        functions.logger.info(`Daily reminder check starting for ${todayDate}`);

        // 1. Get all registered FCM tokens (notifications enabled)
        const tokensSnapshot = await db
            .collection("fcmTokens")
            .where("notificationsEnabled", "==", true)
            .get();

        if (tokensSnapshot.empty) {
            functions.logger.info("No users with notifications enabled.");
            return;
        }

        // 2. Check each user's daily progress
        const tokensToNotify: string[] = [];
        const invalidTokenDeviceIds: string[] = [];

        for (const tokenDoc of tokensSnapshot.docs) {
            const { deviceId, fcmToken } = tokenDoc.data();

            if (!fcmToken) continue;

            // Check if user completed today's daily challenge
            const progressDoc = await db
                .collection("dailyProgress")
                .doc(deviceId)
                .get();

            let completed = false;
            if (progressDoc.exists) {
                const data = progressDoc.data()!;
                if (data.currentDate === todayDate && data.allCompleted === true) {
                    completed = true;
                }
            }

            if (!completed) {
                tokensToNotify.push(fcmToken);
            }
        }

        if (tokensToNotify.length === 0) {
            functions.logger.info("All users completed their daily challenge. No reminders needed.");
            return;
        }

        // 3. Send push notifications in batches (FCM supports 500 per batch)
        const BATCH_SIZE = 500;

        for (let i = 0; i < tokensToNotify.length; i += BATCH_SIZE) {
            const batch = tokensToNotify.slice(i, i + BATCH_SIZE);

            const message: admin.messaging.MulticastMessage = {
                tokens: batch,
                notification: {
                    title: "🧩 Günlük Challenge seni bekliyor!",
                    body: "Bugünkü 5 puzzle'ını henüz çözmedin. Streak'ini kaybetme! ⏰",
                },
                data: {
                    type: "daily_challenge_reminder",
                    date: todayDate,
                },
                apns: {
                    headers: {
                        "apns-priority": "5",  // Normal priority (not time-sensitive)
                    },
                    payload: {
                        aps: {
                            sound: "default",
                            badge: 1,
                            "thread-id": "daily-challenge",
                            "interruption-level": "active",
                        },
                    },
                },
            };

            try {
                const response = await admin.messaging().sendEachForMulticast(message);

                functions.logger.info(
                    `Daily reminder batch sent: ${response.successCount} success, ` +
                    `${response.failureCount} failures`
                );

                // Clean up invalid tokens
                response.responses.forEach((resp, idx) => {
                    if (resp.error) {
                        const errorCode = resp.error.code;
                        if (
                            errorCode === "messaging/invalid-registration-token" ||
                            errorCode === "messaging/registration-token-not-subscribed"
                        ) {
                            // Token is invalid — mark for cleanup
                            invalidTokenDeviceIds.push(batch[idx]);
                        }
                    }
                });
            } catch (error) {
                functions.logger.error("Failed to send daily reminder batch", error);
            }
        }

        // 4. Clean up invalid tokens
        if (invalidTokenDeviceIds.length > 0) {
            // We can't easily map back from token to deviceId in this flow,
            // so we'll log it. For production, consider storing device-token mapping.
            functions.logger.warn(
                `${invalidTokenDeviceIds.length} invalid tokens found during daily reminder.`
            );
        }

        functions.logger.info(
            `Daily reminder complete: ${tokensToNotify.length} users notified for ${todayDate}`
        );
    });

// ═══════════════════════════════════════════════════════════════
//  sendDailyReminderManual — HTTP endpoint for testing
//
//  POST /sendDailyReminderManual
//  Body: { adminKey }
//
//  Manually trigger the daily reminder (for testing).
// ═══════════════════════════════════════════════════════════════

export const sendDailyReminderManual = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { adminKey } = req.body;

        // Simple admin check (replace with proper auth in production)
        if (adminKey !== "mini-games-admin-2026") {
            res.status(403).json({ success: false, error: "Unauthorized." });
            return;
        }

        const db = admin.firestore();
        const todayDate = getTodayUTC();

        // Get all users with FCM tokens
        const tokensSnapshot = await db
            .collection("fcmTokens")
            .where("notificationsEnabled", "==", true)
            .get();

        let notifiedCount = 0;
        let skippedCount = 0;

        for (const tokenDoc of tokensSnapshot.docs) {
            const { deviceId, fcmToken } = tokenDoc.data();
            if (!fcmToken) continue;

            // Check daily progress
            const progressDoc = await db
                .collection("dailyProgress")
                .doc(deviceId)
                .get();

            let completed = false;
            if (progressDoc.exists) {
                const data = progressDoc.data()!;
                if (data.currentDate === todayDate && data.allCompleted === true) {
                    completed = true;
                }
            }

            if (completed) {
                skippedCount++;
                continue;
            }

            // Send individual notification
            try {
                await admin.messaging().send({
                    token: fcmToken,
                    notification: {
                        title: "🧩 Günlük Challenge seni bekliyor!",
                        body: "Bugünkü 5 puzzle'ını henüz çözmedin. Streak'ini kaybetme! ⏰",
                    },
                    data: {
                        type: "daily_challenge_reminder",
                        date: todayDate,
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: "default",
                                badge: 1,
                                "thread-id": "daily-challenge",
                            },
                        },
                    },
                });
                notifiedCount++;
            } catch (sendError) {
                functions.logger.warn(`Failed to send to ${deviceId}:`, sendError);
            }
        }

        res.status(200).json({
            success: true,
            date: todayDate,
            totalUsers: tokensSnapshot.size,
            notified: notifiedCount,
            skipped: skippedCount,
        });
    } catch (error) {
        functions.logger.error("sendDailyReminderManual failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
