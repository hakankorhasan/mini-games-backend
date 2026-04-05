# Arrow Puzzle — iOS Geliştirme Rehberi (v6)

## 1. API Yanıt Yapısı

```json
{
  "levelNumber": 250,
  "gameType": ".pathClearing",
  "difficulty": "hard",
  "difficultyScore": 72,
  "grid": { "cols": 24, "rows": 24 },
  "shapeName": "heart",
  "activeCells": [
    { "x": 5, "y": 2 },
    { "x": 6, "y": 2 },
    ...
  ],
  "streams": [
    {
      "id": "stream-1",
      "label": "Stream 1",
      "color": "#29ECFF",
      "direction": "right",
      "cells": [{ "x": 3, "y": 5 }, { "x": 4, "y": 5 }, { "x": 5, "y": 5 }]
    }
  ],
  "solution": ["stream-11", "stream-10", ..., "stream-1"]
}
```

**Yeni alanlar (v6):**
| Alan | Tip | Açıklama |
|---|---|---|
| `activeCells` | `[{x,y}]` | Aktif (çizilebilir) hücreler — şekli tanımlar |
| `shapeName` | `String` | Şekil adı: `diamond`, `circle`, `heart`, `star`, `hexagon`, `cross`, `triangleUp`, `triangleDown`, `hourglass`, `arrowRight`, `donut` |

---

## 2. Şekil Sistemi — activeCells

`activeCells`, oyun alanındaki **sadece çizilebilen hücreleri** listeler.  
`grid` ise bounding box'ı verir (koordinat sistemi için referans).

### ⚠️ Kritik Kural
- `activeCells`'e **dahil olmayan** hücreler **render edilmemelidir** (saydam/boş bırak).
- `activeCells` genelde grid'den çok daha az hücre içerir (diamond'da ~%60, star'da ~%50 vb.).
- `streams[].cells` daima `activeCells` içindedir.

### Hızlı Set'e Çevirme (Swift)
```swift
let activeCellSet: Set<String> = Set(
    level.activeCells.map { "\($0.x),\($0.y)" }
)

func isActive(_ x: Int, _ y: Int) -> Bool {
    activeCellSet.contains("\(x),\(y)")
}
```

---

## 3. Responsive Grid — Hücre Boyutu Hesaplama

### Zorluk Tablo

| Seviye | Shape | Grid | Active | Streams | Beklenen hücre boyutu |
|---|---|---|---|---|---|
| 1-5 | diamond | 9×9 | ~41 | 3-5 | 40-50 pt |
| 6-30 | heart, star... | 13×13 | ~88 | 5-8 | 28-36 pt |
| 31-100 | çeşitli | 18×18 | ~170 | 8-14 | 20-26 pt |
| 101-250 | çeşitli | 24×24 | ~300 | 10-18 | 16-20 pt |
| 251-400 | çeşitli | 30×30 | ~500 | 16-23 | 12-16 pt |
| 401-500 | çeşitli | 35×35 | ~700 | 22-31 | 10-13 pt |

### Hesaplama Formülü (Swift)

```swift
func computeCellSize(grid: Grid, safeArea: CGSize) -> CGFloat {
    // Kullanılabilir alan (padding çıkartılmış)
    let padding: CGFloat = 24
    let availableWidth  = safeArea.width  - padding * 2
    let availableHeight = safeArea.height - padding * 2 - 120 // üst bar için alan

    // Grid cols/rows bazlı
    let cellW = availableWidth  / CGFloat(grid.cols)
    let cellH = availableHeight / CGFloat(grid.rows)
    
    // Her zaman küçük olanı kullan (kare grid)
    let raw = min(cellW, cellH)
    
    // Min/Max limitler
    return max(8, min(raw, 52))
}
```

### Dinamik Zoom Desteği (isteğe bağlı)

Büyük levellarda (col > 20) kullanıcıya pinch-to-zoom ver:

```swift
// Min scale: aktif hücre alanı ekrana sığsın
// Max scale: 1.5x
let minScale = max(0.4, availableWidth / (CGFloat(grid.cols) * baseCellSize))

MagnificationGesture()
    .onChanged { value in
        scale = min(1.5, max(minScale, baseScale * value))
    }
```

---

## 4. Grid Render Algoritması

```swift
var body: some View {
    let cellSize = computeCellSize(grid: level.grid, safeArea: geometry.size)
    
    Canvas { context, size in
        for y in 0..<level.grid.rows {
            for x in 0..<level.grid.cols {
                guard isActive(x, y) else { continue } // Şekil dışı hücre → atla
                
                let rect = CGRect(
                    x: CGFloat(x) * cellSize,
                    y: CGFloat(y) * cellSize,
                    width: cellSize,
                    height: cellSize
                )
                
                // Arka plan (sadece aktif hücreler)
                context.fill(
                    Path(rect.insetBy(dx: 0.5, dy: 0.5)),
                    with: .color(Color(.systemGray6).opacity(0.3))
                )
            }
        }
        
        // Stream'leri çiz
        for stream in level.streams {
            drawStream(context: context, stream: stream, cellSize: cellSize)
        }
    }
}
```

---

## 5. Stream Çizimi

### Hücre başına ok yönü hesaplama

Her hücrenin okun nereye baktığını bilmek için:
- Son hücre (`cells.last!`) = **baş** → `stream.direction` yönüne bakan ok
- Diğer hücreler → **bir sonraki hücreye doğru** ok

```swift
func arrowDirection(for index: Int, in cells: [Cell], headDir: Direction) -> Direction {
    if index == cells.count - 1 {
        return headDir // Baş hücre
    }
    let current = cells[index]
    let next    = cells[index + 1]
    let dx = next.x - current.x
    let dy = next.y - current.y
    if dx > 0 { return .right }
    if dx < 0 { return .left }
    if dy > 0 { return .down }
    return .up
}
```

### Ok boyutu — cellSize'a göre

```swift
// Küçük hücrelerde ok boyutu düşür
let arrowHeadSize: CGFloat = max(4, cellSize * 0.35)
let strokeWidth:   CGFloat = max(1.5, cellSize * 0.12)
let cornerRadius:  CGFloat = max(2, cellSize * 0.20)
```

---

## 6. Renk Paleti (30 renk, v6)

Tüm bu renkler artık kullanılıyor. Renk map'ini güncellemeyi unutma:

```swift
static let streamColors: [String: Color] = [
    // Öncekiler (v5'ten gelen)
    "#29ECFF": Color(hex: "29ECFF"), // Cyan
    "#FF54DD": Color(hex: "FF54DD"), // Magenta
    "#B8FF4E": Color(hex: "B8FF4E"), // Lime
    "#FF8C3B": Color(hex: "FF8C3B"), // Orange
    "#9E5CFF": Color(hex: "9E5CFF"), // Violet
    "#FFE34D": Color(hex: "FFE34D"), // Yellow
    "#52FFBF": Color(hex: "52FFBF"), // Mint
    "#FF6F61": Color(hex: "FF6F61"), // Coral
    "#FF3366": Color(hex: "FF3366"), // Red
    "#00C9FF": Color(hex: "00C9FF"), // Sky Blue
    "#AAFF00": Color(hex: "AAFF00"), // Chartreuse
    "#FF00FF": Color(hex: "FF00FF"), // Fuchsia
    "#FF9900": Color(hex: "FF9900"), // Amber
    "#00FF99": Color(hex: "00FF99"), // Spring Green
    "#FF6B9D": Color(hex: "FF6B9D"), // Hot Pink
    "#06D6A0": Color(hex: "06D6A0"), // Emerald
    "#118AB2": Color(hex: "118AB2"), // Cerulean
    "#EF476F": Color(hex: "EF476F"), // Crimson
    "#FFD166": Color(hex: "FFD166"), // Golden
    "#7400B8": Color(hex: "7400B8"), // Deep Purple
    "#80B918": Color(hex: "80B918"), // Olive
    "#0077B6": Color(hex: "0077B6"), // Ocean Blue
    "#F18F01": Color(hex: "F18F01"), // Tangerine
    "#C77DFF": Color(hex: "C77DFF"), // Lavender
    // Yeni (v6)
    "#E63946": Color(hex: "E63946"), // Imperial Red
    "#457B9D": Color(hex: "457B9D"), // Steel Blue
    "#2A9D8F": Color(hex: "2A9D8F"), // Persian Green
    "#E9C46A": Color(hex: "E9C46A"), // Saffron
    "#F4A261": Color(hex: "F4A261"), // Sandy Brown
    "#264653": Color(hex: "264653"), // Charcoal
    // Ek renk
    "#48BFE3": Color(hex: "48BFE3"), // Non-photo Blue
    "#56CFE1": Color(hex: "56CFE1"), // Sky Blue Crayola
    "#72EFDD": Color(hex: "72EFDD"), // Middle Blue Green
    "#5390D9": Color(hex: "5390D9"), // Cornflower Blue
    "#7B2CBF": Color(hex: "7B2CBF"), // Purple
    "#F72585": Color(hex: "F72585"), // Rose
    "#B5179E": Color(hex: "B5179E"), // Byzantine
    "#560BAD": Color(hex: "560BAD"), // Purple 2
    "#480CA8": Color(hex: "480CA8"), // Indigo
    "#3A0CA3": Color(hex: "3A0CA3"), // Persian Blue
    "#3F37C9": Color(hex: "3F37C9"), // Ultramarine Blue
    "#4361EE": Color(hex: "4361EE"), // Royal Blue
    "#4895EF": Color(hex: "4895EF"), // Cornflower Blue 2
    "#4CC9F0": Color(hex: "4CC9F0"), // Sky Blue 2
    "#780000": Color(hex: "780000"), // Blood Red
]
```

---

## 7. Stream Oyun Mekaniği (Değişmedi)

- `cells[last]` = **baş** (head), `cells[0]` = **kuyruk** (tail)
- Kullanıcı bir stream'e tıklayınca, baş yönünde kayar
- Head ray'i (`cells.last` → `direction` boyunca aktif hücreler) başka bir stream'e çarparsa **engellenir**
- Engelsiz stream serbest kayarak ekrandan çıkar
- Tüm stream'ler çıkınca level biter

### Çözüm Sırası (`solution` dizisi)
`solution[0]` = ilk çıkacak stream → `solution.last` = en son çıkacak

---

## 8. Level Sayısı ve Sayfalama

```
Toplam: 500 level
API endpoint: GET /getArrowPuzzleLevels?level={n}
```

Seviye yoksa (501+) `null` döner. Bunu kontrol et.

---

## 9. Performans İpuçları

### activeCells Set Cache
`activeCells`'i her frame hesaplama; level yüklendiğinde bir kez `Set<String>`'e çevir.

```swift
class LevelViewModel: ObservableObject {
    private var activeCellSet: Set<String> = []
    
    func loadLevel(_ level: ArrowPuzzleLevel) {
        activeCellSet = Set(level.activeCells.map { "\($0.x),\($0.y)" })
    }
    
    func isActive(_ x: Int, _ y: Int) -> Bool {
        activeCellSet.contains("\(x),\(y)")
    }
}
```

### Canvas vs SwiftUI Views
- 500+ hücre varsa `Canvas` kullan, `ZStack/ForEach` kullanma
- `Canvas` 10x daha hızlı render eder

### Scroll/Zoom için GeometryReader
```swift
GeometryReader { geo in
    ScrollView([.horizontal, .vertical]) {
        gameCanvas
            .frame(
                width:  CGFloat(grid.cols) * cellSize * scale,
                height: CGFloat(grid.rows) * cellSize * scale
            )
            .scaleEffect(scale, anchor: .topLeading)
    }
}
```

---

## 10. Önemli Değişiklikler Özeti (v5 → v6)

| Konu | Eski (v5) | Yeni (v6) |
|---|---|---|
| Level sayısı | 1000 | **500** |
| Grid boyutu | 13×13 - 18×18 | **9×9 - 35×35** |
| Grid şekli | Her zaman dikdörtgen | **11 farklı şekil** |
| Aktif hücre bilgisi | Yoktu | **`activeCells` array** |
| Şekil adı | Yoktu | **`shapeName` string** |
| Max stream | 18 | **31+** |
| Renk paleti | 24 renk | **44 renk** |
