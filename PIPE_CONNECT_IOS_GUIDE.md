# Pipe Connect API — iOS Integration Guide

## Base URL
```
https://us-central1-mini-games-9a4e1.cloudfunctions.net
```

## Toplam 250 Level

| Tier | Levels | Grid | Can | Pipes | Trap | Wall | Locked | Özellik |
|---|---|---|---|---|---|---|---|---|
| Tutorial | 1–15 | 4×4 | 5 | straight, elbow | 0% | 0% | 0 | Center source/sink |
| Beginner | 16–40 | 5×5 | 5 | straight, elbow | 0% | 0% | 0 | — |
| Easy | 41–80 | 5×5 | 4 | +tPipe | 10% | 0% | 0 | Variable source/sink |
| Medium | 81–130 | 6×6 | 4 | +cross | 20% | 5% | 0 | Cross + wall |
| Hard | 131–180 | 7×7 | 3 | all | 30% | 10% | 1–2 | **Locked pipes** |
| Expert | 181–220 | 8×8 | 2 | all | 40% | 15% | 2–3 | Yoğun trap |
| Master | 221–250 | 9×9 | 2 | all | 50% | 18% | 3–4 | Max zorluk |

---

## Endpoints

### 1. Tek Level Getir — `GET /getPipeConnectLevels?level=5`

```json
{
  "success": true,
  "level": {
    "levelNumber": 5,
    "gridSize": 4,
    "lives": 5,
    "difficulty": "tutorial",
    "sourceRow": 2,
    "sourceCol": 0,
    "sinkRow": 2,
    "sinkCol": 3,
    "sourceDirection": "left",
    "sinkDirection": "right",
    "cells": [
      {
        "row": 0, "col": 0,
        "pipeType": "straight",
        "rotation": 2,
        "isBlocked": false,
        "isSource": false,
        "isSink": false,
        "isLocked": false
      }
    ],
    "solution": {
      "path": [[2,0], [2,1], [2,2], [2,3]],
      "correctRotations": { "2,0": 0, "2,1": 0, "2,2": 0, "2,3": 0 }
    }
  }
}
```

### 2. Level Listesi — `GET /getPipeConnectLevels?page=1&pageSize=20`

```json
{
  "success": true,
  "page": 1,
  "pageSize": 20,
  "totalLevels": 250,
  "totalPages": 13,
  "levels": [
    { "levelNumber": 1, "gridSize": 4, "difficulty": "tutorial", "lives": 5 }
  ]
}
```

---

## Yeni Mekanikler

### Locked Pipes (Level 131+)
- `isLocked: true` olan hücreler zaten **doğru rotasyonda** gelir
- Kullanıcı bu hücrelere **tıklayamaz**, döndüremez
- Yeşil kilit ikonu ile gösterilebilir
- İpucu niteliğinde: çözümün bir parçası

### Variable Source/Sink (Level 41+)
- Source ve sink artık her zaman merkezde değil
- `sourceDirection` → su hangi yönden giriyor (`left`, `up`)
- `sinkDirection` → su hangi yönden çıkıyor (`right`, `down`)
- Source/sink oklari dinamik pozisyonlanmalı

### Blocked Cells (Level 81+)
- `isBlocked: true` → hücre tamamen kapalı, boru yok
- X işareti veya duvar görseli gösterilir

---

## iOS Tarafında Güncellenecekler

### 1. PipeGrid Initialization
```
- sourceRow, sourceCol → API'den
- sinkRow, sinkCol → API'den
- sourceDirection, sinkDirection → yeni parametreler
```

### 2. PipeCell Model'e `isLocked` Ekle
```swift
struct PipeCell {
    // ... existing fields ...
    var isLocked: Bool = false  // YENİ
}
```

### 3. flowWater() Güncelle
```
- Su giriş yönünü sourceDirection'dan al (hardcoded .left yerine)
- Su çıkış yönünü sinkDirection'dan al (hardcoded .right yerine)
```

### 4. View Güncellemeleri
```
- Source/sink ok pozisyonlarini sourceRow/Col ve sinkRow/Col'a göre hesapla
- isLocked hücrelere tıklamayı engelle (tap gesture disable)
- isLocked hücrelere kilit ikonu overlay ekle
- isBlocked hücrelere X veya duvar görseli
```

### 5. Level Seçim Ekranı
```
- getPipeConnectLevels?page=N&pageSize=20 ile sayfalı level list çek
- Grid boyutu ve zorluk bilgisini göster
```

---

## Oyun Akışı

```
1. Level Seçim
   └─ GET /getPipeConnectLevels?page=1&pageSize=20
   └─ Listeyi göster (levelNumber, gridSize, difficulty, lives)

2. Oyuna Başla
   └─ GET /getPipeConnectLevels?level=N
   └─ cells → grid'i oluştur
   └─ isLocked → kilitli hücreleri işaretle
   └─ isBlocked → duvar hücreleri işaretle

3. Oynama
   └─ Kullanıcı kilitli olmayan boruları döndürür
   └─ "Suyu Akıt" → flowWater() (sourceDirection'dan başla)

4. Kazandı
   └─ POST /saveGameProgress (currentLevel + 1)
   └─ POST /submitGameResult (skor hesapla)

5. Kaybetti
   └─ Can düşür, tekrar dene veya pes et
```

## Pipe Types Reference

| Type | Rot 0 | Rot 1 | Rot 2 | Rot 3 |
|---|---|---|---|---|
| straight | ←→ | ↑↓ | ←→ | ↑↓ |
| elbow | ↑→ | →↓ | ↓← | ←↑ |
| tPipe | ↑←→ | ↑→↓ | ↓←→ | ↑↓← |
| cross | ↑↓←→ | ↑↓←→ | ↑↓←→ | ↑↓←→ |
