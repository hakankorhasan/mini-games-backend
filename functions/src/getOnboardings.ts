import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { OnboardingSlide, OnboardingSlideInput } from "./types/onboardingTypes";

/**
 * getOnboardings
 *
 * HTTP GET — Returns all active onboarding slides from Firestore,
 * sorted by `order` ascending.
 *
 * GET /getOnboardings
 *
 * Firestore path: onboardings/{slideId}
 *
 * Returns:
 *   {
 *     success: true,
 *     onboardings: [
 *       {
 *         id: "abc123",
 *         order: 1,
 *         imageUrl: "https://...",
 *         title: "Welcome",
 *         subtitle: "Get started...",
 *         buttonText: "Next",
 *         backgroundColor: "#0F0F23",
 *         textColor: "#FFFFFF",
 *         isActive: true,
 *         createdAt: "...",
 *         updatedAt: "..."
 *       },
 *       ...
 *     ]
 *   }
 */
export const getOnboardings = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const db = admin.firestore();
        const snapshot = await db
            .collection("onboardings")
            .where("isActive", "==", true)
            .orderBy("order", "asc")
            .get();

        const onboardings: OnboardingSlide[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as OnboardingSlide[];

        functions.logger.info(`Fetched ${onboardings.length} onboarding slides from Firestore`);

        res.status(200).json({
            success: true,
            onboardings,
        });
    } catch (error) {
        functions.logger.error("getOnboardings failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

/**
 * manageOnboarding
 *
 * HTTP endpoint for CRUD operations on onboarding slides.
 * Supports POST (create), PUT (update), DELETE (soft delete).
 *
 * ── POST /manageOnboarding ──
 * Creates a new onboarding slide.
 * Body: { order, imageUrl, title, subtitle, buttonText, backgroundColor?, textColor? }
 *
 * ── PUT /manageOnboarding ──
 * Updates an existing slide.
 * Body: { id, ...fieldsToUpdate }
 *
 * ── DELETE /manageOnboarding ──
 * Soft-deletes a slide (sets isActive = false).
 * Body: { id }
 */
export const manageOnboarding = functions.https.onRequest(async (req, res) => {
    const db = admin.firestore();
    const collection = db.collection("onboardings");

    try {
        // ── CREATE ──
        if (req.method === "POST") {
            const body = req.body as OnboardingSlideInput;

            if (!body.title || !body.subtitle || !body.buttonText || body.order == null) {
                res.status(400).json({
                    success: false,
                    error: "Missing required fields: order, title, subtitle, buttonText",
                });
                return;
            }

            const now = new Date().toISOString();
            const docRef = await collection.add({
                order: body.order,
                imageUrl: body.imageUrl || "",
                title: body.title,
                subtitle: body.subtitle,
                buttonText: body.buttonText,
                backgroundColor: body.backgroundColor || "#0F0F23",
                textColor: body.textColor || "#FFFFFF",
                isActive: body.isActive ?? true,
                createdAt: now,
                updatedAt: now,
            });

            functions.logger.info(`Created onboarding slide: ${docRef.id}`);
            res.status(201).json({
                success: true,
                id: docRef.id,
                message: "Onboarding slide created.",
            });
            return;
        }

        // ── UPDATE ──
        if (req.method === "PUT") {
            const { id, ...updates } = req.body;

            if (!id) {
                res.status(400).json({ success: false, error: "Missing required field: id" });
                return;
            }

            const docRef = collection.doc(id);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ success: false, error: "Slide not found." });
                return;
            }

            // Only allow updating known fields
            const allowedFields = [
                "order", "imageUrl", "title", "subtitle",
                "buttonText", "backgroundColor", "textColor", "isActive",
            ];
            const sanitized: Record<string, unknown> = {};
            for (const key of allowedFields) {
                if (updates[key] !== undefined) {
                    sanitized[key] = updates[key];
                }
            }
            sanitized.updatedAt = new Date().toISOString();

            await docRef.update(sanitized);

            functions.logger.info(`Updated onboarding slide: ${id}`);
            res.status(200).json({
                success: true,
                id,
                message: "Onboarding slide updated.",
            });
            return;
        }

        // ── DELETE (soft) ──
        if (req.method === "DELETE") {
            const { id } = req.body;

            if (!id) {
                res.status(400).json({ success: false, error: "Missing required field: id" });
                return;
            }

            const docRef = collection.doc(id);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ success: false, error: "Slide not found." });
                return;
            }

            await docRef.update({
                isActive: false,
                updatedAt: new Date().toISOString(),
            });

            functions.logger.info(`Soft-deleted onboarding slide: ${id}`);
            res.status(200).json({
                success: true,
                id,
                message: "Onboarding slide deactivated.",
            });
            return;
        }

        res.status(405).json({ success: false, error: "Method not allowed. Use POST, PUT, or DELETE." });
    } catch (error) {
        functions.logger.error("manageOnboarding failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
