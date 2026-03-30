# Word Puzzle Güncellemeleri - iOS Entegrasyon Notları

## 1. Hint (İpucu) Limitleri ve Kalıcılığı (Persist)
Word Puzzle'da alınan ipuçları artık cihazda değil, **veritabanında (session) tutulmaktadır**. Böylece oyundan çıkıp girilse dahi ilgili seviyede alınan ipuçları kaybolmaz.

- **Maksimum İpucu:** Her seviyedeki maksimum ipucu sayısı artık **kelimenin harf sayısı kadardır** (`maxHints = wordLength`). Yani 5 harfli bir kelime için maksimum 5 ipucu alınabilir. 
- **DB Kaydı:** Alınan ipuçlarına ait harf ve lokasyon bilgileri, DB'de ve API yanıtlarında `hints` objesi altında bir liste (array) olarak tutuluyor.

### `getWordPuzzleLevel` Endpoint Yanıtı:
Oyuna devam eden (ve önceden ipucu almış) bir kullanıcı için API yanıtındaki `session` bölümü şu şekilde dönecektir:

```json
{
  "success": true,
  "level": {
    "levelNumber": 10,
    "wordLength": 5,
    ...
  },
  "session": {
    "guesses": [...],
    "hintsUsed": 2,          // Kullanılan toplam hint sayısı
    "hints": [               // O ana kadar alınmış Hint'ler listesi!
      {
        "position": 1,
        "letter": "A"
      },
      {
        "position": 4,
        "letter": "K"
      }
    ],
    ...
  }
}
```
**iOS tarafı aksiyon:** `getWordPuzzleLevel` ile oyunu yüklerken `session.hints` içerisindeki harfleri ilgili pozisyonlara yeşil (veya hint rengi) olarak yerleştirmelisiniz.

---

## 2. Puanlama (Skor) Çarpanı ve Hint Cezası 
(Reklam izleyip ipucu alanla, almayan arasındaki fark)

Bir oyuncu seviyeyi bitirdiğinde skoru arka planda hesaplanmaktadır. İpucu ("Hint") kullanan kişilerin global skorlarında ipucu sayısına ve oyunun zorluğuna (kelimenin uzunluğuna) orantılı bir puan kırılması (ceza) uygulanacaktır.
Eğer hiç reklam/ipucu kullanılmadan çözülürse kullanıcı %100 (%0 ceza) puan alırken, bütün ipuçları kullanılarak çözülürse alabileceği en düşük puan (taban puan = %20) verilir. Bu ceza, seviye zorluğuna göre orantılı olarak artar/azalır.

**iOS tarafı aksiyon:**
Kullanıcı oyunu bitirdiğinde her zamanki gibi `/submitGameResult` endpointi'ne gönderdiğiniz payload içerisine **o bölümde kullandığı veya o ana kadar alınmış toplam hint bilgisini** (`hintsUsed`) sayısını eklemeniz gerekiyor:

```swift
// /submitGameResult API İsteği
let requestPayload: [String: Any] = [
    "deviceId": "ABC-DEF...",
    "gameId": "wordPuzzle",
    "level": 10,
    "difficulty": 5,        // Or level'in word length'i
    "correct": true,
    "responseTime": 45,     // Çözüm süresi saniye bazlı
    "isStoryMode": false,
    "hintsUsed": 2          // EKLENEN YENİ ALAN!
]
```

Yukarıdaki yapıları iOS tarafında modele entegre etmeniz yeterli olacaktır. Backend tarafında skor kırılması ve Hint verilerinin `session` içinde listelenmesi başarıyla aktifleştirildi.
