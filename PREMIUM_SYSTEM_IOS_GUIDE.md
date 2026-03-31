# Backend Premium Sistemi & iOS Entegrasyon Rehberi

Bu belge, Mini Games uygulamasına eklenen Server-Side Premium (In-App Purchase) sistemini özetlemekte olup, iOS tarafında yapılması gereken güncellemeleri listelemektedir.

---

## 🏗 Ne Yaptık? (Backend Özeti)

Eskiden sadece frontend üzerinde (`StoreManager.swift` ve iCloud Keychain verileriyle) takip edilen Premium durumu artık tamamen backend'e taşındı. Jailbreak ile in-app purchase atlama gibi durumları önlemek adına Apple JWS (StoreKit 2) tabanlı güvenilir bir IAP doğrulama altyapısı kuruldu.

### Yeni Mimari Özellikleri:
1. **Apple JWS Doğrulaması:** Frontend, StoreKit 2 üzerinden aldığı `jwsRepresentation` token'ını backend'e gönderir. Backend, Apple Certificate Chain'i doğrulayarak makbuzu onaylar *(Bunun için Apple Public API Limitinden bağımsız Offline Signature Verification kullanıldı).*
2. **Entitlement Sistemi (`users/{deviceId}.premium`):** Kullanıcı veritabanında `removeAds`, `storyMode` ve `ultimateBundle` yetkileri backend'de kalıcı olarak saklanır.
3. **App Store Server Notifications (v2):** `handleAppStoreNotification` webhook'u eklendi. Apple tarafından otomatik gönderilen REFUND / REVOKE bildirimlerini yakalayarak kullanıcının premium yetkilerini backend'den otomatik olarak iptal eder.
4. **Backend Paywall:** Sadece Frontend'deki UI değil, Level 2 ve sonrası (Story mod) için atılacak `/saveStoryProgress` isteğinde backend tarafından yetki doğrulaması yapılır. Entitlement yoksa `403 Forbidden` döner.
5. **Satın Alma Geçmişi (Audit Trail):** Tüm satın alımlar `premium.purchases` alanı altında, makbuz tarihleri ve transaction ID'leri ile tutulur. `transactionId` kontrolü ile Replay Attack (Mükerrer İstek) engellenmiştir.

---

## 📡 iOS Tarafında Değişmesi Gerekenler

Backend hazır, ancak iOS uygulamasında `StoreManager` ve Network katmanının bu yeni API'lere adapte edilmesi gerekmektedir. Yeni akışta yapmanız gereken güncellemeler aşağıdadır:

### 1. Uygulama Açılışı & Devamlı Senkronizasyon
Uygulama açılırken çağrılan `checkDevice` isteği güncellendi. Artık dönen yanıtta `premium` objesi var. 
*Aksiyon:* `ProfileManager.checkDeviceIfNeeded()` veya benzeri bir yerde bunu parse edip, `StoreManager.shared`'a yeni durumu aktarın.

**Örnek JSON Yanıtı:**
```json
{
  "success": true,
  "isRegistered": true,
  "profile": { ... },
  "premium": {
    "removeAds": true,
    "storyMode": false,
    "ultimateBundle": false
  }
}
```

```swift
// Swift tarafında parsing:
if let premiumData = json["premium"] as? [String: Any] {
    let removeAds = premiumData["removeAds"] as? Bool ?? false
    let storyMode = premiumData["storyMode"] as? Bool ?? false
    let ultimate = premiumData["ultimateBundle"] as? Bool ?? false
    // StoreManager'ı güncelle.
}
```

### 2. Satın Alım İşlemi (Purchase Flow)
Bir ürün başarıyla satın alındığında (`Transaction.updates` listener içinde veya `Product.purchase() `dönüşünde), işlemin başarılı olması için **Backend `verifyPurchase` API'sine gitmesi şarttır.**

*Aksiyon:* Satın alım başarılıysa aşağıdaki bilgileri `/verifyPurchase`'a POST edin. Backend sonucu döndüğünde UI tarafını kilidi açılmış şekilde güncelleyin. Başarısız olursa kullanıcıya `Apple sunucularıyla doğrulama başarısız oldu` hata mesajı gösterin ve satın alımı beklemeye alın.

**Endpoint:** `POST /verifyPurchase`
**Body:**
```json
{
  "deviceId": "Kullanıcının_Keychain_UUID'si",
  "productId": transaction.productID,
  "transactionId": String(transaction.id),
  "originalTransactionId": String(transaction.originalID),
  "receiptData": transaction.jwsRepresentation ?? "",
  "environment": transaction.environment.rawValue
}
```

### 3. Satın Alınanları Geri Yükle (Restore Purchases)
Farklı bir cihaza geçildiğinde (yeni deviceId) veya kullanıcı uygulamayı sildiğinde "Restore Purchases" çalışmalıdır. 
*Aksiyon:* `StoreKit` `Transaction.currentEntitlements` üzerinden dönen tüm aktif `transaction` objelerini alın. Bunları asenkron olarak teker teker `/verifyPurchase` API'sine veya yeni deviceId ile güncellenebilecek bir proxy fonksiyona yollayın.
*Not:* Backend tarafı aynı transactionId'ler gelse de idemptotent'tır, sadece işlemi kaydetmemişse kaydeder, etmişse sorun çıkarmaz. Yeni cihazın `deviceId`'siyle yollanması o cihaza da özellikleri aktif eder.

### 4. Hata Yönetimi `saveStoryProgress`
`saveStoryProgress` isteğinde (Backend Paywall), kullanıcı yetkiye sahip olmadan Level 2 ve üzerine ilerlemek isterse `403 Status Code` ve `"error": "purchase_required"` hata mesajı alınır.
*Aksiyon:* Story mode ağ katmanında bu hataya rastlanırsa (örneğin offline modda oyunu manipüle etmişse) catch loglarını ekleyip UI'ı kilitli tuttuğunuzdan emin olun.

---

## ⚙️ Test Aşamasına Dair Notlar
* **StoreKit Configuration:** Xcode'daki local StoreKit Configuration `.storekit` dosyasıyla Sandbox'ta test yaparken her testin başarılı sayılabilmesi adına `verifyPurchase` endpointine yollanacak payload'ların düzgün olup olmadığına dikkat edin.
* **Release:** Ürünü Apple'a atarken AppStore üzerinden yapacağınız App Store Server Notifications V2 ayarı için App Store Connect -> App -> App Store Server Notifications bölümünde **URL:** olarak `https://us-central1-mini-games-9a4e1.cloudfunctions.net/handleAppStoreNotification` (Production / Sandbox ikisine de aynı) girilmesi unutulmamalıdır.
