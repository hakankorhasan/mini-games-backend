# Block Fit API — iOS Integration Guide

## Base URL
```
https://us-central1-mini-games-9a4e1.cloudfunctions.net
```

## Toplam 1000 Level

| Tier | Levels | Score | Blocks | Prefill | difficultyValue |
|------|--------|-------|--------|---------|:---:|
| Beginner I | 1–40 | 25→60 | single, domino, triomino (0–8) | 0 | 1 |
| Beginner II | 41–100 | 60→100 | single, domino, triomino (0–8) | 0 | 2 |
| Intermediate I | 101–180 | 80→130 | + tetromino (0–16) | 0 | 3 |
| Intermediate II | 181–280 | 120→180 | tetromino (0–16) | 0–1 | 4 |
| Advanced I | 281–400 | 160→230 | + pentomino (0–22) | 0–1 | 5 |
| Advanced II | 401–500 | 220→300 | + 2×2 block (0–23) | 1–2 | 6 |
| Expert I | 501–620 | 280→380 | + corners (0–26) | 1–2 | 7 |
| Expert II | 621–750 | 350→450 | all shapes (0–28) | 2 | 8 |
| Master I | 751–880 | 420→550 | all shapes (0–28) | 2–3 | 9 |
| Master II | 881–1000 | 500→700 | all shapes (0–28) | 3–4 | 10 |

---

## Endpoints

### 1. Tek Level Getir — `GET /getBlockFitLevels?level=5`

```json
{
  "success": true,
  "level": {
    "levelNumber": 5,
    "gridSize": 9,
    "targetScore": 29,
    "difficulty": "beginner",
    "difficultyValue": 1,
    "prefill": [],
    "blockPool": [0, 1, 2, 3, 4, 5, 6, 7, 8]
  }
}
```

### 2. Prefill'li Level Örneği — `GET /getBlockFitLevels?level=500`

```json
{
  "success": true,
  "level": {
    "levelNumber": 500,
    "gridSize": 9,
    "targetScore": 300,
    "difficulty": "advanced",
    "difficultyValue": 6,
    "prefill": [
      { "row": 8, "col": 0, "colorIndex": -1 },
      { "row": 8, "col": 1, "colorIndex": -1 },
      { "row": 8, "col": 2, "colorIndex": -1 },
      { "row": 8, "col": 5, "colorIndex": -1 },
      { "row": 8, "col": 6, "colorIndex": -1 },
      { "row": 8, "col": 8, "colorIndex": -1 },
      { "row": 7, "col": 0, "colorIndex": -1 },
      { "row": 7, "col": 1, "colorIndex": -1 },
      { "row": 7, "col": 2, "colorIndex": -1 },
      { "row": 7, "col": 4, "colorIndex": -1 },
      { "row": 7, "col": 5, "colorIndex": -1 },
      { "row": 7, "col": 6, "colorIndex": -1 }
    ],
    "blockPool": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
  }
}
```

### 3. Level Listesi — `GET /getBlockFitLevels?page=1&pageSize=20`

```json
{
  "success": true,
  "page": 1,
  "pageSize": 20,
  "totalLevels": 1000,
  "totalPages": 50,
  "levels": [
    { "levelNumber": 1, "gridSize": 9, "difficulty": "beginner", "difficultyValue": 1, "targetScore": 25 },
    { "levelNumber": 2, "gridSize": 9, "difficulty": "beginner", "difficultyValue": 1, "targetScore": 26 }
  ]
}
```

---

## Level Data — Field Açıklamaları

| Field | Tip | Açıklama |
|-------|-----|----------|
| `levelNumber` | Int | Level numarası (1–1000) |
| `gridSize` | Int | Grid boyutu, her zaman **9** |
| `targetScore` | Int | Kazanmak için gereken minimum skor |
| `difficulty` | String | `"beginner"`, `"intermediate"`, `"advanced"`, `"expert"`, `"master"` |
| `difficultyValue` | Int | 1–10 arası zorluk değeri (skor hesaplama için) |
| `prefill` | [PrefillCell] | Önceden dolu hücreler (boş dizi = prefill yok) |
| `blockPool` | [Int] | Kullanılabilir blok template indeksleri |

### PrefillCell

| Field | Tip | Açıklama |
|-------|-----|----------|
| `row` | Int | Satır (0–8, 0 = üst) |
| `col` | Int | Sütun (0–8, 0 = sol) |
| `colorIndex` | Int | `-1` = gri (#404045). Normal bloklar 0–7 arası renk alır |

---

## 28 Blok Template

Bloklar `blockPool` array'indeki indekslere göre spawn edilir. iOS client blok spawn ederken bu pool'dan rastgele seçim yapar.

| Index | İsim | Hücre | Şekil |
|:---:|------|:---:|-------|
| 0 | Single | 1 | `•` |
| 1 | Domino H | 2 | `••` |
| 2 | Domino V | 2 | `•` üstüne `•` |
| 3 | Tri I H | 3 | `•••` |
| 4 | Tri I V | 3 | Dikey üçlü |
| 5 | Tri L | 3 | `•` + `••` (L) |
| 6 | Tri L R | 3 | `••` + `•` (L ters) |
| 7 | Tri L 180 | 3 | `••` + sağ alt |
| 8 | Tri L 270 | 3 | Sol alt + `••` |
| 9 | Tetra I H | 4 | `••••` |
| 10 | Tetra I V | 4 | Dikey dörtlü |
| 11 | Tetra O | 4 | 2×2 kare |
| 12 | Tetra L | 4 | L-tetromino |
| 13 | Tetra J | 4 | J-tetromino |
| 14 | Tetra S | 4 | S-tetromino |
| 15 | Tetra Z | 4 | Z-tetromino |
| 16 | Tetra T | 4 | T-tetromino |
| 17 | Penta I H | 5 | `•••••` |
| 18 | Penta I V | 5 | Dikey beşli |
| 19 | Penta L | 5 | L-pentomino |
| 20 | Penta J | 5 | J-pentomino |
| 21 | Penta S | 5 | S-pentomino |
| 22 | Penta Stair | 5 | Merdiven şeklinde |
| 23 | Block 2×2 | 4 | 2×2 dolu kare |
| 24 | Block 3×3 | 9 | 3×3 dolu kare |
| 25 | Corner TL | 5 | Sol üst köşe L |
| 26 | Corner TR | 5 | Sağ üst köşe L |
| 27 | Corner BL | 5 | Sol alt köşe L |
| 28 | Corner BR | 5 | Sağ alt köşe L |

---

## Renk Paleti

Bloklar spawn edilirken rastgele renk atanır (client-side).

| Index | Renk | Hex |
|:---:|------|-----|
| 0 | Kırmızı | `#FF4444` |
| 1 | Mavi | `#4488FF` |
| 2 | Yeşil | `#44CC44` |
| 3 | Sarı | `#FFCC00` |
| 4 | Mor | `#AA44FF` |
| 5 | Turuncu | `#FF8800` |
| 6 | Teal | `#00CCCC` |
| 7 | Pembe | `#FF66AA` |
| -1 | Gri (prefill) | `#404045` |

---

## iOS Tarafında Güncellenecekler

### 1. Level API'den Çekilecek (Client-Side Spawn Kalkıyor)

Mevcut client-side difficulty seçimi ve rastgele level oluşturma **kalkacak**. Yerine:

```
1. GET /getBlockFitLevels?level=N → level data al
2. targetScore, prefill, blockPool backend'den gelecek
3. Sadece blok spawn (blockPool'dan rastgele seçim) ve renk atama client'ta kalacak
```

### 2. BlockFitLevel Model

```swift
struct BlockFitLevel: Codable {
    let levelNumber: Int
    let gridSize: Int           // her zaman 9
    let targetScore: Int
    let difficulty: String      // "beginner", "intermediate", "advanced", "expert", "master"
    let difficultyValue: Int    // 1–10
    let prefill: [PrefillCell]
    let blockPool: [Int]        // blok template indeksleri
}

struct PrefillCell: Codable {
    let row: Int
    let col: Int
    let colorIndex: Int         // -1 = gri
}
```

### 3. Grid Initialization

```
1. 9×9 boş grid oluştur
2. prefill array'indeki hücreleri gri (#404045) ile doldur
3. blockPool'u sakla → blok spawn ederken bu pool'dan rastgele seç
4. targetScore'u UI'da göster
```

### 4. Blok Spawn Mantığı

```
Mevcut: maxBlockIndex'e göre rastgele blok index seç
Yeni:   blockPool array'inden rastgele index seç

// Örnek:
let blockPool = level.blockPool  // [0, 1, 2, 3, 4, 5, 6, 7, 8]
let randomIndex = blockPool.randomElement()!
let template = BLOCK_TEMPLATES[randomIndex]
let color = COLORS.randomElement()!
```

### 5. Skor Hesaplama (difficultyValue Kullanımı)

```swift
// difficultyValue (1–10) skor çarpanı olarak kullanılabilir
let baseScore = cellCount + (clearedLines * 9) + comboBonus
let finalScore = baseScore * level.difficultyValue
```

### 6. Kazanma Koşulu

```
if currentScore >= level.targetScore {
    // Kazandı! → saveGameProgress + submitGameResult
}
```

---

## Oyun Akışı

```
1. Level Seçim
   └─ GET /getBlockFitLevels?page=1&pageSize=20
   └─ Listeyi göster (levelNumber, difficulty, targetScore)

2. Oyuna Başla
   └─ GET /getBlockFitLevels?level=N
   └─ prefill → grid'e gri hücreleri yerleştir
   └─ blockPool → blok spawn pool'u ayarla
   └─ targetScore → UI'da göster

3. Oynama
   └─ blockPool'dan 3 rastgele blok spawn et
   └─ Kullanıcı blokları sürükle-bırak yerleştirir
   └─ Her yerleştirmede: skor += hücreSayısı
   └─ Dolu satır/sütun → sil + skor += 9
   └─ Gravity uygula (hücreler aşağı düşer)
   └─ 3 blok bittiyse → yeni 3 blok spawn
   └─ Hiçbir blok sığmıyorsa → Game Over

4. Kazandı (skor ≥ targetScore)
   └─ POST /saveGameProgress { deviceId, gameId: "blockFit", currentLevel: N+1 }
   └─ POST /submitGameResult { deviceId, gameId: "blockFit", score, difficulty }

5. Kaybetti (hiçbir blok sığmıyor + skor < targetScore)
   └─ Game Over ekranı
   └─ Tekrar dene veya level seçimine dön
```

---

## Skor Gönderme

```
POST /submitGameResult

Body:
{
    "deviceId": "ABC123-DEVICE-UUID",
    "nickname": "Hakan",
    "gameId": "blockFit",
    "score": 150,
    "difficulty": 6,
    "timeSpent": 120.5
}
```

- `gameId`: Her zaman `"blockFit"`
- `score`: Oyun sonu toplam skor
- `difficulty`: `difficultyValue` (1–10)
- `timeSpent`: Oyun süresi (saniye)

---

## Progress Kayıt / Yükleme

```
POST /saveGameProgress
Body: { "deviceId": "...", "gameId": "blockFit", "currentLevel": 6, "completedLevels": [1,2,3,4,5] }

GET /getGameProgress?deviceId=...&gameId=blockFit
→ { "currentLevel": 6, "completedLevels": [1,2,3,4,5] }
```

---

## Özet: Backend ile Etkileşim

| İşlem | Endpoint | Yön | Ne zaman |
|-------|----------|-----|----------|
| Level listesi | `GET /getBlockFitLevels?page=N` | ← Read | Level seçim ekranı |
| Level data | `GET /getBlockFitLevels?level=N` | ← Read | Oyun başlangıcı |
| Progress kaydet | `POST /saveGameProgress` | → Write | Level tamamlandığında |
| Progress yükle | `GET /getGameProgress` | ← Read | Uygulama açılışı |
| Skor gönder | `POST /submitGameResult` | → Write | Oyun bittiğinde |
| Leaderboard | `GET /getPlayerLeaderboard` | ← Read | Leaderboard ekranı |
