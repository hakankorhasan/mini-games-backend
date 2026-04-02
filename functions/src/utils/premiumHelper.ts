/**
 * Premium Helper Functions
 *
 * Shared utilities for premium status management across endpoints.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
    PremiumStatus,
    PurchaseRecord,
    PRODUCT_ENTITLEMENTS,
    PRODUCT_IDS,
    EntitlementGrant,
} from "../types/premiumTypes";

// ─────────────────────────────────────────────────────────
// Default Premium Status
// ─────────────────────────────────────────────────────────

export const DEFAULT_PREMIUM: PremiumStatus = {
    removeAds: false,
    storyMode: false,
    ultimateBundle: false,
    purchases: [],
    lastVerifiedAt: null,
};

// ─────────────────────────────────────────────────────────
// Read Premium from Firestore Document
// ─────────────────────────────────────────────────────────

/**
 * Extracts premium status from a Firestore user document data.
 * Returns default (all false) if premium field is missing.
 */
export function getPremiumFromDoc(
    data: FirebaseFirestore.DocumentData | undefined
): { removeAds: boolean; storyMode: boolean; ultimateBundle: boolean } {
    const premium = data?.premium;
    return {
        removeAds: premium?.removeAds ?? false,
        storyMode: premium?.storyMode ?? false,
        ultimateBundle: premium?.ultimateBundle ?? false,
    };
}

// ─────────────────────────────────────────────────────────
// Entitlement Mapping
// ─────────────────────────────────────────────────────────

/**
 * Returns the entitlements granted by a product ID.
 * Returns null if the product ID is not recognized.
 */
export function getEntitlementsForProduct(
    productId: string
): EntitlementGrant | null {
    return PRODUCT_ENTITLEMENTS[productId] ?? null;
}

// ─────────────────────────────────────────────────────────
// Grant Purchase — Update Firestore
// ─────────────────────────────────────────────────────────

/**
 * Grants entitlements for a verified purchase.
 * Updates the premium field in users/{deviceId}.
 *
 * @returns The updated premium status (public fields only)
 */
export async function grantPurchase(
    deviceId: string,
    productId: string,
    transactionId: string,
    originalTransactionId: string,
    environment: "Production" | "Sandbox"
): Promise<{ removeAds: boolean; storyMode: boolean; ultimateBundle: boolean }> {
    const entitlements = getEntitlementsForProduct(productId);
    if (!entitlements) {
        throw new Error(`Unknown product ID: ${productId}`);
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(deviceId);

    const purchaseRecord: PurchaseRecord = {
        productId,
        transactionId,
        originalTransactionId,
        purchaseDate: admin.firestore.Timestamp.now(),
        environment,
        verified: true,
    };

    // Build update object — only set true flags (never flip existing true → false)
    const updateData: Record<string, unknown> = {
        "premium.lastVerifiedAt": admin.firestore.FieldValue.serverTimestamp(),
        "premium.purchases": admin.firestore.FieldValue.arrayUnion(purchaseRecord),
    };

    if (entitlements.removeAds) {
        updateData["premium.removeAds"] = true;
    }
    if (entitlements.storyMode) {
        updateData["premium.storyMode"] = true;
    }
    if (entitlements.ultimateBundle) {
        updateData["premium.ultimateBundle"] = true;
    }

    await userRef.set(updateData, { merge: true });

    // Read back the full premium status
    const updatedDoc = await userRef.get();
    return getPremiumFromDoc(updatedDoc.data());
}

// ─────────────────────────────────────────────────────────
// Revoke Purchase — For Refund / Revoke Notifications
// ─────────────────────────────────────────────────────────

/**
 * Revokes entitlements for a specific product.
 * Called when Apple sends a REFUND or REVOKE notification.
 *
 * Logic:
 * - If the product is ultimatebundle → set all three to false
 * - If the product is removeads → set removeAds to false
 *   (but keep it true if ultimateBundle is still active)
 * - If the product is storymode → set storyMode to false
 *   (but keep it true if ultimateBundle is still active)
 */
export async function revokeProduct(
    deviceId: string,
    productId: string
): Promise<void> {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(deviceId);

    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        functions.logger.warn(`revokeProduct: user ${deviceId} not found`);
        return;
    }

    const data = userDoc.data();
    const currentPremium = getPremiumFromDoc(data);

    // Determine which product family is being revoked
    const entitlements = getEntitlementsForProduct(productId);
    if (!entitlements) {
        functions.logger.warn(`revokeProduct: unknown product ${productId}`);
        return;
    }

    const updatedPremium: Record<string, boolean> = {};

    if (productId === PRODUCT_IDS.ULTIMATE_BUNDLE) {
        // Ultimate Bundle revoke: check if individual products were also purchased
        const purchases: PurchaseRecord[] = data?.premium?.purchases ?? [];
        const hasIndividualRemoveAds = purchases.some(
            (p: PurchaseRecord) => p.productId === PRODUCT_IDS.REMOVE_ADS
        );
        const hasIndividualStoryMode = purchases.some(
            (p: PurchaseRecord) => p.productId === PRODUCT_IDS.STORY_MODE
        );

        updatedPremium["premium.ultimateBundle"] = false;
        updatedPremium["premium.removeAds"] = hasIndividualRemoveAds;
        updatedPremium["premium.storyMode"] = hasIndividualStoryMode;
    } else {
        // Individual product revoke
        if (entitlements.removeAds && !currentPremium.ultimateBundle) {
            updatedPremium["premium.removeAds"] = false;
        }
        if (entitlements.storyMode && !currentPremium.ultimateBundle) {
            updatedPremium["premium.storyMode"] = false;
        }
    }

    if (Object.keys(updatedPremium).length > 0) {
        await userRef.update(updatedPremium);
        functions.logger.info(
            `Revoked product ${productId} for user ${deviceId}`,
            updatedPremium
        );
    }
}

// ─────────────────────────────────────────────────────────
// Check Duplicate Transaction
// ─────────────────────────────────────────────────────────

/**
 * Checks if a transactionId has already been processed for a device.
 * Prevents replay attacks.
 */
export async function isTransactionProcessed(
    deviceId: string,
    transactionId: string
): Promise<boolean> {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(deviceId).get();

    if (!userDoc.exists) return false;

    const purchases: PurchaseRecord[] = userDoc.data()?.premium?.purchases ?? [];
    return purchases.some((p: PurchaseRecord) => p.transactionId === transactionId);
}

// ─────────────────────────────────────────────────────────
// Find User by Original Transaction ID
// ─────────────────────────────────────────────────────────

/**
 * Finds the deviceId of a user who has a purchase with the given
 * originalTransactionId. Used by App Store Server Notifications.
 *
 * Note: This scans users collection. For non-consumable products
 * with rare refunds, this is acceptable. If needed, a separate
 * index collection can be added later.
 */
export async function findUserByOriginalTransactionId(
    originalTransactionId: string
): Promise<string | null> {
    const db = admin.firestore();

    // We need to scan users and check their purchases array
    // Since Firestore doesn't support array-contains on nested fields directly,
    // we'll query all users with purchases and filter in-memory.
    // For better performance, we maintain a separate lookup collection.

    // First, try the fast path: lookup collection
    const lookupDoc = await db
        .collection("purchaseLookup")
        .doc(originalTransactionId)
        .get();

    if (lookupDoc.exists) {
        return lookupDoc.data()?.deviceId ?? null;
    }

    // Fallback: scan users with non-empty purchases
    // This is slow but only happens for edge cases
    functions.logger.warn(
        `purchaseLookup miss for ${originalTransactionId}, scanning users...`
    );

    const usersSnapshot = await db
        .collection("users")
        .where("premium.purchases", "!=", [])
        .limit(500)
        .get();

    for (const doc of usersSnapshot.docs) {
        const purchases: PurchaseRecord[] = doc.data()?.premium?.purchases ?? [];
        const found = purchases.some(
            (p: PurchaseRecord) => p.originalTransactionId === originalTransactionId
        );
        if (found) {
            // Cache for future lookups
            await db.collection("purchaseLookup").doc(originalTransactionId).set({
                deviceId: doc.id,
                cachedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return doc.id;
        }
    }

    return null;
}

/**
 * Saves a purchase → deviceId mapping for fast lookups
 * during App Store Server Notifications.
 */
export async function savePurchaseLookup(
    originalTransactionId: string,
    deviceId: string
): Promise<void> {
    const db = admin.firestore();
    await db.collection("purchaseLookup").doc(originalTransactionId).set({
        deviceId,
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
