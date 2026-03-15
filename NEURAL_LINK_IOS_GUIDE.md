# Neural Link — iOS Entegrasyon Rehberi

## Endpoints

### Level Çekme
```
GET https://us-central1-mini-games-9a4e1.cloudfunctions.net/getNeuralLinkLevels?level=1
```

**Response:**
```json
{
  "success": true,
  "level": {
    "levelNumber": 1,
    "gridSize": 5,
    "flowCount": 3,
    "deadNeuronCount": 1,
    "difficulty": "beginner",
    "difficultyValue": 1,
    "endpoints": [[[0,0],[3,4]], [[1,2],[4,1]], [[2,3],[4,4]]],
    "deadCells": [[2,0]],
    "solution": [[[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[2,4],[3,4]], ...]
  }
}
```

### Level Listesi
```
GET .../getNeuralLinkLevels?page=1&pageSize=20
```

## Zorluk Seviyeleri (500 Level)

Her tier içinde zorluk yavaş yavaş artar (flow sayısı, dead neuron, path karmaşıklığı).

| Levels | Grid | Flows | Dead | dV |
|--------|------|:---:|:---:|:---:|
| 1–30 | 5×5 | 3→4 | 1→3 | 1-2 |
| 31–60 | 5×5 | 4 | 2→4 | 2-3 |
| 61–100 | 6×6 | 4→5 | 2→5 | 3-4 |
| 101–150 | 6×6 | 5→6 | 3→5 | 4-5 |
| 151–200 | 7×7 | 5→6 | 3→6 | 5-6 |
| 201–260 | 7×7 | 6→7 | 4→7 | 6-7 |
| 261–330 | 8×8 | 6→7 | 3→6 | 7-8 |
| 331–400 | 8×8 | 7→8 | 4→7 | 8-9 |
| 401–450 | 9×9 | 7→8 | 5→8 | 9-10 |
| 451–500 | 10×10 | 8→9 | 6→9 | 10 |

## iOS Yapılacaklar

1. **Model**: `NeuralLinkLevel` struct — `endpoints`, `deadCells`, `solution`
2. **Dead neuronlar level 1'den itibaren var** — her zaman render et
3. **Renk**: `flowIndex % 8` → cyan, magenta, neon green, orange, purple, gold, teal, coral
4. **Kazanma**: Tüm non-dead hücreler dolu + her flow endpoint bağlı
5. **Score**: `submitGameResult` ile `difficultyValue` (1-10)
