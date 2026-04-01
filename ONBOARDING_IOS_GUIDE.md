# Onboarding System — iOS Integration Guide

## Overview

The onboarding system serves dynamic slides from Firestore. Each slide has an **image**, **title**, **subtitle**, **button text**, and optional styling. The iOS app fetches these on first launch to display the onboarding flow.

---

## Data Model

```
Firestore Collection: onboardings/{slideId}
```

| Field             | Type     | Description                                      |
|-------------------|----------|--------------------------------------------------|
| `id`              | string   | Firestore document ID                            |
| `order`           | number   | Display order (1, 2, 3…)                         |
| `imageUrl`        | string   | Public URL for the slide image/video              |
| `title`           | string   | Main headline text                               |
| `subtitle`        | string   | Description text below the title                 |
| `buttonText`      | string   | Action button label ("Next", "Başla", etc.)      |
| `backgroundColor` | string?  | Background hex color (default: `#0F0F23`)        |
| `textColor`       | string?  | Text hex color (default: `#FFFFFF`)              |
| `isActive`        | boolean  | Whether the slide is visible                     |
| `createdAt`       | string   | ISO 8601 timestamp                               |
| `updatedAt`       | string   | ISO 8601 timestamp                               |

---

## API Endpoints

### 1. GET `/getOnboardings`

Fetches all **active** onboarding slides, sorted by `order` ascending.

**Request:**
```
GET https://<region>-<project>.cloudfunctions.net/getOnboardings
```

**Response:**
```json
{
  "success": true,
  "onboardings": [
    {
      "id": "abc123",
      "order": 1,
      "imageUrl": "https://storage.googleapis.com/.../onboarding_01.png",
      "title": "Beyin Egzersizleri",
      "subtitle": "Her gün farklı bulmacalarla zihnini aktif tut ve beyin gücünü artır.",
      "buttonText": "Devam",
      "backgroundColor": "#0F0F23",
      "textColor": "#FFFFFF",
      "isActive": true,
      "createdAt": "2026-04-01T08:30:00.000Z",
      "updatedAt": "2026-04-01T08:30:00.000Z"
    },
    {
      "id": "def456",
      "order": 2,
      "imageUrl": "https://storage.googleapis.com/.../onboarding_02.png",
      "title": "Günlük Meydan Okuma",
      "subtitle": "Her gün 5 özel bulmaca seni bekliyor. Seriyi kırma, ödüller kazan!",
      "buttonText": "Devam",
      "backgroundColor": "#0F0F23",
      "textColor": "#FFFFFF",
      "isActive": true,
      "createdAt": "2026-04-01T08:30:00.000Z",
      "updatedAt": "2026-04-01T08:30:00.000Z"
    }
  ]
}
```

---

### 2. POST `/manageOnboarding` — Create Slide

**Request Body:**
```json
{
  "order": 5,
  "imageUrl": "https://...",
  "title": "New Feature",
  "subtitle": "Check out this amazing new feature!",
  "buttonText": "Next",
  "backgroundColor": "#1A1A2E",
  "textColor": "#FFFFFF"
}
```

**Response:**
```json
{
  "success": true,
  "id": "newSlideId",
  "message": "Onboarding slide created."
}
```

### 3. PUT `/manageOnboarding` — Update Slide

**Request Body:**
```json
{
  "id": "abc123",
  "title": "Updated Title",
  "subtitle": "Updated subtitle text",
  "order": 2
}
```

### 4. DELETE `/manageOnboarding` — Deactivate Slide

**Request Body:**
```json
{
  "id": "abc123"
}
```

> **Note:** DELETE performs a soft-delete (sets `isActive: false`). The slide remains in Firestore but won't appear in `getOnboardings` results.

---

### 5. GET `/seedOnboardings`

Seeds the Firestore `onboardings` collection with 4 default Turkish slides. Only works if the collection is empty.

```
GET https://<region>-<project>.cloudfunctions.net/seedOnboardings
```

---

## iOS Integration

### Swift Model

```swift
struct OnboardingSlide: Codable, Identifiable {
    let id: String
    let order: Int
    let imageUrl: String
    let title: String
    let subtitle: String
    let buttonText: String
    let backgroundColor: String?
    let textColor: String?
    let isActive: Bool
    let createdAt: String
    let updatedAt: String
}

struct OnboardingResponse: Codable {
    let success: Bool
    let onboardings: [OnboardingSlide]
}
```

### Fetching Onboarding Slides

```swift
func fetchOnboardings() async throws -> [OnboardingSlide] {
    let url = URL(string: "\(baseURL)/getOnboardings")!
    let (data, _) = try await URLSession.shared.data(from: url)
    let response = try JSONDecoder().decode(OnboardingResponse.self, from: data)
    return response.onboardings
}
```

### SwiftUI View Example

```swift
struct OnboardingView: View {
    @State private var slides: [OnboardingSlide] = []
    @State private var currentIndex = 0
    @State private var isLoading = true

    var body: some View {
        ZStack {
            if isLoading {
                ProgressView()
            } else if !slides.isEmpty {
                TabView(selection: $currentIndex) {
                    ForEach(Array(slides.enumerated()), id: \.element.id) { index, slide in
                        VStack(spacing: 24) {
                            // Image
                            AsyncImage(url: URL(string: slide.imageUrl)) { image in
                                image
                                    .resizable()
                                    .scaledToFit()
                                    .frame(maxWidth: 300, maxHeight: 300)
                            } placeholder: {
                                RoundedRectangle(cornerRadius: 20)
                                    .fill(.ultraThinMaterial)
                                    .frame(width: 300, height: 300)
                            }

                            // Title
                            Text(slide.title)
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(Color(hex: slide.textColor ?? "#FFFFFF"))
                                .multilineTextAlignment(.center)

                            // Subtitle
                            Text(slide.subtitle)
                                .font(.system(size: 16))
                                .foregroundColor(Color(hex: slide.textColor ?? "#FFFFFF").opacity(0.7))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)

                            Spacer()

                            // Button
                            Button(action: {
                                if index < slides.count - 1 {
                                    withAnimation { currentIndex = index + 1 }
                                } else {
                                    // Last slide — dismiss onboarding
                                    completeOnboarding()
                                }
                            }) {
                                Text(slide.buttonText)
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(
                                        LinearGradient(
                                            colors: [.purple, .blue],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .cornerRadius(16)
                            }
                            .padding(.horizontal, 32)
                            .padding(.bottom, 40)
                        }
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .background(Color(hex: slides[currentIndex].backgroundColor ?? "#0F0F23"))
            }
        }
        .task {
            do {
                slides = try await fetchOnboardings()
                isLoading = false
            } catch {
                print("Failed to load onboardings: \(error)")
                isLoading = false
            }
        }
    }

    func completeOnboarding() {
        UserDefaults.standard.set(true, forKey: "hasCompletedOnboarding")
        // Navigate to main app
    }
}
```

### Caching Strategy

Since onboarding slides rarely change, cache them locally:

```swift
// Save to UserDefaults after first fetch
func cacheOnboardings(_ slides: [OnboardingSlide]) {
    if let data = try? JSONEncoder().encode(slides) {
        UserDefaults.standard.set(data, forKey: "cachedOnboardings")
    }
}

// Load cached version first, then refresh from API
func loadOnboardings() -> [OnboardingSlide] {
    if let data = UserDefaults.standard.data(forKey: "cachedOnboardings"),
       let slides = try? JSONDecoder().decode([OnboardingSlide].self, from: data) {
        return slides
    }
    return []
}
```

---

## Default Slides (from seedOnboardings)

| Order | Title                        | Subtitle                                                                                           | Button      |
|-------|------------------------------|----------------------------------------------------------------------------------------------------|-------------|
| 1     | 10+ Brain Games, One App     | From logic puzzles to pattern challenges — train your brain with a curated collection of mind-bending games. | Next        |
| 2     | Daily Challenge Awaits       | Complete 5 unique puzzles every day, build your streak and climb the global leaderboard.           | Next        |
| 3     | Unlock Story Mode            | Dive into immersive story-driven puzzles and discover new challenges as you progress.              | Get Started |

---

## Deployment Checklist

1. Deploy functions: `firebase deploy --only functions:getOnboardings,functions:manageOnboarding,functions:seedOnboardings`
2. Deploy indexes: `firebase deploy --only firestore:indexes`
3. Seed data: Call `GET /seedOnboardings` once
4. Upload images to Firebase Storage under `onboardings/` and update `imageUrl` fields via `PUT /manageOnboarding`
