# Slitherlink — iOS Entegrasyon Rehberi

## Endpoints

### Level Çekme
```
GET https://us-central1-mini-games-9a4e1.cloudfunctions.net/getSlitherlinkLevels?level=1
```

**Response:**
```json
{
  "success": true,
  "level": {
    "levelNumber": 1,
    "gridSize": 4,
    "difficulty": "beginner",
    "difficultyValue": 1,
    "clues": [
      [null, 2, null, 1],
      [3, null, 2, null],
      [null, 1, null, 3],
      [2, null, 1, null]
    ],
    "solution": {
      "horizontal": [[true, true, false, false], ...],
      "vertical": [[true, false, false, false, true], ...]
    }
  }
}
```

### Level Listesi
```
GET .../getSlitherlinkLevels?page=1&pageSize=20
```

**Response:**
```json
{
  "success": true,
  "page": 1,
  "pageSize": 20,
  "totalLevels": 250,
  "totalPages": 13,
  "levels": [
    { "levelNumber": 1, "gridSize": 4, "difficulty": "beginner", "difficultyValue": 1 }
  ]
}
```

## Veri Yapısı

| Field | Tip | Açıklama |
|-------|-----|----------|
| `clues` | `(Int\|null)[][]` | N×N matris. `null` = ipucu yok, `0-3` = kenar sayısı |
| `solution.horizontal` | `bool[][]` | (N+1)×N matris. `true` = bu kenar loop'a ait |
| `solution.vertical` | `bool[][]` | N×(N+1) matris. `true` = bu kenar loop'a ait |

## Zorluk Seviyeleri (250 Level)

| Levels | Grid | Clue% | difficultyValue |
|--------|------|:---:|:---:|
| 1–20 | 4×4 | 70→60% | 1-2 |
| 21–50 | 5×5 | 65→55% | 2-3 |
| 51–90 | 5×5 | 55→45% | 3-5 |
| 91–130 | 6×6 | 55→45% | 5-6 |
| 131–180 | 7×7 | 50→40% | 6-8 |
| 181–220 | 8×8 | 45→35% | 8-9 |
| 221–250 | 10×10 | 40→30% | 9-10 |

## iOS Tarafında Yapılacaklar

1. **API Model**: `SlitherlinkLevel` struct — `clues`, `solution.horizontal`, `solution.vertical` parse et
2. **Level Progression**: `gameProgress` endpoint'i kullanarak level ilerlemesini kaydet
3. **Grid Render**: `clues[r][c]` → hücre ortasındaki sayı, `null` ise boş
4. **Kenar Mapping**: `solution.horizontal[r][c]` ve `solution.vertical[r][c]` — kazanma kontrolü için kullan
5. **Score**: `submitGameResult` ile `difficultyValue` (1-10) gönder
