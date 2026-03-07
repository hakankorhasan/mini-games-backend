# 🎮 Story System — Backend Geliştirme Rehberi

iOS tarafında hikaye sistemi hazır. Bu döküman Firebase backend'ini kodlaman için gereken her şeyi özetler.

## iOS Tarafı Nasıl Çalışıyor?

```
Kullanıcı oyun seçer (Neural Link veya Pixel Excavation)
    → StoryDataManager.fetchStories(for: .neuralLink) çağrılır
    → Firebase'den hikayeleri çeker
    → StorySelectionView'da hikaye kartları gösterilir
    → Kullanıcı hikaye seçer → Level Select → Oyun başlar
    → Level bittiğinde artifactImageURL'den görsel gösterilir
```

## Firestore Yapısı

### Collection: `gameStories`

Her hikaye bir **document**. `gameType` field'ı ile filtreleme yapılır.

```
firestore/
├── gameStories/                    ← collection
│   ├── nl_story_01                 ← document (gameType: "neuralLink")
│   ├── nl_story_02                 ← document
│   ├── pe_story_01                 ← document (gameType: "pixelExcavation")
│   └── pe_story_02                 ← document
```

### Document Schema

```typescript
interface GameStory {
  id: string;                       // document ID ile aynı
  gameType: string;                 // "neuralLink" | "pixelExcavation"
  title: string;                    // "Kayıp Anılar"
  subtitle: string;                 // "Travma sonrası hafıza onarımı"
  icon: string;                     // SF Symbol: "brain.head.profile"
  coverImageURL: string | null;     // Firebase Storage URL
  themeColors: string[];            // ["#00E5FF", "#AA00FF"]
  order: number;                    // sıralama için
  levels: StoryLevel[];             // 5 level — embedded array
}

interface StoryLevel {
  order: number;                    // 1, 2, 3, 4, 5
  title: string;                    // "İlk Sinyal"
  subtitle: string;                 // "Prefrontal Korteks"

  // Grid config
  gridSize: number;                 // 5, 6, 7, 8, 9...
  flowCount?: number;               // Neural Link: kaç sinaps bağlantısı
  deadNeuronCount?: number;         // Neural Link: kaç engelleyici nöron
  fillFraction?: number;            // Pixel Excavation: 0.35–0.50

  // Story content
  startMessages: string[];          // Typewriter mesajları (3–4 satır)
  endTitle: string;                 // "Memory Fragment Recovered"
  endMessage: string;               // "Sinir bağlantısı yeniden kuruldu."
  artifactText: string;             // İtalik gösterilecek metin
  artifactImageURL?: string;        // Firebase Storage URL

  // Pixel Excavation extras (Neural Link için null bırak)
  expeditionLog?: string;
  scanDepth?: string;               // "1.5m"
  densitySignal?: string;           // "Low", "Medium", "High"
}
```

## Firebase Storage — Görseller

```
storage/
├── story_assets/
│   ├── nl_story_01/
│   │   ├── cover.jpg               ← hikaye kartı arka planı
│   │   ├── level_1_artifact.png    ← level bitiş görseli
│   │   ├── level_2_artifact.png
│   │   ├── level_3_artifact.png
│   │   ├── level_4_artifact.png
│   │   └── level_5_artifact.png
│   └── pe_story_01/
│       └── ...
```

| Görsel | Boyut | Format | Kullanım |
|--------|-------|--------|----------|
| Cover | 800×450 | JPG/WebP | Story kartı arka planı |
| Artifact | 600×600 | PNG (şeffaf bg) | Level bitiş overlay |

## iOS Tarafında Fetch Kodu

`StoryDataManager.swift` içinde `fetchStories()` fonksiyonu şu anda **placeholder** veri döndürüyor. Firebase entegrasyonunda bu fonksiyonu güncelle:

```swift
func fetchStories(for gameType: StoryGameType) {
    guard !loaded.contains(gameType.rawValue) else { return }
    isLoading = true

    Firestore.firestore()
        .collection("gameStories")
        .whereField("gameType", isEqualTo: gameType.rawValue)
        .order(by: "order")
        .getDocuments { [weak self] snapshot, error in
            guard let self = self else { return }
            guard let docs = snapshot?.documents else {
                self.isLoading = false
                return
            }

            let stories = docs.compactMap { doc -> GameStory? in
                try? doc.data(as: GameStory.self)
            }

            DispatchQueue.main.async {
                switch gameType {
                case .neuralLink:
                    self.neuralLinkStories = stories
                case .pixelExcavation:
                    self.pixelExcavationStories = stories
                }
                self.loaded.insert(gameType.rawValue)
                self.isLoading = false
            }
        }
}
```

## Firestore Rules — Eklemen Gereken Kural

`firestore.rules` dosyasına ekle:

```javascript
// Game Stories: tüm clientlar okuyabilir, sadece admin yazabilir
match /gameStories/{storyId} {
  allow read: if true;
  allow write: if false;  // sadece Firebase Console veya Admin SDK
}
```

## Firestore Index

`firestore.indexes.json` dosyasına ekle:

```json
{
  "collectionGroup": "gameStories",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "gameType", "order": "ASCENDING" },
    { "fieldPath": "order", "order": "ASCENDING" }
  ]
}
```

## Örnek Document — Firestore Console'da Oluşturma

**Neural Link — Story 1:**

```json
{
  "id": "nl_story_01",
  "gameType": "neuralLink",
  "title": "Kayıp Anılar",
  "subtitle": "Travma sonrası hafıza onarımı",
  "icon": "brain.head.profile",
  "coverImageURL": null,
  "themeColors": ["#00E5FF", "#AA00FF"],
  "order": 1,
  "levels": [
    {
      "order": 1,
      "title": "İlk Sinyal",
      "subtitle": "Prefrontal Korteks",
      "gridSize": 5,
      "flowCount": 3,
      "deadNeuronCount": 0,
      "startMessages": [
        "Neural pathway damage detected.",
        "Initiating synapse reconnection.",
        "Proceed carefully."
      ],
      "endTitle": "Memory Fragment Recovered",
      "endMessage": "Sinir bağlantısı yeniden kuruldu.",
      "artifactText": "\"Bir çocuğun gülüşü… tanıdık ama uzak.\"",
      "artifactImageURL": null
    }
  ]
}
```

## Seed Script (İsteğe Bağlı)

Backend projede bir seed script yazabilirsin:

```typescript
// functions/src/seedStories.ts
import * as admin from "firebase-admin";

const stories: GameStory[] = [
  { id: "nl_story_01", gameType: "neuralLink", ... },
  { id: "nl_story_02", gameType: "neuralLink", ... },
  { id: "pe_story_01", gameType: "pixelExcavation", ... },
  { id: "pe_story_02", gameType: "pixelExcavation", ... },
];

export async function seedStories() {
  const batch = admin.firestore().batch();
  for (const story of stories) {
    const ref = admin.firestore().collection("gameStories").doc(story.id);
    batch.set(ref, story);
  }
  await batch.commit();
}
```

## Checklist

- [ ] `gameStories` collection oluştur
- [ ] Firestore rules'a `gameStories` kuralı ekle
- [ ] Index oluştur (`gameType` + `order`)
- [ ] Hikaye document'larını yükle (4 adet: 2 Neural Link + 2 Pixel Excavation)
- [ ] Görselleri Firebase Storage'a yükle
- [ ] iOS `StoryDataManager.fetchStories()` fonksiyonunu Firebase'e bağla
- [ ] Test: iOS'ta hikaye listesi Firebase'den geliyor mu?
