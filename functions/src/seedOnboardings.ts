import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { OnboardingSlideInput } from "./types/onboardingTypes";

/**
 * seedOnboardings
 *
 * HTTP GET — Seeds the Firestore `onboardings` collection with default slides.
 * Call once to populate initial data. Skips if slides already exist.
 *
 * GET /seedOnboardings
 *
 * Firestore path: onboardings/{slideId}
 */

const STORAGE_BUCKET = "mini-games-9a4e1.firebasestorage.app";

const DEFAULT_SLIDES: OnboardingSlideInput[] = [
    {
        order: 1,
        imageUrl: `https://storage.googleapis.com/${STORAGE_BUCKET}/onboardings/onboarding_one.jpeg`,
        title: "10+ Brain Games, One App",
        subtitle: "From logic puzzles to pattern challenges — train your brain with a curated collection of mind-bending games.",
        buttonText: "Next",
        backgroundColor: "#0F0F23",
        textColor: "#FFFFFF",
        isActive: true,
    },
    {
        order: 2,
        imageUrl: `https://storage.googleapis.com/${STORAGE_BUCKET}/onboardings/onboarding_two.jpeg`,
        title: "Daily Challenge Awaits",
        subtitle: "Complete 5 unique puzzles every day, build your streak and climb the global leaderboard.",
        buttonText: "Next",
        backgroundColor: "#0F0F23",
        textColor: "#FFFFFF",
        isActive: true,
    },
    {
        order: 3,
        imageUrl: `https://storage.googleapis.com/${STORAGE_BUCKET}/onboardings/onboarding_three.jpeg`,
        title: "Unlock Story Mode",
        subtitle: "Dive into immersive story-driven puzzles and discover new challenges as you progress.",
        buttonText: "Get Started",
        backgroundColor: "#0F0F23",
        textColor: "#FFFFFF",
        isActive: true,
    },
];

export const seedOnboardings = functions.https.onRequest(async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
        return;
    }

    try {
        const db = admin.firestore();
        const collection = db.collection("onboardings");

        // Check if slides already exist
        const existing = await collection.limit(1).get();
        if (!existing.empty) {
            res.status(200).json({
                success: true,
                message: "Onboarding slides already seeded. Use manageOnboarding to update.",
                count: (await collection.get()).size,
            });
            return;
        }

        const batch = db.batch();
        const now = new Date().toISOString();

        for (const slide of DEFAULT_SLIDES) {
            const docRef = collection.doc();
            batch.set(docRef, {
                ...slide,
                isActive: slide.isActive ?? true,
                createdAt: now,
                updatedAt: now,
            });
        }

        await batch.commit();

        functions.logger.info(`Seeded ${DEFAULT_SLIDES.length} onboarding slides`);
        res.status(200).json({
            success: true,
            message: `Seeded ${DEFAULT_SLIDES.length} onboarding slides successfully.`,
        });
    } catch (error) {
        functions.logger.error("seedOnboardings failed", error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
