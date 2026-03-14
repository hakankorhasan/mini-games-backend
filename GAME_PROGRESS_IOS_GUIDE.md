# Game Progress API — iOS Integration Guide

## Base URL
```
https://us-central1-mini-games-9a4e1.cloudfunctions.net
```

## Firestore Yapısı
```
gameProgress/{deviceId}/games/{gameId}
  ├── gameId: "pipeConnect"
  ├── currentLevel: 6
  ├── completedLevels: [1, 2, 3, 4, 5]
  └── updatedAt: <timestamp>
```

---

## 1. Progress Kaydet — `POST /saveGameProgress`

Level tamamlandıktan sonra çağır.

```json
// Request Body
{
  "deviceId": "DEVICE-UUID",
  "gameId": "pipeConnect",
  "currentLevel": 6,
  "completedLevels": [1, 2, 3, 4, 5]
}
```

```json
// Response
{
  "success": true,
  "progress": {
    "gameId": "pipeConnect",
    "currentLevel": 6,
    "completedLevels": [1, 2, 3, 4, 5]
  }
}
```

| Field | Type | Required | Açıklama |
|---|---|---|---|
| `deviceId` | string | ✅ | Cihaz UUID |
| `gameId` | string | ✅ | Oyun ID (aşağıdaki tablodan) |
| `currentLevel` | int | ✅ | Sıradaki oynanacak level (tamamlanan + 1) |
| `completedLevels` | [int] | ❌ | Tamamlanan level numaraları (default `[]`) |

---

## 2. Progress Getir — `GET /getGameProgress`

### Tek oyun:
```
GET /getGameProgress?deviceId=DEVICE-UUID&gameId=pipeConnect
```

### Tüm oyunlar (uygulama açılışında çağır):
```
GET /getGameProgress?deviceId=DEVICE-UUID
```

```json
// Tüm oyunlar response
{
  "success": true,
  "progress": [
    { "gameId": "pipeConnect", "currentLevel": 6, "completedLevels": [1,2,3,4,5] },
    { "gameId": "hiddenPair", "currentLevel": 3, "completedLevels": [1,2] }
  ]
}
```

> Hiç progress yoksa → `currentLevel: 1`, `completedLevels: []` döner.

---

## Game ID Tablosu

| Oyun | gameId |
|---|---|
| Pipe Connect | `pipeConnect` |
| Laser Puzzle | `laserPuzzle` |
| Hidden Pair | `hiddenPair` |
| Binary Puzzle | `binaryPuzzle` |
| Pixel Excavation | `pixelExcavation` |
| Slitherlink | `slitherlink` |
| Block Fit | `blockFit` |
| Crypto-Cage | `cryptoCage` |
| Neural Link | `neuralLink` |
| Galactic Beacons | `galacticBeacons` |
| Number Circuit | `numberCircuit` |

---

## iOS'ta Ne Yapmalısın

### 1. Model oluştur
```swift
struct GameProgress: Codable {
    let gameId: String
    let currentLevel: Int
    let completedLevels: [Int]
}

struct GameProgressResponse: Codable {
    let success: Bool
    let progress: [GameProgress]  // Tüm oyunlar için array
}

struct SingleGameProgressResponse: Codable {
    let success: Bool
    let progress: GameProgress    // Tek oyun için object
}
```

### 2. NetworkManager'a endpoint ekle
```swift
// Tüm oyunların progress'ini çek (uygulama açılışında)
func fetchAllGameProgress(deviceId: String) async throws -> [GameProgress] {
    let url = "\(baseURL)/getGameProgress?deviceId=\(deviceId)"
    // GET request → GameProgressResponse döner
}

// Tek oyunun progress'ini çek
func fetchGameProgress(deviceId: String, gameId: String) async throws -> GameProgress {
    let url = "\(baseURL)/getGameProgress?deviceId=\(deviceId)&gameId=\(gameId)"
    // GET request → SingleGameProgressResponse döner
}

// Level tamamlandığında progress kaydet
func saveGameProgress(deviceId: String, gameId: String, currentLevel: Int, completedLevels: [Int]) async throws {
    let url = "\(baseURL)/saveGameProgress"
    // POST request with body
}
```

### 3. Uygulama açılışında progress çek
```swift
// AppDelegate veya ana ekran viewDidLoad'da:
let allProgress = try await NetworkManager.shared.fetchAllGameProgress(deviceId: deviceId)

// Local cache'e kaydet (örn. dictionary)
var progressMap: [String: GameProgress] = [:]
for p in allProgress {
    progressMap[p.gameId] = p
}
```

### 4. Oyun başlatırken kaldığı level'dan başlat
```swift
let progress = progressMap["pipeConnect"]
let startLevel = progress?.currentLevel ?? 1
// startLevel ile oyunu başlat
```

### 5. Level tamamlandığında kaydet
```swift
func onLevelCompleted(gameId: String, completedLevel: Int) {
    var completed = progressMap[gameId]?.completedLevels ?? []
    if !completed.contains(completedLevel) {
        completed.append(completedLevel)
    }
    let nextLevel = completedLevel + 1

    Task {
        try await NetworkManager.shared.saveGameProgress(
            deviceId: deviceId,
            gameId: gameId,
            currentLevel: nextLevel,
            completedLevels: completed
        )
    }

    // Local cache'i de güncelle
    progressMap[gameId] = GameProgress(
        gameId: gameId,
        currentLevel: nextLevel,
        completedLevels: completed
    )
}
```

### Akış Özeti
```
Uygulama Açıldı
  └─ GET /getGameProgress?deviceId=xxx     → tüm oyunların level bilgisi gelir
       └─ Local dictionary'e kaydet

Oyun Seçildi
  └─ progressMap["pipeConnect"].currentLevel oku
       └─ O level'dan başlat

Level Bitti
  └─ POST /saveGameProgress                → Firestore'a yaz
       └─ Local cache güncelle
```
