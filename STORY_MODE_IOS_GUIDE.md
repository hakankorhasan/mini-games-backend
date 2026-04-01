# Story Mode iOS Implementation Guide

This document covers the iOS integration for the new Story Mode page features: **Global Slider** and **Badge System**.

---

## 1. Global Story Sliders (Top Slider)

The slider at the top of the Story Mode page displays promotional media (photos or videos). These are fetched dynamically from a dedicated API endpoint — not hardcoded.

### Endpoint

- **URL:** `https://us-central1-mini-games-9a4e1.cloudfunctions.net/getStorySliders`
- **Method:** `GET`
- **Auth:** None required

### Response Model

```json
{
  "success": true,
  "count": 6,
  "sliders": [
    {
      "id": "slider_1",
      "type": "video",
      "url": "https://storage.googleapis.com/.../slider_1.mp4",
      "badge": "popular",
      "order": 1
    },
    {
      "id": "slider_2",
      "type": "image",
      "url": "https://storage.googleapis.com/.../slider_2.jpg",
      "badge": "",
      "order": 2
    }
  ]
}
```

### Swift Data Model

```swift
struct StorySliderResponse: Codable {
    let success: Bool
    let count: Int
    let sliders: [StorySlider]
}

struct StorySlider: Identifiable, Codable {
    let id: String
    let type: String    // "video" or "image"
    let url: String     // Direct download/playback URL
    let badge: String   // "popular", "new", or "" (empty)
    let order: Int      // Display order (ascending)
}
```

### Fetching Sliders

```swift
func fetchStorySliders() {
    let url = URL(string: "https://us-central1-mini-games-9a4e1.cloudfunctions.net/getStorySliders")!
    
    URLSession.shared.dataTask(with: url) { data, response, error in
        guard let data = data, error == nil else { return }
        
        let response = try? JSONDecoder().decode(StorySliderResponse.self, from: data)
        DispatchQueue.main.async {
            self.sliders = response?.sliders ?? []
        }
    }.resume()
}
```

### Display Notes

| Field | Usage |
|-------|-------|
| `type == "video"` | Use `AVPlayer` with muted looping playback |
| `type == "image"` | Use `AsyncImage` or cached image loader |
| `badge != ""` | Show a small label (e.g. "New", "Popular") on the top corner of the slider card |
| `order` | Already sorted ascending from the API — no client-side sorting needed |

---

## 2. Game Badges (Per-Story Badges)

Each story game (e.g. "Lost Memories", "Digital Consciousness") can now carry badges like `"new"` or `"popular"`.

### Firestore Path
- **Collection:** `gameStories` (existing)

### Updated Swift Model

Add the optional `badges` array to your existing `GameStory` model:

```swift
struct GameStory: Identifiable, Codable {
    @DocumentID var id: String?
    let gameType: String
    let title: String
    let subtitle: String
    let icon: String
    let coverImageURL: String?
    let themeColors: [String]
    let order: Int
    
    // NEW FIELD
    let badges: [String]?  // e.g. ["new", "popular"]
    
    // (levels, events, etc. remain unchanged)
}
```

### Display Notes

- If `badges` is not nil and not empty, render small tag(s) on the game card corner.
- Example check: `if let badges = story.badges, badges.contains("new") { /* show "New" tag */ }`
- Supported badge values: `"new"`, `"popular"` (more can be added later from the backend without app updates).

---

## 3. Backend Management (Developer Info)

### How Sliders Are Managed
1. Upload media files to Firebase Storage under the `story_sliders/` folder (e.g. `slider_1.mp4`, `slider_2.jpg`).
2. Call the `seedStories` endpoint to auto-scan the folder and write each file as a document in the `storySliders` Firestore collection.
3. Badge assignment is based on filename: `slider_1` → `"popular"`, `slider_4` → `"new"`, others → `""`.

### Seed Endpoint
```
GET https://us-central1-mini-games-9a4e1.cloudfunctions.net/seedStories
```

This endpoint handles both story seeding **and** slider seeding in a single call.
