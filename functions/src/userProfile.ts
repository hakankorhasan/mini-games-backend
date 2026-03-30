import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const STORAGE_BUCKET = "mini-games-9a4e1.firebasestorage.app";

function getAvatarUrl(avatarId: string): string {
    return `https://storage.googleapis.com/${STORAGE_BUCKET}/avatars/${avatarId}.png`;
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function validateNickname(nickname: string): { valid: boolean; error?: string } {
    if (!nickname || typeof nickname !== "string") {
        return { valid: false, error: "Nickname is required." };
    }
    const trimmed = nickname.trim();
    if (trimmed.length < 3) {
        return { valid: false, error: "Nickname must be at least 3 characters." };
    }
    if (trimmed.length > 16) {
        return { valid: false, error: "Nickname must be at most 16 characters." };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return { valid: false, error: "Nickname can only contain letters, numbers, and underscores." };
    }
    return { valid: true };
}

function validateAge(age: unknown): { valid: boolean; error?: string } {
    if (age === undefined || age === null) {
        return { valid: false, error: "Age is required." };
    }
    if (typeof age !== "number" || !Number.isInteger(age)) {
        return { valid: false, error: "Age must be a whole number." };
    }
    if (age < 5 || age > 99) {
        return { valid: false, error: "Age must be between 5 and 99." };
    }
    return { valid: true };
}

// ─────────────────────────────────────────────────────────
// 1) GET AVATARS
// ─────────────────────────────────────────────────────────

export const getAvatars = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const bucket = admin.storage().bucket(STORAGE_BUCKET);
        const [files] = await bucket.getFiles({ prefix: "avatars/" });

        const avatars = files
            .filter((file) => file.name.endsWith(".png"))
            .map((file) => {
                const fileName = file.name.split("/").pop() || "";
                const id = fileName.replace(".png", "");
                return {
                    id,
                    url: `https://storage.googleapis.com/${STORAGE_BUCKET}/${file.name}`,
                };
            })
            .sort((a, b) => a.id.localeCompare(b.id));

        res.status(200).json({ success: true, avatars });
    } catch (error) {
        functions.logger.error("getAvatars failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ─────────────────────────────────────────────────────────
// 2) GET PROFILE
// ─────────────────────────────────────────────────────────

export const getProfile = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const deviceId = req.query.deviceId as string;

        if (!deviceId) {
            res.status(400).json({ success: false, error: "deviceId query parameter is required." });
            return;
        }

        const db = admin.firestore();
        const userRef = db.collection("users").doc(deviceId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            res.status(200).json({ success: true, profile: null });
            return;
        }

        const data = userDoc.data();

        res.status(200).json({
            success: true,
            profile: {
                deviceId,
                nickname: data?.nickname ?? null,
                avatarId: data?.avatarId ?? null,
                avatarUrl: data?.avatarUrl ?? null,
                age: data?.age ?? null,
                profileCompleted: data?.profileCompleted ?? false,
                rating: data?.rating,
                tier: data?.tier,
                createdAt: data?.createdAt,
                updatedAt: data?.updatedAt,
            },
        });
    } catch (error) {
        functions.logger.error("getProfile failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ─────────────────────────────────────────────────────────
// 3) CREATE PROFILE
// ─────────────────────────────────────────────────────────

export const createProfile = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { deviceId, nickname, avatarId, age } = req.body;

        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }

        const nicknameValidation = validateNickname(nickname);
        if (!nicknameValidation.valid) {
            res.status(400).json({ success: false, error: nicknameValidation.error });
            return;
        }

        if (!avatarId || typeof avatarId !== "string") {
            res.status(400).json({ success: false, error: "avatarId is required." });
            return;
        }

        const ageValidation = validateAge(age);
        if (!ageValidation.valid) {
            res.status(400).json({ success: false, error: ageValidation.error });
            return;
        }

        const trimmedNickname = nickname.trim();
        const db = admin.firestore();
        const userRef = db.collection("users").doc(deviceId);

        const userDoc = await userRef.get();
        if (userDoc.exists && userDoc.data()?.profileCompleted === true) {
            res.status(409).json({
                success: false,
                error: "Profile already set up. Use updateProfile to modify.",
            });
            return;
        }

        const nicknameQuery = await db
            .collection("users")
            .where("nicknameLower", "==", trimmedNickname.toLowerCase())
            .limit(1)
            .get();

        if (!nicknameQuery.empty) {
            res.status(409).json({
                success: false,
                error: "This nickname is already taken. Please choose another.",
            });
            return;
        }

        const avatarUrl = getAvatarUrl(avatarId);

        // create or merge with existing data
        await userRef.set({
            deviceId,
            nickname: trimmedNickname,
            nicknameLower: trimmedNickname.toLowerCase(),
            avatarId,
            avatarUrl,
            age,
            profileCompleted: true,
            createdAt: userDoc.exists ? userDoc.data()!.createdAt : admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        res.status(201).json({
            success: true,
            profile: {
                deviceId,
                nickname: trimmedNickname,
                avatarId,
                avatarUrl,
                age,
            },
        });
    } catch (error) {
        functions.logger.error("createProfile failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ─────────────────────────────────────────────────────────
// 4) UPDATE PROFILE
// ─────────────────────────────────────────────────────────

export const updateProfile = functions.https.onRequest(async (req, res) => {
    if (req.method !== "PUT") {
        res.status(405).json({ success: false, error: "Method not allowed. Use PUT." });
        return;
    }

    try {
        const { deviceId, nickname, avatarId, age } = req.body;

        if (!deviceId || typeof deviceId !== "string") {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }

        if (!nickname && !avatarId && age === undefined) {
            res.status(400).json({
                success: false,
                error: "At least one of 'nickname', 'avatarId', or 'age' must be provided.",
            });
            return;
        }

        const db = admin.firestore();
        const userRef = db.collection("users").doc(deviceId);

        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            res.status(404).json({ success: false, error: "User not found." });
            return;
        }

        const updateData: Record<string, unknown> = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (nickname) {
            const nicknameValidation = validateNickname(nickname);
            if (!nicknameValidation.valid) {
                res.status(400).json({ success: false, error: nicknameValidation.error });
                return;
            }

            const trimmedNickname = nickname.trim();

            const nicknameQuery = await db
                .collection("users")
                .where("nicknameLower", "==", trimmedNickname.toLowerCase())
                .limit(1)
                .get();

            if (!nicknameQuery.empty && nicknameQuery.docs[0].id !== deviceId) {
                res.status(409).json({
                    success: false,
                    error: "This nickname is already taken. Please choose another.",
                });
                return;
            }

            updateData.nickname = trimmedNickname;
            updateData.nicknameLower = trimmedNickname.toLowerCase();
        }

        if (avatarId) {
            if (typeof avatarId !== "string") {
                res.status(400).json({ success: false, error: "avatarId must be a string." });
                return;
            }
            updateData.avatarId = avatarId;
            updateData.avatarUrl = getAvatarUrl(avatarId);
        }

        if (age !== undefined) {
            const ageValidation = validateAge(age);
            if (!ageValidation.valid) {
                res.status(400).json({ success: false, error: ageValidation.error });
                return;
            }
            updateData.age = age;
        }

        await userRef.update(updateData);

        const updatedDoc = await userRef.get();
        const updated = updatedDoc.data();

        res.status(200).json({
            success: true,
            profile: {
                deviceId,
                nickname: updated?.nickname,
                avatarId: updated?.avatarId,
                avatarUrl: updated?.avatarUrl,
                age: updated?.age ?? null,
            },
        });
    } catch (error) {
        functions.logger.error("updateProfile failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// ─────────────────────────────────────────────────────────
// 5) CHECK DEVICE REGISTRATION
// ─────────────────────────────────────────────────────────

export const checkDevice = functions.https.onRequest(async (req, res) => {
    // Allow either GET or POST for flexibility
    if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET or POST." });
        return;
    }

    try {
        const deviceId = (req.method === "GET" ? req.query.deviceId : req.body.deviceId) as string;

        if (!deviceId) {
            res.status(400).json({ success: false, error: "deviceId is required." });
            return;
        }

        const db = admin.firestore();
        const userRef = db.collection("users").doc(deviceId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            res.status(200).json({ success: true, isRegistered: false });
            return;
        }

        const data = userDoc.data();
        const isRegistered = data?.profileCompleted === true;

        res.status(200).json({
            success: true,
            isRegistered,
            profile: isRegistered ? {
                deviceId,
                nickname: data?.nickname ?? null,
                avatarId: data?.avatarId ?? null,
                avatarUrl: data?.avatarUrl ?? null,
                age: data?.age ?? null,
            } : null
        });
    } catch (error) {
        functions.logger.error("checkDevice failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
