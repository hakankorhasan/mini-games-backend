# 📱 Story System — Mobile API Reference

Base URL: `https://<region>-<project-id>.cloudfunctions.net`

---

## 1. Hikayeleri Çekme

**GET** `/seedStories`

Hikayeleri Firestore'a yazar ve döner. Zaten seed edilmişse Firestore'dan doğrudan okuyabilirsin.

### Response Body

```json
{
    "success": true,
    "stories": [
        {
            "id": "nl_story_01",
            "gameType": "neuralLink",
            "title": "Kayıp Anılar",
            "subtitle": "Travma sonrası hafıza onarımı",
            "icon": "brain.head.profile",
            "coverImageURL": "https://storage.googleapis.com/.../cover.jpg",
            "themeColors": ["#00E5FF", "#AA00FF"],
            "order": 1,
            "levels": [
                {
                    "order": 1,
                    "title": "İlk Sinyal",
                    "subtitle": "Prefrontal Korteks",
                    "gridSize": 5,
                    "flowCount": 3,
                    "deadNeuronCount": 0,
                    "events": [
                        {
                            "order": 1,
                            "startMessages": [
                                "Nöral yol hasarı tespit edildi.",
                                "Sinaps yeniden bağlantısı başlatılıyor.",
                                "Dikkatli ilerle."
                            ],
                            "endTitle": "Hafıza Parçası Kurtarıldı",
                            "endMessage": "Nöral bağlantı başarıyla yeniden kuruldu.",
                            "artifactText": "\"Bir çocuğun gülüşü… tanıdık ama uzak.\"",
                            "artifactImageURL": null
                        }
                    ]
                }
            ]
        }
    ]
}
```

> **Not:** `levels[n].events.length` = o level'da kaç kere oynanacağı.

---

## 2. İlerleme Kaydetme

**POST** `/saveStoryProgress`

Her event tamamlandığında çağır.

### Request Body

```json
{
    "deviceId": "ABCD-1234-EFGH-5678",
    "storyId": "nl_story_01",
    "levelOrder": 2,
    "eventOrder": 1,
    "completed": false
}
```

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `deviceId` | `string` | ✅ | Cihaz benzersiz ID'si |
| `storyId` | `string` | ✅ | Hikaye ID'si (ör: `nl_story_01`) |
| `levelOrder` | `number` | ✅ | Mevcut level sırası (1-based) |
| `eventOrder` | `number` | ✅ | Level içindeki event sırası (1-based) |
| `completed` | `boolean` | ✅ | Hikaye tamamen bitti mi? |

### Response Body — 200

```json
{
    "success": true,
    "progress": {
        "storyId": "nl_story_01",
        "levelOrder": 2,
        "eventOrder": 1,
        "completed": false
    }
}
```

### Error — 400

```json
{
    "success": false,
    "error": "deviceId is required."
}
```

---

## 3. İlerleme Okuma

**GET** `/getStoryProgress?deviceId=xxx&storyId=yyy`

### A) Tek Hikaye

**GET** `/getStoryProgress?deviceId=ABCD-1234-EFGH-5678&storyId=nl_story_01`

#### Response — 200

```json
{
    "success": true,
    "progress": {
        "storyId": "nl_story_01",
        "levelOrder": 2,
        "eventOrder": 1,
        "completed": false,
        "updatedAt": { "_seconds": 1741438800, "_nanoseconds": 0 }
    }
}
```

Hiç oynanmamışsa:

```json
{
    "success": true,
    "progress": null
}
```

### B) Tüm Hikayeler

**GET** `/getStoryProgress?deviceId=ABCD-1234-EFGH-5678`

#### Response — 200

```json
{
    "success": true,
    "progress": [
        {
            "storyId": "nl_story_01",
            "levelOrder": 3,
            "eventOrder": 2,
            "completed": false,
            "updatedAt": { "_seconds": 1741438800, "_nanoseconds": 0 }
        },
        {
            "storyId": "pe_story_01",
            "levelOrder": 1,
            "eventOrder": 1,
            "completed": false,
            "updatedAt": { "_seconds": 1741435200, "_nanoseconds": 0 }
        }
    ]
}
```

Hiç progress yoksa:

```json
{
    "success": true,
    "progress": []
}
```

---

## 📐 Mobil Taraf Akış Özeti

```
Uygulama açılır
    → GET /getStoryProgress?deviceId=xxx → tüm progress'leri al
    → Kullanıcı hikaye seçer
    → progress varsa → kaldığı level/event'ten devam
    → progress yoksa → level 1, event 1'den başla
    → Level içinde:
        → events.count kadar oynat (her event = 1 puzzle)
        → Her event bitişinde → POST /saveStoryProgress (level, event+1)
        → Son event bittiyse → POST /saveStoryProgress (level+1, event=1)
        → Son level, son event → POST /saveStoryProgress (completed=true)
```

---

## 🔥 Firestore Yapısı

```
gameStories/{storyId}          ← hikaye verileri (read-only)
storyProgress/{deviceId}
    └── stories/{storyId}      ← { storyId, levelOrder, eventOrder, completed, updatedAt }
```
