/**
 * Story Progress — TypeScript Interfaces
 *
 * Tracks user progress through stories using device-id.
 * Stored in Firestore at: storyProgress/{deviceId}/stories/{storyId}
 */

export interface StoryProgress {
    storyId: string;          // e.g. "nl_story_01"
    levelOrder: number;       // Current level (1-based)
    eventOrder: number;       // Current event within the level (1-based)
    completed: boolean;       // Whether the entire story is finished
    updatedAt: FirebaseFirestore.Timestamp;
}
