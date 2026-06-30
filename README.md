# 🍱 MBG Analytics — Association Rule Mining

> **Dashboard interaktif** analisis pola kombinasi menu Program **Makan Bergizi Gratis (MBG)** menggunakan Association Rule Mining (FP-Growth Algorithm).

🔗 **[Lihat Live Demo](https://azispanji24.github.io/mbg-analytics/)**

---

## 📊 Tentang Proyek

| Atribut | Detail |
|---|---|
| **Kelompok** | 6 |
| **Mata Kuliah** | Machine Learning |
| **Metode** | Association Rule Mining (FP-Growth) |
| **Dataset** | 846 foto menu MBG (PNG/JPG/JPEG) |
| **Tools** | Python, EasyOCR, mlxtend, Flask, Chart.js, D3.js |

### Anggota Kelompok
- Dwi Saktya Hari Aditya
- Aziz Panji Gumilang
- Ariel Aziz Bhadrika
- Achmad Ridho Saputra

---

## 📈 Hasil Analisis

| Metrik | Nilai |
|---|---|
| Total gambar | 846 |
| Transaksi valid | 830 |
| Item unik terdeteksi | 23 |
| Frequent itemsets | 101 |
| Association rules | 56 |
| Rules signifikan (lift>1.5, conf>65%) | 5 |

### 🏆 Top Association Rules

| Antecedents | Consequents | Support | Confidence | Lift |
|---|---|---|---|---|
| abon | roti | 5.2% | 72.9% | **3.44** |
| roti, ayam | telur | 5.1% | 73.7% | **1.83** |
| ayam, susu | telur | 5.1% | 70.0% | **1.73** |
| pisang, susu | telur | 6.3% | 69.3% | **1.72** |
| jeruk, susu | telur | 5.3% | 68.8% | **1.70** |

---

## 🚀 Cara Menjalankan (Lokal dengan Flask)

```bash
# Install dependencies
pip install -r web/requirements.txt

# Jalankan server
cd web
python app.py

# Buka browser
# http://localhost:5000
```

### Mode Analisis
- **⚡ Muat Data Preset** — Langsung tampilkan hasil analisis notebook (~2 detik)
- **☁️ Analisis dari Drive** — Download + OCR + Mining ulang dari Google Drive (30-60 menit)

---

## 🗂️ Struktur Proyek

```
mbg-analytics/
├── docs/               # GitHub Pages (static HTML)
│   └── index.html      # Dashboard standalone
├── web/                # Flask backend
│   ├── app.py          # Server utama
│   ├── templates/
│   │   └── index.html  # Template dashboard
│   ├── static/
│   │   ├── css/style.css
│   │   └── js/app.js
│   └── requirements.txt
└── Untitled21 (1).ipynb  # Notebook Colab original
```

---

## 📱 Fitur Dashboard

- 📊 Bar chart frekuensi item makanan (Top 15)
- 🍩 Donut chart distribusi format file
- 📈 Distribusi item per transaksi
- 🔗 Tabel association rules dengan filter interaktif (Lift, Confidence)
- 🌐 Network graph D3.js (drag-able nodes)
- 💹 Scatter plot Support vs Confidence
- ⭐ Highlight top 5 rules signifikan

---

**Dataset**: [Google Drive](https://drive.google.com/drive/folders/1qXPs8jT-7lLpJqIN2m3bUVE-TKDUVCTv?usp=sharing) | **Email**: azispanji92@gmail.com
