/**
 * Premium Endpoints
 *
 * Cloud Functions for in-app purchase verification and premium status management.
 *
 * Endpoints:
 * - POST /verifyPurchase    — Verify Apple IAP receipt (JWS) and grant entitlements
 * - GET  /getPremiumStatus  — Query premium status for a device
 * - POST /handleAppStoreNotification — Apple App Store Server Notifications V2 webhook
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { verifyAppleJWS, decodeJWSPayload } from "./utils/appleJWSVerifier";
import {
    grantPurchase,
    getPremiumFromDoc,
    isTransactionProcessed,
    revokeProduct,
    findUserByOriginalTransactionId,
    savePurchaseLookup,
} from "./utils/premiumHelper";
import {
    EXPECTED_BUNDLE_ID,
    PRODUCT_ENTITLEMENTS,
    AppleJWSTransactionPayload,
    AppStoreNotificationPayload,
} from "./types/premiumTypes";

// ─────────────────────────────────────────────────────────
// Rate Limiting (in-memory, per-instance)
// ─────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(deviceId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(deviceId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(deviceId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }

    entry.count++;
    return true;
}

// Clean up stale entries periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
        if (now > value.resetAt) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60_000);

// ─────────────────────────────────────────────────────────
// 1) VERIFY PURCHASE
// ─────────────────────────────────────────────────────────

/**
 * POST /verifyPurchase
 *
 * Verifies an Apple IAP receipt (JWS token from StoreKit 2)
 * and grants the corresponding entitlements.
 *
 * Body: {
 *   deviceId: string,
 *   productId: string,
 *   transactionId: string,
 *   originalTransactionId: string,
 *   receiptData: string (JWS token),
 *   environment: "Production" | "Sandbox"
 * }
 */
export const verifyPurchase = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const {
            deviceId,
            productId,
            transactionId,
            originalTransactionId,
            receiptData,
            environment,
        } = req.body;

        // ── Validate required fields ──
        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }

        if (!productId || typeof productId !== "string") {
            res.status(400).json({ success: false, error: "productId is required." });
            return;
        }

        if (!transactionId || typeof transactionId !== "string") {
            res.status(400).json({ success: false, error: "transactionId is required." });
            return;
        }

        if (!originalTransactionId || typeof originalTransactionId !== "string") {
            res.status(400).json({ success: false, error: "originalTransactionId is required." });
            return;
        }

        if (!receiptData || typeof receiptData !== "string") {
            res.status(400).json({ success: false, error: "receiptData (JWS token) is required." });
            return;
        }

        if (!environment || !["Production", "Sandbox"].includes(environment)) {
            res.status(400).json({
                success: false,
                error: "environment must be 'Production' or 'Sandbox'.",
            });
            return;
        }

        // ── Rate limiting ──
        if (!checkRateLimit(deviceId)) {
            res.status(429).json({
                success: false,
                error: "rate_limited",
                message: "Too many requests. Please try again later.",
            });
            return;
        }

        // ── Check known product ID ──
        if (!PRODUCT_ENTITLEMENTS[productId]) {
            res.status(400).json({
                success: false,
                error: "unknown_product",
                message: `Unknown product ID: ${productId}`,
            });
            return;
        }

        // ── Replay attack protection ──
        const alreadyProcessed = await isTransactionProcessed(deviceId, transactionId);
        if (alreadyProcessed) {
            // Not an error — just return current status (idempotent)
            const db = admin.firestore();
            const userDoc = await db.collection("users").doc(deviceId).get();
            const premium = getPremiumFromDoc(userDoc.data());

            res.status(200).json({
                success: true,
                premium,
                message: "Transaction already verified.",
            });
            return;
        }

        // ── Verify Apple JWS token ──
        let verifiedPayload: AppleJWSTransactionPayload;

        try {
            verifiedPayload = await verifyAppleJWS<AppleJWSTransactionPayload>(receiptData);
        } catch (jwsError) {
            functions.logger.error("JWS verification failed", {
                deviceId,
                productId,
                transactionId,
                error: (jwsError as Error).message,
            });

            res.status(403).json({
                success: false,
                error: "invalid_receipt",
                message: "Apple could not verify this receipt.",
            });
            return;
        }

        // ── Validate JWS payload matches request ──
        if (verifiedPayload.bundleId !== EXPECTED_BUNDLE_ID) {
            functions.logger.error("Bundle ID mismatch", {
                expected: EXPECTED_BUNDLE_ID,
                received: verifiedPayload.bundleId,
            });
            res.status(403).json({
                success: false,
                error: "bundle_mismatch",
                message: "Bundle ID does not match.",
            });
            return;
        }

        if (verifiedPayload.productId !== productId) {
            functions.logger.error("Product ID mismatch", {
                expected: productId,
                received: verifiedPayload.productId,
            });
            res.status(403).json({
                success: false,
                error: "product_mismatch",
                message: "Product ID in receipt does not match request.",
            });
            return;
        }

        if (verifiedPayload.transactionId !== transactionId) {
            functions.logger.error("Transaction ID mismatch", {
                expected: transactionId,
                received: verifiedPayload.transactionId,
            });
            res.status(403).json({
                success: false,
                error: "transaction_mismatch",
                message: "Transaction ID in receipt does not match request.",
            });
            return;
        }

        // ── Environment check — Sandbox receipts rejected in Production mode ──
        const isProduction = process.env.FUNCTIONS_EMULATOR !== "true" &&
            process.env.NODE_ENV !== "development";

        if (isProduction && verifiedPayload.environment === "Sandbox") {
            functions.logger.warn("Sandbox receipt rejected in production", {
                deviceId,
                productId,
                transactionId,
            });
            res.status(403).json({
                success: false,
                error: "sandbox_in_production",
                message: "Sandbox receipts are not accepted in production.",
            });
            return;
        }

        // ── All checks passed — Grant entitlements ──
        const premium = await grantPurchase(
            deviceId,
            productId,
            transactionId,
            originalTransactionId,
            environment
        );

        // Save lookup for future App Store notifications
        await savePurchaseLookup(originalTransactionId, deviceId);

        functions.logger.info("Purchase verified and granted", {
            deviceId,
            productId,
            transactionId,
            originalTransactionId,
            environment,
            premium,
        });

        res.status(200).json({
            success: true,
            premium,
            message: "Purchase verified successfully.",
        });
    } catch (error) {
        functions.logger.error("verifyPurchase failed", error);
        res.status(500).json({
            success: false,
            error: "internal_error",
            message: "An unexpected error occurred.",
        });
    }
});

// ─────────────────────────────────────────────────────────
// 2) GET PREMIUM STATUS
// ─────────────────────────────────────────────────────────

/**
 * GET /getPremiumStatus?deviceId=xxx
 *
 * Returns the premium entitlement status for a device.
 */
export const getPremiumStatus = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;

        if (!deviceId) {
            res.status(400).json({
                success: false,
                error: "deviceId query parameter is required.",
            });
            return;
        }

        const db = admin.firestore();
        const userDoc = await db.collection("users").doc(deviceId).get();

        const premium = getPremiumFromDoc(userDoc.data());

        res.status(200).json({
            success: true,
            premium,
        });
    } catch (error) {
        functions.logger.error("getPremiumStatus failed", error);
        res.status(500).json({
            success: false,
            error: "internal_error",
            message: "An unexpected error occurred.",
        });
    }
});

// ─────────────────────────────────────────────────────────
// 3) HANDLE APP STORE SERVER NOTIFICATION V2
// ─────────────────────────────────────────────────────────

/**
 * POST /handleAppStoreNotification
 *
 * Webhook endpoint called by Apple for server-to-server notifications.
 * Handles REFUND and REVOKE events to revoke entitlements.
 *
 * Apple sends: { signedPayload: "JWS_TOKEN" }
 */
export const handleAppStoreNotification = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { signedPayload } = req.body;

        if (!signedPayload || typeof signedPayload !== "string") {
            functions.logger.error("Missing signedPayload in notification");
            res.status(400).json({ error: "Missing signedPayload." });
            return;
        }

        // ── Verify and decode the notification payload ──
        let notification: AppStoreNotificationPayload;

        try {
            notification = await verifyAppleJWS<AppStoreNotificationPayload>(signedPayload);
        } catch (jwsError) {
            // In production, we should try to at least decode the payload for logging
            functions.logger.error("Notification JWS verification failed", {
                error: (jwsError as Error).message,
            });

            // Try to decode without verification for logging purposes
            try {
                const decoded = decodeJWSPayload<AppStoreNotificationPayload>(signedPayload);
                functions.logger.warn("Unverified notification payload (for logging only)", {
                    notificationType: decoded.notificationType,
                    notificationUUID: decoded.notificationUUID,
                });
            } catch (_decodeError) {
                // Can't even decode — truly invalid
            }

            res.status(403).json({ error: "Invalid notification signature." });
            return;
        }

        const { notificationType, subtype, data } = notification;

        functions.logger.info("Received App Store notification", {
            notificationType,
            subtype: subtype ?? "none",
            notificationUUID: notification.notificationUUID,
            environment: data.environment,
        });

        // ── Process based on notification type ──
        if (
            notificationType === "REFUND" ||
            notificationType === "REVOKE"
        ) {
            await handleRefundOrRevoke(notification);
        } else if (notificationType === "CONSUMPTION_REQUEST") {
            // Apple is asking if the user consumed the product
            // Log it for manual review
            functions.logger.info("Consumption request received", {
                notificationUUID: notification.notificationUUID,
                bundleId: data.bundleId,
            });
        } else if (notificationType === "TEST") {
            // Test notification from App Store Connect
            functions.logger.info("Test notification received from Apple");
        } else {
            // Log unknown/unhandled notification types
            functions.logger.info("Unhandled notification type", {
                notificationType,
                subtype: subtype ?? "none",
            });
        }

        // Always respond 200 to Apple — otherwise they'll retry
        res.status(200).send("OK");
    } catch (error) {
        functions.logger.error("handleAppStoreNotification failed", error);
        // Still return 200 to prevent Apple from retrying endlessly
        res.status(200).send("OK");
    }
});

// ─────────────────────────────────────────────────────────
// Internal: Handle Refund / Revoke
// ─────────────────────────────────────────────────────────

async function handleRefundOrRevoke(
    notification: AppStoreNotificationPayload
): Promise<void> {
    const { data, notificationType } = notification;

    // Decode the signed transaction info
    let transactionInfo: AppleJWSTransactionPayload;

    try {
        transactionInfo = await verifyAppleJWS<AppleJWSTransactionPayload>(
            data.signedTransactionInfo
        );
    } catch (error) {
        // Try decoding without verification
        functions.logger.warn(
            "Could not verify signedTransactionInfo JWS, decoding without verification",
            { error: (error as Error).message }
        );
        transactionInfo = decodeJWSPayload<AppleJWSTransactionPayload>(
            data.signedTransactionInfo
        );
    }

    const { originalTransactionId, productId } = transactionInfo;

    functions.logger.info(`Processing ${notificationType} for product`, {
        originalTransactionId,
        productId,
        environment: data.environment,
    });

    // Find the user by originalTransactionId
    const deviceId = await findUserByOriginalTransactionId(originalTransactionId);

    if (!deviceId) {
        functions.logger.error(
            `${notificationType}: Could not find user for originalTransactionId`,
            { originalTransactionId, productId }
        );
        return;
    }

    // Revoke the product entitlements
    await revokeProduct(deviceId, productId);

    functions.logger.info(`${notificationType} processed successfully`, {
        deviceId,
        productId,
        originalTransactionId,
    });
}
