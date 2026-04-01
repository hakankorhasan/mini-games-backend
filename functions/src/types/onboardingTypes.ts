/**
 * Onboarding Types
 *
 * Data model for the onboarding slides system.
 * Each slide represents a page in the onboarding flow.
 */

export interface OnboardingSlide {
  /** Firestore document ID */
  id: string;

  /** Display order (1, 2, 3...). Slides are sorted ascending by this field. */
  order: number;

  /** Public URL for the slide image (Firebase Storage or remote URL) */
  imageUrl: string;

  /** Main headline text for the slide */
  title: string;

  /** Subtitle / description text shown below the title */
  subtitle: string;

  /** Text for the action button (e.g. "Next", "Get Started", "Continue") */
  buttonText: string;

  /** Optional: background color hex code, e.g. "#1A1A2E" */
  backgroundColor?: string;

  /** Optional: text color override hex code */
  textColor?: string;

  /** Whether this slide is currently active (soft-delete / draft support) */
  isActive: boolean;

  /** ISO 8601 creation timestamp */
  createdAt: string;

  /** ISO 8601 last update timestamp */
  updatedAt: string;
}

/**
 * Input type for creating/updating an onboarding slide.
 * Fields like id, createdAt, updatedAt are managed server-side.
 */
export interface OnboardingSlideInput {
  order: number;
  imageUrl: string;
  title: string;
  subtitle: string;
  buttonText: string;
  backgroundColor?: string;
  textColor?: string;
  isActive?: boolean;
}
