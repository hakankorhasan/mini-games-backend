# Galactic Beacons (Star Battle) - iOS Integration Guide

Bu rehber, backend tarafında yazılan Galactic Beacons (Star Battle) level generator yapısının iOS tarafında nasıl kullanılacağını, API kontratlarını ve UI döngüsünü açıklar.

## 1. API Kontratları (JSON Modeli)

Leveller, backend tarafında `generateLevels` fonksiyonu ile oluşturulur ve Firestore'a kaydedilir. `getStarBattleLevels` API'si çağrıldığında aşağıdaki JSON formatında bir veri döner:

```json
{
  "success": true,
  "level": {
    "levelNumber": 142,
    "gridSize": 8,
    "beaconsPerUnit": 1,
    "difficulty": "intermediate",
    "difficultyValue": 5,
    "regions": [
      [0, 0, 0, 1, 1, 1, 2, 2],
      [0, 3, 0, 1, 4, 1, 2, 2],
      ... (8x8 matrix)
    ],
    "solution": [
      [false, true, false, ...],
      [false, false, false, true, ...],
      ... (8x8 matrix)
    ],
    "regionColors": [3, 0, 5, 2, 7, 1, 4, 6]
  }
}
```

### Parametre Açıklamaları
*   **`gridSize` (N):** Oyun alanının boyutunu belirtir (5x5, 6x6, 8x8, 10x10 veya 12x12).
*   **`beaconsPerUnit` (B):** Her satır, sütun ve bölgede bulunması gereken Yıldız (Beacon) sayısını belirtir. (Level 1-250 arası B=1, Level 251-500 arası B=2).
*   **`regions`:** Her hücrenin hangi kümeye (nebula) ait olduğunu gösteren $N \times N$ matristir. Değerler `0` ile `gridSize - 1` arasındadır.
*   **`solution`:** Oyunun backend tarafından doğrulanmış tek çözümüdür. (Sadece oyuncu çok zorlandığında hint (ipucu) vermek için kullanılmalıdır).
*   **`regionColors`:** Her bölge ID'sine karşılık gelen renk indeksini tutan, boyutu `gridSize` olan bir dizidir. iOS tarafında komşu bölgelerin aynı renge boyanmasını engellemek için backend tarafından greedy graph-coloring ile hesaplanır. Index `0` için `regionColors[0]` renk paletindeki rengi vermelidir. Palet (0-7) arası 8 güzel pastel/premium renkten oluşmalıdır.

## 2. iOS UI Mimarisi ve Hücre Döngüsü

### 2.1 State Yapısı
Her hücre (`Cell`) üç durumdan birinde olabilir (Enum):
1.  **`empty` (0):** Hücre boş. Varsayılan durum.
2.  **`beacon` (1):** Oyuncu hücreye bir yıldız koydu. (Animasyonlu ve parlak).
3.  **`blocked` (2):** Oyuncu kendi kendine "Burada yıldız olamaz" notu düştü. (Karanlık çarpı/nokta işareti).

**Tap Döngüsü:**
Oyuncu bir hücreye tıkladığında durum şu şekilde değişmelidir:
`empty` -> `beacon` -> `blocked` -> `empty`

### 2.2 Dinamik Hata Gösterimi (Error Detection)
Oyuncuyu tamamen engellemek yerine, sadece kural ihlallerini kırmızı renk/titreşim ile göstermek en iyi premium deneyimi sunar:

*   **Temas Kuralı (Kural 4):** İki beacon yatay, dikey veya çapraz olarak birbirine komşuysa (8-yönlü temas), her iki beacon da kırmızıya (error state) döner.
*   **Limit Aşımı (Kural 1, 2 & 3):** Bir satırda, sütunda veya bölgede `beaconsPerUnit` (örn: B=2) sayısından FAZLA beacon konursa, o alandaki tüm beacon'lar kırmızı uyarı vermelidir.

### 2.3 Premium UI / UX İpuçları
*   `regionColors` verisini eşlerken mat ve şık degrade (gradient) renkler kullanın.
*   Hücre border'larını, hücrenin ait olduğu `regionId`'ye göre dinamik çizin. Eğer komşu hücrenin regionId'si farklıysa kalın border (kalın çizgi), aynıysa ince border veya transparan bırakın.
*   **Auto-Fill Özelliği (Assist Mode):** Oyuncu bir hücreye `beacon` koyduğunda, oyun etrafındaki 8 hücreyi (Temas Kuralı gereği) otomatik olarak `blocked` durumuna çekebilir (B=1 için özellikle aynı satır/sütun da tamamen kapatılabilir). Bu, küçük ekranlarda UX'i devasa ölçüde arttırır.

## 3. Kazanma Kontrolü (Win Condition)

Oyunun bittiğini kontrol ederken (isSolved/checkWin):
1.  Tablodaki toplam beacon sayısı tam olarak $N \times B$ olmalıdır.
2.  Her satırda tam olarak $B$ adet beacon bulunmalıdır.
3.  Her sütunda tam olarak $B$ adet beacon bulunmalıdır.
4.  Her bölgede (region) tam olarak $B$ adet beacon bulunmalıdır.
5.  **Hiçbir beacon diğerine temas (çapraz dahil) etmemelidir.**

*(Backend bu kuralların hepsini sağlayan **tek ve benzersiz** bir çözüm olduğunu zaten garanti etmiştir. Sizin sadece oyuncunun gridini test etmeniz yeterlidir.)*
