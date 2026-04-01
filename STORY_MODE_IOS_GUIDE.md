# Story Mode iOS Implementation Guide

Bu doküman, Story Mode sayfasında yapılacak yeni UI güncellemeleri (Global Slider ve Badge Sistemi) için iOS tarafında yapılması gereken backend entegrasyonlarını içerir.

## 1. Global Story Sliders (En Üstteki Slider)

Story Mode sayfasının en üstünde yer alacak olan slider görselleri (fotoğraf veya video), artık oyunlardan bağımsız olarak dinamik bir şekilde Firestore'dan gelmektedir.

### Firestore Yolu
- **Collection Adı:** `storySliders`

### Veri Modeli (SwiftUI için Örnek)

```swift
import FirebaseFirestore

struct StorySlider: Identifiable, Codable {
    @DocumentID var id: String?
    let type: String    // "video" veya "image"
    let url: String     // Medyanın indirme/oynatma linki
    let badge: String   // "popular", "new" veya "" (boş string)
    let order: Int      // Sıralama numarası
}
```

### Nasıl Çekilmeli?
Uygulama açıldığında veya Story Mode sayfasına girildiğinde, yeni oluşturulan `getStorySliders` API endpoint'ine bir GET isteği atarak slider'ları alabilirsiniz. Slider'lar otomatik olarak `order` değerine göre küçükten büyüğe sıralanmış olarak gelir.

- **Endpoint URL:** `https://us-central1-mini-games-9a4e1.cloudfunctions.net/getStorySliders`
- **Method:** `GET`

**Örnek JSON Yanıtı:**
```json
{
  "success": true,
  "count": 2,
  "sliders": [
    {
      "id": "slider_1",
      "type": "image",
      "badge": "popular",
      "url": "https://storage.googleapis.com/.../slider_1.jpg",
      "order": 1
    },
    {
      "id": "slider_2",
      "type": "video",
      "badge": "",
      "url": "https://storage.googleapis.com/.../slider_2.mp4",
      "order": 2
    }
  ]
}
```

**Örnek Swift Kodu (Moya veya URLSession ile):**
```swift
func fetchStorySliders() {
    let url = URL(string: "https://us-central1-mini-games-9a4e1.cloudfunctions.net/getStorySliders")!
    
    URLSession.shared.dataTask(with: url) { data, response, error in
        guard let data = data, error == nil else { return }
        
        // Response modelinize göre decode edin
        // let response = try? JSONDecoder().decode(StorySliderResponse.self, from: data)
        // DispatchQueue.main.async { self.sliders = response.sliders }
    }.resume()
}
```

### Animasyon ve Gösterim İpuçları
- `type == "video"` ise arka planda sessiz ve looping (sürekli başa saran) bir `AVPlayer` veya standart bir `VideoPlayer` kullanabilirsiniz.
- `badge` alanı boş değilse, slider kartının sol veya sağ üst köşesinde küçük bir "New" veya "Popular" etiketi basabilirsiniz.


---

## 2. Oyunlara Özel Rozetler (Game Badges)

Slider'ın altında listelenen hikaye oyunları (Kayıp Anılar, Dijital Bilinç vb.) için de artık rozet (badge) desteği backend tarafına eklendi.

### Firestore Yolu
- **Collection Adı:** `gameStories` (Zaten kullanıyorsunuz)

### Değişen Veri Modeli (SwiftUI)

Mevcut `GameStory` modelinize sadece opsiyonel bir `badges` dizisi eklemeniz yeterli:

```swift
struct GameStory: Identifiable, Codable {
    @DocumentID var id: String?
    let gameType: String
    let title: String
    let subtitle: String
    let icon: String
    let coverImageURL: String?
    let themeColors: [String]
    let order: Int
    
    // YENİ EKLENEN ALAN
    let badges: [String]? // Örnek: ["new", "popular"]
    
    // (levels ve events özellikleriniz aynı kalıyor...)
}
```

### Gösterim İpuçları
Bir oyunun kartını çizerken `badges` dizisini kontrol edebilirsiniz. Eğer dizi `nil` değilse ve içi doluysa, ilk rozeti veya tüm rozetleri yatay bir şeklide oyun kartının köşesine ekleyebilirsiniz. Örnek: `if let badges = story.badges, badges.contains("new") { // Yeni etiketi çiz }`

---
### Not: Güncelleme Nasıl Yapılıyor? (Geliştirici Bilgisi)
Storage tarafına eklediğiniz yeni medya dosyalarını database'e geçirmek için backend tarafında `seedStories` komutu kullanılmaktadır. Story Sliders tamamen otomatik olarak Firebase Storage içindeki `story_sliders/` klasöründen taranıp `storySliders` koleksiyonuna dönüştürülmektedir.
