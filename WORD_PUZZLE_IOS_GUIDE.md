# Word Puzzle API — iOS Integration Guide

## Base URL
```
https://us-central1-mini-games-9a4e1.cloudfunctions.net
```

## Oyun Mantığı
- Wordle tarzı kelime tahmin oyunu
- Her levelde **1 kelime**, **5 tahmin hakkı**
- Harf renkleri: **yeşil** (doğru yerde), **sarı** (kelimede var ama yanlış yerde), **siyah** (kelimede yok)
- Her kullanıcıya **rastgele** kelime atanır (aynı levelde farklı kelimeler)
- Toplam **235 level**, kelime uzunluğu kademeli artar

### Level Dağılımı
| Level | Harf | Zorluk |
|---|---|---|
| 1–15 | 3 harf | Easy |
| 16–55 | 4 harf | Medium |
| 56–115 | 5 harf | Hard |
| 116–175 | 6 harf | Expert |
| 176–215 | 7 harf | Master |
| 216–235 | 8 harf | Grandmaster |

---

## Endpoints

### 1. Level Başlat — `GET /getWordPuzzleLevel`

Level bilgisini döner. İlk çağrıda rastgele kelime atar, tekrar çağrılırsa mevcut session'ı döner.

```
GET /getWordPuzzleLevel?level=1&deviceId=DEVICE-UUID
```

```json
{
  "success": true,
  "level": {
    "levelNumber": 1,
    "wordLength": 3,
    "difficulty": "easy",
    "maxGuesses": 5
  },
  "session": {
    "guesses": [],
    "attemptsUsed": 0,
    "solved": false,
    "failed": false
  }
}
```

> Kelime client'a gönderilmez! Backend'de gizli kalır.

---

### 2. Tahmin Gönder — `POST /checkWordPuzzleGuess`

```json
// Request
{
  "deviceId": "DEVICE-UUID",
  "levelNumber": 1,
  "guess": "CAT"
}
```

```json
// Response
{
  "success": true,
  "result": [
    { "letter": "C", "status": "absent" },
    { "letter": "A", "status": "present" },
    { "letter": "T", "status": "correct" }
  ],
  "attemptsUsed": 1,
  "maxAttempts": 5,
  "solved": false,
  "failed": false
}
```

| Status | Renk | Anlam |
|---|---|---|
| `correct` | 🟩 Yeşil | Harf doğru yerde |
| `present` | 🟨 Sarı | Harf kelimede var ama yanlış yerde |
| `absent` | ⬛ Siyah | Harf kelimede yok |

- Çözülünce veya haklar bitince `answer` field'ı eklenir
- `solved: true` → level geçildi
- `failed: true` → 5 hak bitti, level kaybedildi

---

### 3. Level Sıfırla — `POST /resetWordPuzzleSession`

Kaybedilen leveli tekrar denemek için. Yeni rastgele kelime atanır.

```json
{ "deviceId": "DEVICE-UUID", "levelNumber": 1 }
```

---

## iOS Oyun Akışı

```
1. Oyun Açıldı
   └─ GET /getWordPuzzleLevel?level={currentLevel}&deviceId=xxx
        └─ wordLength ve session bilgisi gelir
        └─ Eğer session.guesses varsa → önceki tahminleri göster

2. Kullanıcı Tahmin Yaptı
   └─ POST /checkWordPuzzleGuess { deviceId, levelNumber, guess }
        └─ result[] → her harf için renk bilgisi
        └─ solved=true → tebrik ekranı, sonraki levele geç
        └─ failed=true → kelimeyi göster, retry butonu

3. Level Geçildi
   └─ POST /saveGameProgress → gameProgress kaydı (kaldığı level)
   └─ Sonraki level'a geç

4. Level Kaybedildi
   └─ Retry → POST /resetWordPuzzleSession (yeni kelime atanır)
   └─ GET /getWordPuzzleLevel tekrar çağrılır
```

### Klavye
- Alt kısımda A-Z harf butonları
- Kullanılan harfler renklendirilir (tüm tahminlerden biriktir):
  - Yeşil: kesin doğru
  - Sarı: kelimede var
  - Koyu gri: kelimede yok
