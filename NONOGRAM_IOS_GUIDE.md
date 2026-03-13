# 🦕 Nonogram (Pixel Excavation) — iOS Entegrasyon Rehberi

## Genel Bakış

Nonogram oyunu artık **backend-driven sonsuz level sistemi** kullanıyor. Eski 5 sabit zorluk seviyesi kaldırıldı. Level'lar backend'de üretilip Firestore'da saklanıyor, kullanıcı sırayla ilerliyor.

---

## 1. Mimari Özet

```
┌─────────────┐         ┌──────────────────┐         ┌───────────┐
│  iOS Client │ ──GET── │  Cloud Functions  │ ──R/W── │ Firestore │
│             │ ──POST─ │                   │         │           │
└─────────────┘         └──────────────────┘         └───────────┘

Firestore Collections:
├── nonogramLevels/level_1, level_2, ...   (puzzle verileri)
└── nonogramProgress/{deviceId}            (kullanıcı ilerlemesi)
    └── levelStats/level_1, level_2, ...   (per-level istatistikler)
```

---

## 2. API Endpoints

### 2.1 Level Listesi (Level Seçim Ekranı)

```
GET /getNonogramLevels?page=1&pageSize=20
```

**Response:**
```json
{
  "success": true,
  "page": 1,
  "pageSize": 20,
  "totalLevels": 200,
  "totalPages": 10,
  "levels": [
    { "levelNumber": 1, "gridSize": 5, "fillFraction": 0.5 },
    { "levelNumber": 2, "gridSize": 5, "fillFraction": 0.49 },
    ...
  ]
}
```

> **Not:** Bu endpoint solution döndürmez — sadece level listesi için kullanılır.

---

### 2.2 Tek Level Getir (Oyun Başlatma)

```
GET /getNonogramLevels?level=5
```

**Response:**
```json
{
  "success": true,
  "level": {
    "levelNumber": 5,
    "gridSize": 5,
    "fillFraction": 0.48,
    "solution": [[true, false, true, false, false], ...],
    "rowClues": [[1, 1], [3], [0], [2, 1], [1]],
    "colClues": [[2], [1, 1], [1], [1, 1], [3]]
  }
}
```

---

### 2.3 İlerleme Kaydet (Level Tamamlandıktan Sonra)

```
POST /saveNonogramProgress
Content-Type: application/json

{
  "deviceId": "ABCD-1234-...",
  "levelNumber": 5,
  "timeSpent": 45.2,
  "moveCount": 18
}
```

**Response:**
```json
{ "success": true }
```

---

### 2.4 İlerleme Getir (Uygulama Açılışı)

```
GET /getNonogramProgress?deviceId=ABCD-1234-...
```

**Response:**
```json
{
  "success": true,
  "progress": {
    "currentLevel": 6,
    "completedLevels": [1, 2, 3, 4, 5],
    "levelStats": [
      { "levelNumber": 1, "timeSpent": 23.5, "moveCount": 12, "completedAt": "..." },
      { "levelNumber": 2, "timeSpent": 31.0, "moveCount": 15, "completedAt": "..." },
      ...
    ]
  }
}
```

> İlk kez oynayan kullanıcı için `currentLevel: 1`, `completedLevels: []` döner.

---

## 3. iOS Tarafı Modeller

### 3.1 Level Model

```swift
struct NonogramLevel: Codable {
    let levelNumber: Int
    let gridSize: Int
    let fillFraction: Double
    let solution: [[Bool]]
    let rowClues: [[Int]]
    let colClues: [[Int]]
}
```

### 3.2 Level Listesi (Hafif Model)

```swift
struct NonogramLevelSummary: Codable {
    let levelNumber: Int
    let gridSize: Int
    let fillFraction: Double
}
```

### 3.3 Progress Model

```swift
struct NonogramProgress: Codable {
    let currentLevel: Int
    let completedLevels: [Int]
    let levelStats: [NonogramLevelStat]
}

struct NonogramLevelStat: Codable {
    let levelNumber: Int
    let timeSpent: Double
    let moveCount: Int
}
```

---

## 4. iOS Akış Diyagramı

```
[Uygulama Açılır]
       │
       ▼
[getNonogramProgress → currentLevel, completedLevels]
       │
       ▼
[getNonogramLevels?page=1 → Level listesi göster]
       │
       ├── Level durumları:
       │   ✅ completedLevels'da varsa → Tamamlanmış
       │   🔓 currentLevel ise → Açık (oynanabilir)
       │   🔒 currentLevel'dan büyükse → Kilitli
       │
       ▼
[Kullanıcı açık/tamamlanmış level'a tıklar]
       │
       ▼
[getNonogramLevels?level=N → Full puzzle verisi]
       │
       ▼
[NonogramGrid'i backend solution ile oluştur]
       │  ← Client artık puzzle üretmiyor!
       │  ← solution, rowClues, colClues backend'den geliyor
       │
       ▼
[Oyuncu çözer → Kazanma kontrolü]
       │
       ▼
[saveNonogramProgress → levelNumber, timeSpent, moveCount]
       │
       ▼
[Sonraki level açılır → currentLevel + 1]
```

---

## 5. Kaldırılması Gerekenler (iOS)

| Dosya/Bileşen | Aksiyon |
|----------------|---------|
| `NonogramDifficulty.swift` | **Sil** — artık zorluk enum'u yok |
| `NonogramGrid` puzzle üretim kodu | **Kaldır** — `generatePuzzle()` vs. artık backend'de |
| Classic mode zorluk seçim ekranı | **Değiştir** → Level listesi ekranı |
| Client-side `fillFraction` hesaplama | **Kaldır** — backend sağlıyor |

---

## 6. NonogramGrid Değişiklikleri

### Eski (Client-Side Generation):
```swift
// ❌ KALDIR
func generatePuzzle(gridSize: Int, fillFraction: Double) { ... }
```

### Yeni (Backend-Driven):
```swift
// ✅ EKLE — Backend'den gelen level ile grid oluştur
init(from level: NonogramLevel) {
    self.gridSize = level.gridSize
    self.rowClues = level.rowClues
    self.colClues = level.colClues
    
    // Solution'dan hücreleri oluştur
    self.cells = level.solution.enumerated().flatMap { (r, row) in
        row.enumerated().map { (c, isSolution) in
            NonogramCell(row: r, col: c, state: .empty, isSolution: isSolution)
        }
    }
}
```

### Kazanma Kontrolü (Değişmez):
```swift
// Aynı kalır — filled hücreler solution ile eşleşiyor mu?
func checkWin() -> Bool {
    cells.allSatisfy { cell in
        if cell.isSolution {
            return cell.state == .filled
        } else {
            return cell.state != .filled
        }
    }
}
```

---

## 7. Level Listesi UI Örneği

```swift
struct NonogramLevelListView: View {
    @State private var levels: [NonogramLevelSummary] = []
    @State private var progress: NonogramProgress?
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(levels, id: \.levelNumber) { level in
                    let status = levelStatus(level.levelNumber)
                    
                    HStack {
                        // Status icon
                        statusIcon(status)
                        
                        // Level info
                        VStack(alignment: .leading) {
                            Text("Level \(level.levelNumber)")
                                .font(.headline)
                            Text("\(level.gridSize)×\(level.gridSize)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        // Stat (eğer tamamlanmışsa)
                        if let stat = progress?.levelStats
                            .first(where: { $0.levelNumber == level.levelNumber }) {
                            Text("\(Int(stat.timeSpent))s")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .opacity(status == .locked ? 0.5 : 1.0)
                    .disabled(status == .locked)
                }
            }
        }
    }
    
    enum LevelStatus { case completed, current, locked }
    
    func levelStatus(_ levelNumber: Int) -> LevelStatus {
        guard let progress = progress else { return levelNumber == 1 ? .current : .locked }
        if progress.completedLevels.contains(levelNumber) { return .completed }
        if levelNumber == progress.currentLevel { return .current }
        return .locked
    }
}
```

---

## 8. Zorluk Skalası

| Level Aralığı | Grid | Fill Oranı | Tahmini Süre |
|---------------|------|-----------|-------------|
| 1–10 | 5×5 | %50–45 | 30s–1dk |
| 11–25 | 6×6 | %48–42 | 1–2dk |
| 26–50 | 7×7 | %45–40 | 2–3dk |
| 51–80 | 8×8 | %42–38 | 3–5dk |
| 81–120 | 9×9 | %40–35 | 5–8dk |
| 121+ | 10×10 | %38–32 | 8–15dk |

---

## 9. Backend'i Hazırlama (Deploy)

```bash
# 1. Deploy
cd functions && firebase deploy --only functions

# 2. İlk 200 level'ı üret
curl "https://<region>-<project>.cloudfunctions.net/seedNonogramLevels?count=200&startFrom=1"

# 3. Sonra daha fazla ekleyebilirsin
curl "https://<region>-<project>.cloudfunctions.net/seedNonogramLevels?count=200&startFrom=201"
```

> **Önemli:** `seedNonogramLevels` deterministic — aynı level numarası her zaman aynı puzzle'ı üretir. Tekrar çağırmak mevcut level'ları güvenle üzerine yazar.

---

## 10. Firestore Yapısı

```
nonogramLevels/
├── level_1   { levelNumber: 1, gridSize: 5, fillFraction: 0.50, solution: [...], rowClues: [...], colClues: [...] }
├── level_2   { levelNumber: 2, gridSize: 5, fillFraction: 0.49, ... }
├── level_3   { ... }
└── ...

nonogramProgress/{deviceId}
├── currentLevel: 6
├── completedLevels: [1, 2, 3, 4, 5]
├── updatedAt: <timestamp>
└── levelStats/
    ├── level_1  { levelNumber: 1, timeSpent: 23.5, moveCount: 12, completedAt: <timestamp> }
    ├── level_2  { levelNumber: 2, timeSpent: 31.0, moveCount: 15, completedAt: <timestamp> }
    └── ...
```

---

## 11. Checklist — iOS Tarafı Yapılacaklar

- [ ] `NonogramDifficulty.swift` dosyasını sil
- [ ] `NonogramLevel`, `NonogramLevelSummary`, `NonogramProgress` modellerini ekle
- [ ] API service: `getNonogramLevels`, `getNonogramProgress`, `saveNonogramProgress`
- [ ] `NonogramGrid.init(from: NonogramLevel)` — backend level'dan grid oluştur
- [ ] Client-side puzzle generation kodunu kaldır
- [ ] Level listesi ekranı yaz (scroll, pagination, durum ikonları)
- [ ] Oyun tamamlandığında `saveNonogramProgress` çağır
- [ ] Classic mode ekranını backend level sistemiyle güncelle
