# 🏆 Leaderboard Sistemi — iOS Entegrasyon Rehberi

## Sistem Nasıl Çalışıyor?

Her oyunun bir **katsayısı** var. Oyuncu bir oyunda skor kazandığında, o skorun **en iyi (best) değeri** katsayıyla çarpılarak **ağırlıklı genel skoru** oluşturur.

```
weightedGlobalScore = Σ (oyun.bestScore × oyun.katsayı)
```

**Örnek:**
| Oyun | Best Score | Katsayı | Katkı |
|---|---|---|---|
| Laser Puzzle | 200 | ×1.2 | 240 |
| Slitherlink | 150 | ×1.5 | 225 |
| Hidden Pair | 300 | ×0.8 | 240 |
| **Toplam** | | | **705** |

---

## Oyun Katsayıları

| Oyun | ID | Katsayı |
|---|---|---|
| Hidden Pair | `hiddenPair` | 0.8 |
| Pipe Connect | `pipeConnect` | 1.0 |
| Block Fit | `blockFit` | 1.0 |
| Laser Puzzle | `laserPuzzle` | 1.2 |
| Number Circuit | `numberCircuit` | 1.2 |
| Binary Puzzle | `binaryPuzzle` | 1.3 |
| Neural Link | `neuralLink` | 1.3 |
| Crypto-Cage | `cryptoCage` | 1.4 |
| Pixel Excavation | `pixelExcavation` | 1.5 |
| Slitherlink | `slitherlink` | 1.5 |
| Galactic Beacons | `galacticBeacons` | 1.5 |

---

## Firestore Veri Modeli

### `users/{deviceId}` — Ana Kullanıcı Dokümanı

| Alan | Tip | Açıklama |
|---|---|---|
| `username` | `string` | Oyuncu adı (varsayılan: `Player_XXXXXX`) |
| `rating` | `number` | Elo benzeri rating (başlangıç: 1000) |
| `seasonRating` | `number` | Sezon bazlı rating (her ay sıfırlanır) |
| `tier` | `string` | Liga seviyesi: `Bronze` / `Silver` / `Gold` / `Platinum` / `Diamond` |
| `country` | `string` | Ülke kodu (ör: `"TR"`) |
| `gamesPlayed` | `number` | Toplam oynanan oyun sayısı |
| `correctAnswers` | `number` | Toplam doğru cevap sayısı |
| `globalScore` | `number` | Eski kümülatif skor (geriye uyumluluk için korunuyor) |
| `weightedGlobalScore` | `number` | **🆕 Katsayılı genel skor** — tüm oyunların `bestScore × coefficient` toplamı |
| `currentStreak` | `number` | Mevcut ardışık doğru serisi |
| `bestStreak` | `number` | En uzun ardışık doğru serisi |
| `createdAt` | `timestamp` | Hesap oluşturulma tarihi |
| `lastActive` | `timestamp` | Son aktivite tarihi |

### `users/{deviceId}/gameStats/{gameId}` — Oyun Bazlı İstatistikler 🆕

Her oyuncunun her oyun için ayrı tuttuğu istatistikler. `submitGameResult` her çağrıldığında otomatik güncellenir.

| Alan | Tip | Açıklama |
|---|---|---|
| `gameId` | `string` | Oyun kimliği (ör: `"laserPuzzle"`) |
| `bestScore` | `number` | O oyundaki en iyi skor |
| `weightedScore` | `number` | `bestScore × coefficient` — genel skora katkısı |
| `gamesPlayed` | `number` | O oyunda toplam oynama sayısı |
| `totalScore` | `number` | O oyundaki tüm skorların toplamı |
| `avgScore` | `number` | Ortalama skor (`totalScore / gamesPlayed`) |
| `lastPlayedAt` | `timestamp` | O oyunun son oynandığı tarih |

### `matchResults/{deviceId}_{gameId}_lvl_{level}` — Level Bazlı En İyi Sonuçlar

Her oyuncu+oyun+level kombinasyonu için tek kayıt. Sadece best skor tutulur.

| Alan | Tip | Açıklama |
|---|---|---|
| `deviceId` | `string` | Oyuncu kimliği |
| `gameId` | `string` | Oyun kimliği |
| `level` | `number` | Level numarası |
| `difficulty` | `number` | Zorluk (1–10) |
| `correct` | `boolean` | Doğru mu cevaplandı |
| `responseTime` | `number` | Cevap süresi (saniye) |
| `ratingChange` | `number` | Bu sonuçla kazanılan rating |
| `scoreGained` | `number` | Bu sonuçla kazanılan skor |
| `createdAt` | `timestamp` | İlk oynama tarihi |
| `updatedAt` | `timestamp` | Son güncelleme tarihi |

### `games/{gameId}` — Oyun Tanımları

`seedGames` çalıştırıldığında doldurulan oyun listesi.

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | `string` | Oyun kimliği |
| `name` | `string` | Görünen ad (ör: `"Laser Puzzle"`) |
| `subtitle` | `string` | Kısa açıklama |
| `gameType` | `string` | iOS enum değeri (ör: `".laserPuzzle"`) |
| `hasStoryMode` | `boolean` | Hikaye modu var mı |
| `requiresPro` | `boolean` | Pro abonelik gerekli mi |
| `order` | `number` | Listede sıralama |
| `leaderboardCoefficient` | `number` | 🆕 Genel sıralamaya etki katsayısı |

### Veri Akışı Örneği

```
Oyuncu "Ali" → Laser Puzzle Level 3 bitirir → skor: 200

1. matchResults/ALI_laserPuzzle_lvl_3
   → scoreGained: 200 (önceki 150'den büyük → güncellendi)

2. users/ALI/gameStats/laserPuzzle
   → bestScore: 200 (önceki 150'den büyük → güncellendi)
   → weightedScore: 200 × 1.2 = 240
   → gamesPlayed: 9 (artırıldı)

3. users/ALI
   → weightedGlobalScore: +60 arttı (240 - 180 = 60 delta)
   → globalScore: +50 arttı (200 - 150 = 50 delta)
   → gamesPlayed: +1
```

---

## iOS Akışı

```
┌─────────────────┐
│   Oyun Biter    │
│  submitGameResult│──→ Backend otomatik olarak:
└─────────────────┘     • matchResults günceller
                        • gameStats/{gameId} günceller (bestScore, avgScore, gamesPlayed)
                        • weightedGlobalScore yeniden hesaplar
                        • Response'da güncel tüm bilgileri döner
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  Oyun Leaderboard    Genel Leaderboard     Oyuncu Profili
  getGameLeaderboard  getGlobalLeaderboard  getPlayerGameScores
```

---

## Endpoint URL'leri

| # | Endpoint | Method | URL |
|---|---|---|---|
| 1 | Oyun Listesi | GET | `https://us-central1-mini-games-9a4e1.cloudfunctions.net/getGameList` |
| 2 | Skor Gönder | POST | `https://us-central1-mini-games-9a4e1.cloudfunctions.net/submitGameResult` |
| 3 | Oyun Leaderboard | GET | `https://us-central1-mini-games-9a4e1.cloudfunctions.net/getGameLeaderboard` |
| 4 | Genel Leaderboard | GET | `https://us-central1-mini-games-9a4e1.cloudfunctions.net/getGlobalLeaderboard` |
| 5 | Oyuncu Detay | GET | `https://us-central1-mini-games-9a4e1.cloudfunctions.net/getPlayerGameScores` |

---

## Endpoint Detayları

### 0️⃣ Oyun Listesi — `GET /getGameList`

Tüm oyunları katsayılarıyla birlikte döner. Chip listesi için kullanılır.

**Request:**
```
GET /getGameList
```

**Response:**
```json
{
    "success": true,
    "games": [
        { "id": "hiddenPair", "name": "Hidden Pair", "coefficient": 0.8 },
        { "id": "pipeConnect", "name": "Pipe Connect", "coefficient": 1.0 },
        { "id": "blockFit", "name": "Block Fit", "coefficient": 1.0 },
        { "id": "laserPuzzle", "name": "Laser Puzzle", "coefficient": 1.2 },
        { "id": "numberCircuit", "name": "Number Circuit", "coefficient": 1.2 },
        { "id": "binaryPuzzle", "name": "Binary Puzzle", "coefficient": 1.3 },
        { "id": "neuralLink", "name": "Neural Link", "coefficient": 1.3 },
        { "id": "cryptoCage", "name": "Crypto-Cage", "coefficient": 1.4 },
        { "id": "pixelExcavation", "name": "Pixel Excavation", "coefficient": 1.5 },
        { "id": "slitherlink", "name": "Slitherlink", "coefficient": 1.5 },
        { "id": "galacticBeacons", "name": "Galactic Beacons", "coefficient": 1.5 }
    ]
}
```

---

### 1️⃣ Skor Gönder — `POST /submitGameResult`

Oyun bittiğinde çağırılır. **Mevcut endpoint, değişiklik yok**, sadece response'a yeni alanlar eklendi.

**Request Body:**
```json
{
    "deviceId": "ABCD-1234-5678",
    "gameId": "laserPuzzle",
    "level": 3,
    "difficulty": 5,
    "correct": true,
    "responseTime": 8.5,
    "isStoryMode": false
}
```

**Response:**
```json
{
    "success": true,
    "improved": true,
    "newRating": 1045,
    "ratingChange": 15,
    "tier": "Silver",
    "scoreGained": 165,
    "newStreak": 3,
    "previousBest": 120,
    "weightedGlobalScore": 1450,
    "gameStats": {
        "gameId": "laserPuzzle",
        "bestScore": 165,
        "coefficient": 1.2,
        "weightedScore": 198,
        "gamesPlayed": 8
    }
}
```

> **Not:** `improved: false` döndüğünde önceki best score geçilememiş demektir. `weightedGlobalScore` ve `gameStats` yine döner.

---

### 2️⃣ Oyun Bazlı Leaderboard — `GET /getGameLeaderboard`

Belirli bir oyunun sıralama tablosunu gösterir.

**Request:**
```
GET /getGameLeaderboard?gameId=laserPuzzle&limit=50&deviceId=ABCD-1234
```

| Parametre | Zorunlu | Açıklama |
|---|---|---|
| `gameId` | ✅ | Hangi oyunun leaderboard'u |
| `limit` | ❌ | Kaç oyuncu (varsayılan 50, max 200) |
| `deviceId` | ❌ | Kendi sırası için |

**Response:**
```json
{
    "success": true,
    "gameId": "laserPuzzle",
    "coefficient": 1.2,
    "leaderboard": [
        {
            "rank": 1,
            "deviceId": "USER-001",
            "username": "Ali",
            "bestScore": 350,
            "weightedScore": 420,
            "gamesPlayed": 12
        },
        {
            "rank": 2,
            "deviceId": "USER-002",
            "username": "Ayşe",
            "bestScore": 280,
            "weightedScore": 336,
            "gamesPlayed": 8
        }
    ],
    "myRank": 15,
    "myBestScore": 180
}
```

**iOS'da kullanım:**
- Oyun detay ekranında "Sıralama" tab'ında göster
- `myRank` ve `myBestScore` ile oyuncunun kendi pozisyonunu göster
- `coefficient` ile "Bu oyun genel sıralamaya ×1.2 katkı sağlar" bilgisi gösterilebilir

---

### 3️⃣ Genel Leaderboard — `GET /getGlobalLeaderboard`

Tüm oyunların ağırlıklı toplamıyla genel sıralama.

**Request:**
```
GET /getGlobalLeaderboard?limit=100&deviceId=ABCD-1234
```

| Parametre | Zorunlu | Açıklama |
|---|---|---|
| `limit` | ❌ | Kaç oyuncu (varsayılan 100, max 200) |
| `deviceId` | ❌ | Kendi sırası için |

**Response:**
```json
{
    "success": true,
    "players": [
        {
            "rank": 1,
            "uid": "USER-001",
            "username": "Ali",
            "weightedGlobalScore": 2450,
            "globalScore": 2100,
            "tier": "Diamond",
            "gamesPlayed": 45,
            "bestStreak": 12
        }
    ],
    "myRank": 8,
    "myScore": 1800
}
```

**iOS'da kullanım:**
- Ana leaderboard ekranında göster
- `weightedGlobalScore` ana sıralama puanı
- `tier` ile rozet/renk gösterilebilir
- `myRank` / `myScore` ile "Senin sıran" bölümü

---

### 4️⃣ Oyuncu Skor Detayları — `GET /getPlayerGameScores`

Bir oyuncunun tüm oyunlardaki istatistiklerini ve her oyunun genel skora katkısını gösterir.

**Request:**
```
GET /getPlayerGameScores?deviceId=ABCD-1234
```

**Response:**
```json
{
    "success": true,
    "deviceId": "ABCD-1234",
    "username": "Ali",
    "weightedGlobalScore": 2450,
    "games": [
        {
            "gameId": "slitherlink",
            "gameName": "Slitherlink",
            "bestScore": 300,
            "coefficient": 1.5,
            "weightedScore": 450,
            "gamesPlayed": 20,
            "avgScore": 220,
            "lastPlayedAt": "2026-03-13T15:30:00Z"
        },
        {
            "gameId": "laserPuzzle",
            "gameName": "Laser Puzzle",
            "bestScore": 280,
            "coefficient": 1.2,
            "weightedScore": 336,
            "gamesPlayed": 15,
            "avgScore": 200,
            "lastPlayedAt": "2026-03-12T10:00:00Z"
        }
    ]
}
```

**iOS'da kullanım:**
- Profil ekranında "Oyun İstatistikleri" bölümünde göster
- Her oyunun ne kadar katkı sağladığını bar chart ile görselleştir
- `weightedScore` ile sıralı gösterilir (en çok katkı yapan oyun üstte)

---

## iOS Model Önerileri

```swift
// MARK: - Leaderboard Models

struct LeaderboardPlayer: Codable {
    let rank: Int
    let uid: String?       // genel leaderboard
    let deviceId: String?  // oyun leaderboard
    let username: String
    let weightedGlobalScore: Int?
    let bestScore: Int?
    let weightedScore: Int?
    let tier: String?
    let gamesPlayed: Int
    let bestStreak: Int?
}

struct GameLeaderboardResponse: Codable {
    let success: Bool
    let gameId: String
    let coefficient: Double
    let leaderboard: [LeaderboardPlayer]
    let myRank: Int
    let myBestScore: Int
}

struct GlobalLeaderboardResponse: Codable {
    let success: Bool
    let players: [LeaderboardPlayer]
    let myRank: Int
    let myScore: Int
}

struct PlayerGameScore: Codable {
    let gameId: String
    let gameName: String
    let bestScore: Int
    let coefficient: Double
    let weightedScore: Int
    let gamesPlayed: Int
    let avgScore: Double
    let lastPlayedAt: String?
}

struct PlayerGameScoresResponse: Codable {
    let success: Bool
    let deviceId: String
    let username: String
    let weightedGlobalScore: Int
    let games: [PlayerGameScore]
}

struct SubmitResultResponse: Codable {
    let success: Bool
    let improved: Bool
    let newRating: Int
    let ratingChange: Int
    let tier: String
    let scoreGained: Int
    let newStreak: Int
    let previousBest: Int?
    let weightedGlobalScore: Int?
    let gameStats: GameStatsResult?
    let message: String?
}

struct GameStatsResult: Codable {
    let gameId: String
    let bestScore: Int
    let coefficient: Double
    let weightedScore: Int
    let gamesPlayed: Int
}
```

---

## Deploy Sonrası Checklist

1. `firebase deploy --only functions` ile deploy et
2. `seedGames` endpoint'ini çağır (katsayıları Firestore'a yaz)
3. `firebase deploy --only firestore:indexes` ile yeni index'leri oluştur
4. `firebase deploy --only firestore:rules` ile güncel kuralları uygula
