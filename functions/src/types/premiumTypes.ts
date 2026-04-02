/**
 * Premium System Types
 *
 * Type definitions for the in-app purchase / premium entitlement system.
 */

// ─────────────────────────────────────────────────────────
// Purchase Record — stored in users/{deviceId}.premium.purchases[]
// ─────────────────────────────────────────────────────────

export interface PurchaseRecord {
    productId: string;
    transactionId: string;
    originalTransactionId: string;
    purchaseDate: FirebaseFirestore.Timestamp;
    environment: "Production" | "Sandbox";
    verified: boolean;
}

// ─────────────────────────────────────────────────────────
// Premium Status — stored in users/{deviceId}.premium
// ─────────────────────────────────────────────────────────

export interface PremiumStatus {
    removeAds: boolean;
    storyMode: boolean;
    ultimateBundle: boolean;
    purchases: PurchaseRecord[];
    lastVerifiedAt: FirebaseFirestore.Timestamp | null;
}

// ─────────────────────────────────────────────────────────
// Product → Entitlement Mapping
// ─────────────────────────────────────────────────────────

export const PRODUCT_IDS = {
    REMOVE_ADS: "com.brainland.removeads",
    STORY_MODE: "com.brainland.storymode",
    ULTIMATE_BUNDLE: "com.brainland.ultimatebundle",
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

/**
 * Maps a productId to the entitlement flags it grants.
 * Ultimate Bundle grants ALL entitlements.
 */
export interface EntitlementGrant {
    removeAds: boolean;
    storyMode: boolean;
    ultimateBundle: boolean;
}

export const PRODUCT_ENTITLEMENTS: Record<string, EntitlementGrant> = {
    [PRODUCT_IDS.REMOVE_ADS]: {
        removeAds: true,
        storyMode: false,
        ultimateBundle: false,
    },
    [PRODUCT_IDS.STORY_MODE]: {
        removeAds: false,
        storyMode: true,
        ultimateBundle: false,
    },
    [PRODUCT_IDS.ULTIMATE_BUNDLE]: {
        removeAds: true,
        storyMode: true,
        ultimateBundle: true,
    },
};

// ─────────────────────────────────────────────────────────
// Verify Purchase Request/Response
// ─────────────────────────────────────────────────────────

export interface VerifyPurchaseRequest {
    deviceId: string;
    productId: string;
    transactionId: string;
    originalTransactionId: string;
    receiptData: string; // JWS token from StoreKit 2
    environment: "Production" | "Sandbox";
}

// ─────────────────────────────────────────────────────────
// Apple JWS Decoded Transaction
// ─────────────────────────────────────────────────────────

export interface AppleJWSTransactionPayload {
    transactionId: string;
    originalTransactionId: string;
    bundleId: string;
    productId: string;
    purchaseDate: number; // ms since epoch
    originalPurchaseDate: number;
    quantity: number;
    type: "Auto-Renewable Subscription" | "Non-Consumable" | "Consumable" | "Non-Renewing Subscription";
    environment: "Production" | "Sandbox";
    storefront: string;
    storefrontId: string;
    signedDate: number;
}

// ─────────────────────────────────────────────────────────
// Apple App Store Server Notification V2
// ─────────────────────────────────────────────────────────

export type NotificationType =
    | "CONSUMPTION_REQUEST"
    | "DID_CHANGE_RENEWAL_PREF"
    | "DID_CHANGE_RENEWAL_STATUS"
    | "DID_FAIL_TO_RENEW"
    | "DID_RENEW"
    | "EXPIRED"
    | "GRACE_PERIOD_EXPIRED"
    | "OFFER_REDEEMED"
    | "PRICE_INCREASE"
    | "REFUND"
    | "REFUND_DECLINED"
    | "REFUND_REVERSED"
    | "RENEWAL_EXTENDED"
    | "REVOKE"
    | "SUBSCRIBED"
    | "TEST";

export interface AppStoreNotificationPayload {
    notificationType: NotificationType;
    subtype?: string;
    notificationUUID: string;
    data: {
        appAppleId: number;
        bundleId: string;
        bundleVersion: string;
        environment: "Production" | "Sandbox";
        signedTransactionInfo: string; // JWS — decoded separately
        signedRenewalInfo?: string;
    };
    signedDate: number;
}

// ─────────────────────────────────────────────────────────
// Bundle ID for validation
// ─────────────────────────────────────────────────────────

// ⚠️ Bundle ID — Xcode Target > Bundle Identifier ile eşleşmeli
export const EXPECTED_BUNDLE_ID = "com.brainland.minigamesclub";
