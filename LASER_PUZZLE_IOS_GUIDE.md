# 🔴 Laser Puzzle — iOS Entegrasyon Rehberi

## Genel Bakış

Laser Puzzle oyunu **backend-driven 200 level** sistemi kullanıyor. Level'lar backend'de üretilip Firestore'da saklanıyor. Oyuncu N×N grid üzerinde aynaları döndürerek lazerin source'tan target'a ulaşmasını sağlıyor.

---

## 1. Mimari Özet

```
┌─────────────┐         ┌──────────────────┐         ┌───────────┐
│  iOS Client │ ──GET── │  Cloud Functions  │ ──R/W── │ Firestore │
│             │ ──CALL─ │                   │         │           │
└─────────────┘         └──────────────────┘         └───────────┘

Firestore Collections:
├── laserPuzzleLevels/level_1, level_2, ...   (puzzle verileri)
└── laserPuzzleProgress/{userId}              (kullanıcı ilerlemesi)
```

---

## 2. API Endpoints

> **Tüm endpoint'ler Firebase Callable Function.** iOS tarafında `Functions.functions().httpsCallable(...)` ile çağırılır.

### 2.1 Level Listesi (Level Seçim Ekranı)

```swift
Functions.functions().httpsCallable("getLaserPuzzleLevels").call(["page": 1, "pageSize": 20]) { result, error in
    // result.data → { success, page, pageSize, totalLevels, totalPages, levels: [...] }
}
```

**Response data:**
```json
{
  "success": true,
  "page": 1,
  "pageSize": 20,
  "totalLevels": 200,
  "totalPages": 10,
  "levels": [
    { "levelNumber": 1, "gridSize": 5, "difficulty": "beginner", "lives": 5 },
    { "levelNumber": 2, "gridSize": 5, "difficulty": "beginner", "lives": 5 }
  ]
}
```

> **Not:** Bu çağrı `cells` ve `solution` döndürmez — sadece level listesi için.

---

### 2.2 Tek Level Getir (Oyun Başlatma)

```swift
Functions.functions().httpsCallable("getLaserPuzzleLevels").call(["level": 1]) { result, error in
    // result.data → { success, level: { ... } }
}
```

**Response (gerçek Level 1 verisi):**
```json
{
  "success": true,
  "level": {
    "levelNumber": 1,
    "gridSize": 5,
    "difficulty": "beginner",
    "lives": 5,
    "cells": [
      { "row": 4, "col": 2, "type": "source", "direction": "up" },
      { "row": 1, "col": 2, "type": "mirror", "mirrorAngle": 1, "isFixed": false },
      { "row": 1, "col": 4, "type": "mirror", "mirrorAngle": 1, "isFixed": false },
      { "row": 0, "col": 4, "type": "target" },
      { "row": 1, "col": 0, "type": "mirror", "mirrorAngle": 0, "isFixed": false },
      { "row": 4, "col": 0, "type": "mirror", "mirrorAngle": 0, "isFixed": false },
      { "row": 3, "col": 1, "type": "mirror", "mirrorAngle": 1, "isFixed": false },
      { "row": 3, "col": 0, "type": "mirror", "mirrorAngle": 1, "isFixed": false },
      { "row": 2, "col": 1, "type": "mirror", "mirrorAngle": 0, "isFixed": false }
    ],
    "solution": [
      { "row": 1, "col": 2, "correctAngle": 0 },
      { "row": 1, "col": 4, "correctAngle": 0 }
    ]
  }
}
```

> **Önemli:** `cells` sadece **boş olmayan** hücreleri içerir. Grid'in geri kalanı otomatik "empty".
> `solution` sadece oyuncunun döndürmesi gereken (non-fixed) çözüm aynalarını içerir.

---

### 2.3 İlerleme Kaydet (Level Tamamlandıktan Sonra)

**Firebase Callable Function:**
```swift
Functions.functions().httpsCallable("saveLaserPuzzleProgress").call([
    "currentLevel": nextLevel,
    "completedLevel": justCompletedLevel
])
```

---

### 2.4 İlerleme Getir (Uygulama Açılışı)

**Firebase Callable Function:**
```swift
Functions.functions().httpsCallable("getLaserPuzzleProgress").call([:])
```

**Response:**
```json
{
  "success": true,
  "progress": {
    "currentLevel": 6,
    "completedLevels": [1, 2, 3, 4, 5]
  }
}
```

> İlk kez oynayan için `currentLevel: 1`, `completedLevels: []` döner.

---

## 3. Hücre Tipleri (Cell Types) — Tam Referans

### 3.1 `empty`
- Grid'de `cells` arrayinde yer almaz (otomatik boş)
- Lazer geçer, etkileşim yok

### 3.2 `source`
- Lazerin başladığı nokta (her puzzle'da 1 tane)
- Grid kenarında konumlanır (köşeler hariç)
- `direction` alanı: lazerin ateşleneceği yön
- Kenar kuralı: üst→`down`, sağ→`left`, alt→`up`, sol→`right`

### 3.3 `target`
- Lazerin ulaşması gereken nokta
- Lazer target'a çarptığında **durur** (devam etmez)
- Normal: 1 target. Splitter varsa: 1 + splitterCount target

### 3.4 `mirror`
- İki açısı var:
  - `mirrorAngle = 0` → `/` (slash)
  - `mirrorAngle = 1` → `\` (backslash)
- `isFixed = true` → Kilitli, oyuncu döndüremez (UI'da kilit ikonu göster)
- `isFixed = false` → Oyuncu tıklayarak `mirrorAngle`'ı toggle eder (0↔1)

### 3.5 `wall`
- Lazer duvardan geçemez, durur
- Oyuncu etkileşimi yok, sabit engel

### 3.6 `portal`
- `portalPairId` ile eşleşen çiftler (aynı ID'ye sahip 2 portal birbirine bağlı)
- Lazer bir portala girince, eşleştiğinden **aynı yönde** çıkar
- Renk: `pairId=0` → mor/indigo, `pairId=1` → cyan/teal

### 3.7 `bomb`
- Lazer bombaya çarparsa patlama → can kaybedilir
- Yanlış ayna rotasyonlarını cezalandırır

### 3.8 `splitter`
- Lazeri ikiye ayırır:
  - Bir kol **aynı yönde** devam eder (pass-through)
  - Diğer kol **ayna gibi 90° yansır** (reflect)
- `mirrorAngle` mirror ile aynı mantıkla çalışır
- Oyuncu döndürebilir (fixed değilse)

---

## 4. Yansıma (Reflection) Tabloları

### `/` (slash, `mirrorAngle = 0`)

| Gelen Yön | Çıkan Yön |
|-----------|-----------|
| right →   | ↑ up      |
| down ↓    | ← left   |
| left ←    | ↓ down    |
| up ↑      | → right   |

### `\` (backslash, `mirrorAngle = 1`)

| Gelen Yön | Çıkan Yön |
|-----------|-----------|
| right →   | ↓ down    |
| up ↑      | ← left   |
| left ←    | ↑ up      |
| down ↓    | → right   |

---

## 5. Lazer Trace Algoritması (iOS Tarafı)

```swift
func traceLaser() -> TraceResult {
    // 1. Source'u bul → pozisyon + yön
    // 2. beamQueue = [Beam(source.row, source.col, source.direction)]
    // 3. while beamQueue boş değil:
    //      beam = dequeue
    //      loop:
    //        nextPos = beam.pos + direction delta
    //        if grid dışında → kır
    //        if "row,col,dir" ziyaret edildiyse → kır (sonsuz döngü koruması)
    //        
    //        switch cell.type:
    //          target  → hitTargets.add(pos), DUR
    //          wall    → DUR
    //          source  → DUR (geri dönerse)
    //          mirror  → beam.dir = reflect(beam.dir, mirrorAngle)
    //          bomb    → hitBomb = true, DUR
    //          portal  → beam.pos = eşleşen portalın pozisyonu (yön AYNI kalır)
    //          splitter→ beamQueue.add(Beam(pos, reflect(dir, angle)))  // yeni kol
    //                    beam devam (aynı yönde)                        // mevcut kol
    //          empty   → devam
    //
    // 4. return (hitTargets, hitBomb, allTargetsHit)
}
```

> **Yön deltaları:** `up=(dr:-1, dc:0)`, `down=(dr:+1, dc:0)`, `left=(dr:0, dc:-1)`, `right=(dr:0, dc:+1)`

---

## 6. iOS Tarafı Modeller

### 6.1 Cell Model

```swift
enum CellType: String, Codable {
    case empty, source, target, mirror, wall, portal, bomb, splitter
}

enum LaserDirection: String, Codable {
    case up, down, left, right
}

struct PuzzleCell: Codable {
    let row: Int
    let col: Int
    let type: CellType
    var direction: LaserDirection?    // sadece source
    var mirrorAngle: Int?             // 0 = "/", 1 = "\"  (mirror & splitter)
    var isFixed: Bool?                // mirror & splitter
    var portalPairId: Int?            // sadece portal
}
```

### 6.2 Solution Model

```swift
struct SolutionEntry: Codable {
    let row: Int
    let col: Int
    let correctAngle: Int  // 0 veya 1
}
```

### 6.3 Level Model

```swift
struct LaserPuzzleLevel: Codable {
    let levelNumber: Int
    let gridSize: Int
    let difficulty: String       // "beginner", "intermediate", "advanced", "expert", "master"
    let lives: Int
    let cells: [PuzzleCell]      // sadece non-empty hücreler
    let solution: [SolutionEntry]
}
```

### 6.4 Level Listesi (Hafif Model)

```swift
struct LaserLevelSummary: Codable {
    let levelNumber: Int
    let gridSize: Int
    let difficulty: String
    let lives: Int
}
```

### 6.5 Progress Model

```swift
struct LaserPuzzleProgress: Codable {
    let currentLevel: Int
    let completedLevels: [Int]
}
```

---

## 7. Oyun Akışı

```
[Uygulama Açılır]
       │
       ▼
[getLaserPuzzleProgress → currentLevel, completedLevels]
       │
       ▼
[getLaserPuzzleLevels?page=1 → Level listesi göster]
       │
       ├── Level durumları:
       │   ✅ completedLevels'da varsa → Tamamlanmış
       │   🔓 currentLevel ise → Açık (oynanabilir)
       │   🔒 currentLevel'dan büyükse → Kilitli
       │
       ▼
[Kullanıcı level'a tıklar]
       │
       ▼
[getLaserPuzzleLevels?level=N → Full puzzle verisi]
       │
       ▼
[Grid'i oluştur: gridSize×gridSize boş grid + cells overlay]
       │
       ▼
[Oyuncu aynaları döndürür (mirrorAngle toggle 0↔1)]
       │  ← isFixed=true olanlar döndürülemez!
       │
       ▼
["Lazeri Ateşle" butonuna basar → traceLaser()]
       │
       ├── allTargetsHit=true  → 🎉 Level tamamlandı!
       │   └── saveLaserPuzzleProgress(currentLevel+1, completedLevel)
       │
       ├── hitBomb=true → 💥 Patlama, can kaybet (lives--)
       │   └── lives == 0 → Game Over, level başa dön
       │
       └── else → Lazer hedefi ıskaladı, can kaybet (lives--)
           └── lives == 0 → Game Over, level başa dön
```

---

## 8. Grid Oluşturma (Backend Veriden)

```swift
func buildGrid(from level: LaserPuzzleLevel) -> [[PuzzleCell]] {
    // 1. gridSize×gridSize boş grid oluştur
    var grid = Array(repeating: Array(repeating: PuzzleCell.empty, count: level.gridSize), count: level.gridSize)
    
    // 2. cells array'deki non-empty hücreleri yerleştir
    for cell in level.cells {
        grid[cell.row][cell.col] = cell
    }
    
    return grid
}
```

---

## 9. Oyuncu Etkileşimi

```swift
func onCellTapped(row: Int, col: Int) {
    let cell = grid[row][col]
    
    switch cell.type {
    case .mirror, .splitter:
        guard cell.isFixed != true else { return }  // Kilitli → dokunma
        // Toggle mirror angle: 0 ↔ 1
        grid[row][col].mirrorAngle = (cell.mirrorAngle == 0) ? 1 : 0
        
    default:
        break  // Diğer hücrelere dokunulamaz
    }
}
```

---

## 10. Kazanma Kontrolü

```swift
func checkSolution(level: LaserPuzzleLevel) -> Bool {
    let result = traceLaser()
    return result.allTargetsHit && !result.hitBomb
}
```

Alternatif (daha basit — solution array ile karşılaştır):
```swift
func checkSolution(level: LaserPuzzleLevel) -> Bool {
    for entry in level.solution {
        let currentAngle = grid[entry.row][entry.col].mirrorAngle ?? -1
        if currentAngle != entry.correctAngle {
            return false
        }
    }
    return true  // Tüm çözüm aynaları doğru açıda
}
```

> **İkinci yöntem daha performanslı** ama lazer animasyonu göstermez. İkisini birlikte kullanabilirsin: önce `traceLaser()` ile lazer animasyonu göster, sonra `checkSolution()` ile doğrula.

---

## 11. Zorluk Skalası

| Level Aralığı | Grid | Ayna | Duvar | Portal | Bomba | Splitter | Can | Decoy |
|---------------|------|------|-------|--------|-------|----------|-----|-------|
| 1–20 Beginner | 5×5 | 2 | 0 | 0 | 0 | 0 | 5 | %30 |
| 21–50 Intermediate | 6×6 | 3 | 0 | 0 | 0 | 0 | 4 | %45 |
| 51–100 Advanced | 7×7 | 5 | 2 | 1 çift | 0 | 0 | 3 | %55 |
| 101–150 Expert | 8×8 | 7 | 3 | 1 çift | 2 | 0 | 2 | %65 |
| 151–200 Master | 10×10 | 10 | 5 | 2 çift | 3 | 1 | 1 | %80 |

**Mekaniğin açılma sırası:**
- **Beginner/Intermediate:** Sadece aynalar + sahte aynalar (decoy)
- **Advanced:** + Duvarlar + Portallar + 1 sabit ayna
- **Expert:** + Bombalar + daha fazla sabit ayna
- **Master:** + Splitter + 2. portal çifti + çok fazla sahte ayna

---

## 12. Önemli Kurallar & Edge Case'ler

| Kural | Detay |
|-------|-------|
| Source konumu | Her zaman kenarda, köşeler hariç |
| Lazer target'ta | **DURUR** — ileri devam etmez |
| Lazer wall'da | **DURUR** |
| Lazer source'a çarparsa | **DURUR** (geri dönerse) |
| Portal yönü | Giriş yönü = çıkış yönü (yön korunur) |
| Splitter | Lazeri ikiye böler — her kol ayrı trace edilir (BFS/queue) |
| Sonsuz döngü koruması | Visited set ile `"row,col,dir"` formatında izlenir |
| Bombalar | Lazer yoluna **komşu** hücrelerde (yolun üstünde değil) |
| Karışık puzzle | Baştan çözülmüş **olmaz** — zorluk garantisi |
| `isFixed` aynalar | Doğru açıda sabit, oyuncu döndüremez |
| Lazer asla düz gitmez | Her puzzle'da en az 1 ayna rotasyonu gerekli |

---

## 13. Firestore Yapısı

```
laserPuzzleLevels/
├── level_1   { levelNumber: 1, gridSize: 5, difficulty: "beginner", lives: 5, cells: [...], solution: [...] }
├── level_2   { ... }
├── ...
└── level_200 { levelNumber: 200, gridSize: 10, difficulty: "master", lives: 1, cells: [...], solution: [...] }

laserPuzzleProgress/{userId}
├── currentLevel: 6
├── completedLevels: [1, 2, 3, 4, 5]
└── updatedAt: <timestamp>
```

---

## 14. UI İpuçları

| Eleman | Görsel |
|--------|--------|
| Source | Lazerin çıktığı yönü gösteren ok ikonu |
| Target | Hedef dairesi / kristal |
| Mirror `/` | 45° çizgi, döndürülebilir (dokunma) |
| Mirror `\` | 135° çizgi, döndürülebilir (dokunma) |
| Fixed mirror | Kilit ikonu ile işaretli, dokunulamaz |
| Wall | Taş/engel bloğu |
| Portal | Renkli halka (pairId'ye göre renk) |
| Bomb | 💣 ikonu |
| Splitter | Prizma / yarı-saydam üçgen |
| Lazer ışını | Kırmızı çizgi animasyonu (trace yolunu takip eder) |

---

## 15. Checklist — iOS Tarafı Yapılacaklar

- [ ] `PuzzleCell`, `SolutionEntry`, `LaserPuzzleLevel`, `LaserPuzzleProgress` modellerini ekle
- [ ] API service: `getLaserPuzzleLevels(level:)`, `getLaserPuzzleLevels(page:pageSize:)`
- [ ] Firebase Callable: `saveLaserPuzzleProgress`, `getLaserPuzzleProgress`
- [ ] Grid oluşturma: `gridSize×gridSize` boş grid + cells overlay
- [ ] Mirror toggle: tıklama ile `mirrorAngle` 0↔1 (isFixed kontrolü)
- [ ] Lazer trace algoritmasını implement et (BFS, visited set)
- [ ] Lazer ışını animasyonu (trace sonucunu render et)
- [ ] "Lazeri Ateşle" butonu → trace + kazanma/kaybetme kontrolü
- [ ] Can sistemi: yanlış → lives--, lives==0 → Game Over
- [ ] Level listesi ekranı (scroll, pagination, durum ikonları)
- [ ] Level tamamlandığında → saveLaserPuzzleProgress çağır
- [ ] Portal renklendirmesi (pairId'ye göre)
- [ ] Fixed mirror UI (kilit ikonu)
- [ ] Splitter render (varsa — level 151+)
- [ ] Bomba patlama animasyonu (varsa — level 101+)
