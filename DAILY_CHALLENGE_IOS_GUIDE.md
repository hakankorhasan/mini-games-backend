# Daily Challenge — iOS Entegrasyon Rehberi

## Genel Bakış

Her gün **10 oyundan shuffle edilerek seçilen 5 puzzle** sunulur. Tüm oyuncular aynı gün aynı 5 oyunu görür. Kullanıcı 5/5 tamamladığında **streak** artar ve **bonus puan** kazanır.

- **Gün sınırı:** UTC 00:00:00
- **Kısmi tamamlama YOK:** Streak yalnızca 5/5 tamamlandığında artır
- **Bonus puanlar** `weightedGlobalScore`'a eklenir (1.5x coefficient)

---

## API Endpoints

### 1. `GET /getDailyChallenge?deviceId=xxx`

Günün 5 puzzle'ını, kullanıcının ilerleme durumunu ve streak bilgisini döner.

**Response:**
```json
{
    "success": true,
    "date": "2026-03-31",
    "puzzles": [
        { "puzzleIndex": 1, "gameId": "wordPuzzle" },
        { "puzzleIndex": 2, "gameId": "numberCircuit" },
        { "puzzleIndex": 3, "gameId": "blockFit" },
        { "puzzleIndex": 4, "gameId": "laserPuzzle" },
        { "puzzleIndex": 5, "gameId": "slitherlink" }
    ],
    "progress": {
        "completedPuzzles": [1, 3],
        "puzzleResults": {
            "1": { "score": 120, "responseTime": 15.2, "correct": true, "gameId": "wordPuzzle" },
            "3": { "score": 85, "responseTime": 22.1, "correct": true, "gameId": "blockFit" }
        },
        "totalScore": 205,
        "allCompleted": false
    },
    "streak": {
        "currentStreak": 7,
        "bestStreak": 15,
        "totalDaysCompleted": 42,
        "totalPuzzlesSolved": 198
    },
    "nextResetIn": 43200
}
```

**Streak display logic:**
- `currentStreak` zaten server tarafında hesaplanır
- Eğer dünkü gün tamamlanmamışsa `currentStreak: 0` döner (streak kırılmış demektir)
- UI'da `currentStreak` doğrudan gösterilebilir

---

### 2. `POST /submitDailyPuzzle`

Bir puzzle sonucu gönderir. 5/5 tamamlandığında otomatik streak güncellenir.

**Request Body:**
```json
{
    "deviceId": "xxx",
    "puzzleIndex": 2,
    "correct": true,
    "responseTime": 18.5,
    "gameId": "numberCircuit",
    "difficulty": 5
}
```

> **ÖNEMLi NOT:** Backend artık rastgele bir zorluk ataması YAPMAZ. Kullanıcı o oyunda mevcutta hangi seviyedeyse o seviyede oynar ve oyun bittiğinde oynadığı bu güncel `difficulty` seviyesini request body içerisine ekleyerek backend'e gönderir. Skor getirisi buna göre hesaplanır.

**Response (devam eden):**
```json
{
    "success": true,
    "puzzleScore": 120,
    "totalDailyScore": 325,
    "completedCount": 3,
    "allCompleted": false,
    "streak": {
        "currentStreak": 7,
        "bestStreak": 15,
        "totalDaysCompleted": 42,
        "totalPuzzlesSolved": 199
    }
}
```

**Response (5/5 tamamlandığında):**
```json
{
    "success": true,
    "puzzleScore": 95,
    "totalDailyScore": 520,
    "completedCount": 5,
    "allCompleted": true,
    "bonusScore": 150,
    "finalScore": 670,
    "streak": {
        "currentStreak": 8,
        "bestStreak": 15,
        "totalDaysCompleted": 43,
        "totalPuzzlesSolved": 203
    }
}
```

**Hata durumu (çift gönderim):**
```json
{
    "success": false,
    "error": "Puzzle 2 already submitted today.",
    "totalDailyScore": 325,
    "completedCount": 3
}
```

---

### 3. `GET /getDailyProgress?deviceId=xxx`

Sadece bugünkü ilerleme durumu.

**Response:**
```json
{
    "success": true,
    "date": "2026-03-31",
    "completedPuzzles": [1, 2, 3],
    "puzzleResults": { ... },
    "totalScore": 325,
    "allCompleted": false
}
```

---

### 4. `GET /getDailyStreak?deviceId=xxx`

Streak istatistikleri.

**Response:**
```json
{
    "success": true,
    "currentStreak": 7,
    "bestStreak": 15,
    "totalDaysCompleted": 42,
    "totalPuzzlesSolved": 198,
    "lastCompletedDate": "2026-03-30",
    "streakAlive": true
}
```

---

## Bonus Puan Tablosu

Oyuncu o günkü 5 görevin tamamını (5/5) çözdüğünde, sistem otomatik olarak aşağıdaki bonusları kazanır. **Bu bonusların tamamı backend tarafından hesaplanır ve doğrudan Firestore'a kaydedilir.** Ayrıca bu puanlar günlük görev katsayısıyla (1.5x) oyuncunun `weightedGlobalScore` değerine kalıcı olarak eklenir.

| Koşul | Bonus |
|--------|-------|
| 5/5 tamamlama (Temel) | **100 Puan** |
| 3+ Günlük Seri | **+25 Puan** ekstra |
| 7+ Günlük Seri | **+50 Puan** ekstra |
| 14+ Günlük Seri | **+100 Puan** ekstra |
| 30+ Günlük Seri | **+150 Puan** ekstra |

> **Not:** Bonuslar kümülatif DEĞİLDİR. Yalnızca bulunduğunuz serinin en yüksek eşiği temele eklenir. Örneğin 8 günlük serisi olan bir oyuncu, 5 görevi tamamladığında (100 Temel + 50 Ekstra) toplam 150 bonus puan kazanır. Backend'e kalıcı olarak işlenir.

---

## iOS Countdown Timer Implementasyonu

```swift
// nextResetIn değerini kullanarak geri sayım
func startDailyCountdown(nextResetIn: Int) {
    var remaining = nextResetIn
    
    Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
        remaining -= 1
        if remaining <= 0 {
            timer.invalidate()
            // Yeni günün puzzle'larını fetch et
            fetchDailyChallenge()
            return
        }
        
        let hours = remaining / 3600
        let minutes = (remaining % 3600) / 60
        let seconds = remaining % 60
        
        let timeString = String(format: "%02d:%02d:%02d", hours, minutes, seconds)
        // UI güncelle: "Yeni puzzle'lar: 05:23:41"
        updateCountdownLabel(timeString)
    }
}
```

---

## Önerilen UI Flow

1. **Ana ekran** → "Daily Challenge" butonuna bastığında:
   - `getDailyChallenge` çağır
   - 5 puzzle kartını göster (tamamlanan yeşil ✅, bekleyen gri)
   - Streak badge göster
   - Countdown timer göster

2. **Puzzle'a tıklayınca:**
   - İlgili oyunun view'ını aç (gameId'ye göre)
   - Oyun bitince normal `submitGameResult` yerine `submitDailyPuzzle` çağır
   - Sonucu Daily Challenge ekranında güncelle

3. **5/5 tamamlayınca:**
   - Kutlama animasyonu göster (confetti 🎉)
   - Bonus skoru göster
   - Streak güncellemesini göster

---

## 🔔 Push Notification Sistemi

### Nasıl Çalışıyor?

1. **iOS app açılışında** FCM token'ı backend'e kaydet (`registerFCMToken`)
2. **Her gün UTC 21:00'da** (Türkiye 00:00) scheduled Cloud Function çalışır
3. Daily challenge'ını **tamamlamamış** olan herkese push notification gider
4. Kullanıcı bildirim ayarlarını kapatabilir (`updateNotificationSettings`)

### API Endpoints

#### `POST /registerFCMToken`

App açılışında ve token yenilendiğinde çağrılmalı.

```json
{
    "deviceId": "xxx",
    "fcmToken": "dGVzdC10b2tlbi0xMjM0...",
    "platform": "ios"
}
```

**Response:**
```json
{ "success": true }
```

#### `POST /updateNotificationSettings`

Ayarlar ekranından bildirim açma/kapama.

```json
{
    "deviceId": "xxx",
    "enabled": false
}
```

**Response:**
```json
{ "success": true, "notificationsEnabled": false }
```

### Bildirim Zamanlaması

| Saat (UTC) | Saat (TR) | Olay |
|------------|-----------|------|
| 00:00 | 03:00 | Yeni gün başlar, yeni 5 puzzle aktif |
| 21:00 | 00:00 | Tamamlamayanlara reminder gönderilir |
| 23:59 | 02:59 | Günün son anı |

### iOS FCM Entegrasyon Kodu

```swift
import FirebaseMessaging

class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {
    
    func application(_ application: UIApplication, 
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // FCM delegate ayarla
        Messaging.messaging().delegate = self
        
        // Bildirim izni iste
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }
        
        return true
    }
    
    // FCM token yenilendiğinde
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken, let deviceId = getDeviceId() else { return }
        
        // Backend'e token gönder
        registerFCMToken(deviceId: deviceId, fcmToken: token)
    }
    
    func registerFCMToken(deviceId: String, fcmToken: String) {
        let url = URL(string: "\(baseURL)/registerFCMToken")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "deviceId": deviceId,
            "fcmToken": fcmToken,
            "platform": "ios"
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { _, _, error in
            if let error = error {
                print("FCM token registration failed: \(error)")
            }
        }.resume()
    }
}
```

### Bildirim Handling (Deep Link)

```swift
// Kullanıcı bildirime tıklayınca Daily Challenge ekranını aç
func userNotificationCenter(_ center: UNUserNotificationCenter,
                            didReceive response: UNNotificationResponse) async {
    let userInfo = response.notification.request.content.userInfo
    
    if let type = userInfo["type"] as? String, type == "daily_challenge_reminder" {
        // Daily Challenge ekranına navigate et
        NavigationManager.shared.navigateTo(.dailyChallenge)
    }
}
```

---

## Firestore Collections (Backend Reference)

```
dailyChallenges/{dateString}      → Günlük 5 puzzle tanımı (tüm oyuncular aynı)
dailyProgress/{deviceId}          → Kullanıcının bugünkü ilerleme durumu
dailyStreaks/{deviceId}            → Streak + toplam istatistikler
fcmTokens/{deviceId}              → FCM token + bildirim tercihleri
```
