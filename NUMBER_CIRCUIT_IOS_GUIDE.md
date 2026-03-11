# Number Circuit — iOS Entegrasyon Rehberi

## Oyun Nedir?

Grid üzerinde sayılar var. Oyuncu komşu sayıları sürükleyerek bağlar, aralarına operatör koyar ve hedef sayıya ulaşmaya çalışır.

```
TARGET: 24

Grid:
  3   5   2
  8   1   4
  6   7   9

Çözüm: 6 × 4 = 24
```

---

## Mimari

```
CLIENT (iOS)                          BACKEND (Firebase)
─────────────                         ─────────────────
Level generator (lokal)               ✗ Level üretmiyor
Grid renderer                         Daily challenge endpoint
Puzzle solver                         Skor kayıt (submitScore)
Oyun mantığı                          Leaderboard (getPlayerLeaderboard)
                                      Game registry (games collection)
```

> **Level generation tamamen client-side.** Backend'e level istemek yok. Oyuncu offline da oynayabilir.

---

## Backend API'ları

### 1. Game Registry (Firestore)

Oyun listesi `games` collection'ından okunur. Number Circuit kaydı:

```
Firestore: games/numberCircuit

{
    "id": "numberCircuit",
    "name": "Number Circuit",
    "subtitle": "Connect numbers. Build equations. Reach the target.",
    "gameType": ".numberCircuit",
    "hasStoryMode": false,
    "requiresPro": false,
    "order": 10
}
```

Routing: `gameType == ".numberCircuit"` geldiğinde Number Circuit ekranını aç.

---

### 2. Daily Challenge

**Her gün tüm oyunculara aynı puzzle.** Backend üretir ve cache'ler.

**Request:**
```
GET https://us-central1-mini-games-9a4e1.cloudfunctions.net/getDailyChallenge?date=2026-03-11
```

`date` verilmezse bugünü alır.

**Response:**
```json
{
    "success": true,
    "date": "2026-03-11",
    "level": {
        "grid": [
            [4, 7, 2, 5, 1],
            [9, 3, 8, 6, 4],
            [1, 5, 2, 7, 3],
            [6, 8, 4, 1, 9],
            [3, 2, 7, 5, 6]
        ],
        "gridSize": 5,
        "target": 36,
        "allowedOperators": ["+", "-", "×", "÷"],
        "specialTiles": [
            {
                "position": { "row": 2, "col": 3 },
                "type": "locked"
            },
            {
                "position": { "row": 4, "col": 1 },
                "type": "bomb"
            }
        ],
        "solution": [
            { "position": { "row": 3, "col": 0 } },
            { "position": { "row": 4, "col": 1 }, "operator": "×" },
            { "position": { "row": 3, "col": 1 }, "operator": "÷" }
        ],
        "solutionExpression": "6 × 2 ÷ 8",
        "hints": {
            "hint1": { "position": { "row": 3, "col": 0 } },
            "hint2": { "positions": [{ "row": 3, "col": 0 }, { "row": 4, "col": 1 }] },
            "hint3": {
                "positions": [{ "row": 3, "col": 0 }, { "row": 4, "col": 1 }],
                "operator": "×"
            }
        }
    }
}
```

---

### 3. Skor Gönderme

Normal oyun veya challenge mode bitince:

**Request:**
```
POST https://us-central1-mini-games-9a4e1.cloudfunctions.net/submitScore

Body:
{
    "deviceId": "ABC123-DEVICE-UUID",
    "nickname": "Hakan",
    "gameId": "numberCircuit",
    "score": 150,
    "difficulty": 25,
    "timeSpent": 45.2
}
```

- `gameId`: Her zaman `"numberCircuit"`
- `score`: Hesaplama sana kalmış (çözülen level sayısı, süre bazlı puan, vs.)
- `difficulty`: Level numarası veya zorluk seviyesi
- `timeSpent`: Saniye cinsinden süre (opsiyonel)

**Response:**
```json
{
    "success": true,
    "totalScore": 1250,
    "gameStats": {
        "gameId": "numberCircuit",
        "totalScore": 450,
        "gamesPlayed": 5,
        "bestScore": 200,
        "avgScore": 90,
        "lastScore": 150
    }
}
```

---

### 4. Leaderboard

Mevcut `getPlayerLeaderboard` endpoint'i Number Circuit için de çalışır. Ayrı bir şey yapmana gerek yok.

---

## Level Generator — Client Tarafında Nasıl Çalışır

Level generation tamamen client'ta olacak. Backend'deki `utils/numberCircuit.ts` dosyasındaki algoritma birebir port edilmeli.

### Akış

```
levelNumber (1, 2, 3, ...)
    │
    ▼
getLevelConfig(levelNumber)          → gridSize, allowedOps, specialTiles ayarları
    │
    ▼
generateGrid(gridSize)              → 1-9 arası random sayılarla grid doldur
    │
    ▼
generatePath(grid)                  → Komşu hücrelerden random yol bul (min 2, tekrar yok)
    │
    ▼
assignOperators(path, allowedOps)   → Her bağlantı arasına random operatör ata
    │
    ▼
evaluateExpression(values, ops)     → Hedef sayıyı hesapla (× ÷ ^ önce, + - sonra)
    │
    ├── target ≤ 0?      → tekrar üret
    ├── target > 9999?    → tekrar üret
    ├── küsuratlı mı?     → tekrar üret
    │
    ▼
generateSpecialTiles(...)           → Locked, bomb, multiplier tile'ları yerleştir
    │
    ▼
generateHints(path, operators)      → 3 kademeli ipucu üret
    │
    ▼
NCLevel { grid, target, solution, hints, specialTiles, ... }
```

### Zorluk Tablosu

| Level | Grid | Operatörler | Special Tiles | Path Uzunluğu |
|-------|------|-------------|---------------|---------------|
| 1-10 | 3×3 | `+ -` | yok | 2-3 |
| 11-25 | 4×4 | `+ - ×` | locked | 2-4 |
| 26-60 | 5×5 | `+ - × ÷` | locked, multiplier, bomb | 3-5 |
| 61+ | 6×6 | `+ - × ÷ ^ combine` | locked, multiplier, forcedOp, bomb | 3-6 |

### Operatörler

| Operatör | Sembol | Açıklama | Öncelik |
|----------|--------|----------|---------|
| `+` | + | Toplama | Düşük |
| `-` | − | Çıkarma | Düşük |
| `×` | × | Çarpma | Yüksek |
| `÷` | ÷ | Bölme | Yüksek |
| `^` | ^ | Üs alma | Yüksek |
| `combine` | (yok) | Digit birleştir: `1,2` → `12` | En yüksek |

### İşlem Önceliği

```
3 + 5 × 4
= 3 + (5 × 4)
= 3 + 20
= 23          ← 43 DEĞİL!
```

**3 pass:**
1. `combine` çöz → `1 combine 2` = `12`
2. `^ × ÷` çöz
3. `+ -` çöz

### Special Tile'lar

| Tile | Davranış |
|------|----------|
| 🔒 **Locked** | Bu sayı çözümde **mutlaka** kullanılmalı |
| ✖ **Multiplier** (`×2`, `×3`) | Üzerinden geçince sayı çarpılır |
| ➕ **Forced Operator** | Bu tile'dan geçince operatör zorunlu olur |
| 💣 **Bomb** | Bu sayı kullanılmazsa level **fail** olur |

### Seeded Random (Deterministic)

`generateLevel(levelNumber)` çağırırken bir seed kullan. Aynı seed = aynı level.

```
seed = hash("level-{levelNumber}")
rand = SeededRandom(seed)
level = generateLevel(levelNumber, rand)
```

**Backend'deki algoritma:** Mulberry32 PRNG. Daily challenge'ın her yerde aynı çıkması için bu algoritmayı birebir port et.

---

## Oyuncu Akışı

```
1. Level yükle (client-side generate)
2. Grid ekranda göster + hedef sayı üstte
3. Oyuncu parmağıyla sayıları sürükle/dokun:
   - Sadece komşu hücrelere bağlanabilir (yatay/dikey/çapraz)
   - Aynı hücre tekrar seçilemez
4. Sayılar arasına operatör seç (alt bar'dan)
5. Alt kısımda anlık expression + sonuç göster
6. Submit:
   - Doğru → glow + circuit animasyonu → skor kaydet → next level
   - Yanlış → shake animasyonu → tekrar dene
```

---

## Challenge Mode (3 Dakika Sprint)

```
1. Timer başlat: 180 saniye
2. Orta zorluk level üret (levelNumber ~15)
3. Çöz → skor +1
4. Yeni level üret → çöz → skor +1
5. Süre bitince: toplam çözülen puzzle sayısı = skor
6. submitScore ile backend'e gönder
```

---

## Hint Sistemi

Oyuncu takılırsa 3 kademe ipucu:

| Kademe | Ne gösterilir |
|--------|---------------|
| Hint 1 | Çözümdeki ilk sayının pozisyonu |
| Hint 2 | İlk iki sayının pozisyonu |
| Hint 3 | İlk iki sayı + aralarındaki operatör |

Hint verileri level objesinin `hints` alanında zaten mevcut.

---

## Özet: Backend ile Etkileşim

| İşlem | Endpoint | Yön | Ne zaman |
|-------|----------|-----|----------|
| Oyun listesini al | Firestore `games` | ← Read | Uygulama açılışı |
| Daily puzzle al | `GET /getDailyChallenge` | ← Read | Daily mode açılışı |
| Skor gönder | `POST /submitScore` | → Write | Level çözüldüğünde |
| Leaderboard al | `GET /getPlayerLeaderboard` | ← Read | Leaderboard ekranı |
| Normal level üret | **Lokal** | — | Her level başında |
