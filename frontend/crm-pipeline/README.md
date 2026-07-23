# EduCRM — O'quv Markazi Sotuv Varonkasi

**ReactJS + Tailwind CSS + Lucide Icons**

## Texnologiyalar
- React 18
- Tailwind CSS 3
- Lucide React (ikonlar)
- Vite (build tool)

## Ishga tushirish

```bash
# 1. Papkaga o'ting
cd educrm-pipeline

# 2. Kutubxonalarni o'rnating
npm install

# 3. Dev serverini ishga tushiring
npm run dev

# 4. Brauzerda oching
# http://localhost:5173
```

## Build (Production)
```bash
npm run build
```

## Fayl tuzilmasi

```
educrm-pipeline/
├── index.html          ← HTML asosi
├── main.jsx            ← React kirish nuqtasi
├── index.css           ← Tailwind CSS
├── App.jsx             ← App komponenti
├── CRMPipeline.jsx     ← ASOSIY KOMPONENT (barcha kod shu yerda)
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Asosiy imkoniyatlar

### ✅ 12 ta maydon (to'liq):
1. No (avto-ID)
2. Tuman
3. Ism / Familya
4. Maktab
5. Sinf
6. Sektor (O'zbek / Rus)
7. Kelajakda kim bo'lmoqchi
8. Fanlar (ko'p tanlov)
9. Avvalgi markaz va muddat
10. Telefon (Shaxsiy)
11. Telefon (Ota)
12. Telefon (Ona)

### 📊 5 ta bosqich:
- Yangi lidlar → Aloqaga chiqildi → Sinovga taklif → A'zo bo'ldi → Rad etdi

### 🖱️ Drag & Drop:
- Kompyuter: kartochkani sudrab boshqa ustunga tashlash
- Mobil: kartochka ichidagi "→" tugmasi orqali tezkor almashtirish

### 📱 Responsive:
- Mobil: gorizontal snap-scroll
- Planshet: 3 ustun
- Kompyuter: 5 ustun yonma-yon

### 🔍 Qidiruv va filter:
- Ism, telefon, maktab, ID bo'yicha qidiruv
- Tuman bo'yicha filter

### 📋 Modallar:
- Yangi lid qo'shish (12 maydon)
- Batafsil ko'rish (barcha ma'lumot)
- Tahrirlash (har qanday maydonni)
