# 📸 DuoBooth — Photobooth online buat berdua

Photobooth di browser untuk **dua orang di dua device berbeda**. Satu orang membuat room, membagikan **kode** (atau tautan), pasangannya masuk, lalu kalian berfoto bersama dengan hitung mundur yang sama. Setiap pose berisi foto kalian berdua, berdampingan seperti satu bingkai.

## Fitur

| | |
|---|---|
| **Room code** | Kode 6 karakter + tautan undangan (`/r/KODE`). Maksimal 2 orang per room. |
| **Video langsung** | WebRTC peer-to-peer (video + suara). Bila jaringan memblokirnya, otomatis ada *mode hemat* lewat server supaya tetap bisa saling melihat. |
| **Foto bersama** | Hitung mundur tersinkron (3/5/10 detik), 2–4 pose. Tiap device memotret kameranya sendiri pada resolusi penuh, lalu foto dipertukarkan. |
| **Template** | **Warna polos**, **Kucing**, **Anjing**, **Langit**, **Panda**, **Red Panda**. Semua stiker digambar sendiri (SVG), tanpa aset berlisensi. |
| **Tambah stiker** | 35 stiker (kucing, anjing, langit, panda, red panda, lucu). Geser, besarkan/putar lewat handle atau cubit dua jari, cermin, gandakan, depan/belakang, hapus. Kalian berdua bisa mengedit **bersamaan** dan hasilnya langsung sinkron. |
| **Ganti background** | **Latar strip**: warna polos/pilihan sendiri, gradasi, pola, pemandangan (langit, senja, malam, hutan bambu, bokeh), atau gambar yang diunggah. **Latar foto**: siluet kalian dipotong otomatis dari foto lalu ditaruh di depan latar pilihan (virtual background). |
| **Teks** | Judul dan nama/keterangan di strip, tanggal otomatis. |
| **Simpan** | Unduh PNG (1200 px lebar) atau bagikan lewat menu bagikan HP (bisa langsung "Simpan ke Foto"). |
| **Tahan banting** | Sambung ulang otomatis bila sinyal putus, refresh halaman aman (foto dipulihkan dari pasangan), tab ganda ditangani. |

## Menjalankan di komputer

Butuh Node.js 18 atau lebih baru.

```bash
npm install
npm start
```

Buka <http://localhost:3000>. Untuk mencoba sendirian, buka dua tab/jendela: satu membuat room, satu lagi bergabung dengan kodenya.

> ⚠️ **Kamera hanya boleh dipakai di `https://` atau `localhost`.** Kalau kamu membuka lewat alamat IP jaringan lokal (mis. `http://192.168.1.5:3000`) dari HP, browser akan menolak kamera. Untuk dipakai dari jarak jauh, **deploy** ke hosting (di bawah) — alamat `https://`-nya otomatis didapat.

## Deploy supaya bisa dipakai berdua dari jauh

Aplikasi ini satu server Node.js kecil (`server/index.js`) yang melayani halaman web dan mempertemukan kalian lewat WebSocket. Satu-satunya dependensi adalah `ws`.

### Render (gratis, paling mudah)

1. Unggah folder proyek ini ke sebuah repositori GitHub.
2. Di [render.com](https://render.com): **New → Web Service** → pilih repositori itu.
3. Isi: **Build Command** `npm install`, **Start Command** `npm start`, **Instance type** `Free`.
   (Atau pilih **New → Blueprint**; berkas `render.yaml` sudah menyiapkan semuanya.)
4. Setelah selesai, buka alamat `https://nama-kamu.onrender.com`. Selesai!

Catatan paket gratis: server "tidur" setelah ±15 menit tanpa pengunjung, jadi pembukaan pertama bisa memakan waktu sekitar 30–60 detik. Room hidup di memori server, jadi ikut hilang bila server tidur/restart; cukup buat room baru.

### Platform lain

Railway, Koyeb, Fly.io, atau VPS apa pun bisa: jalankan `npm install && npm start`. Server membaca variabel `PORT` secara otomatis. Pastikan platform mendukung **WebSocket** (semua yang disebut di atas mendukung).

### Docker

```bash
docker build -t duobooth .
docker run -p 3000:3000 duobooth
```

## Konfigurasi (environment variable)

| Variabel | Fungsi | Bawaan |
|---|---|---|
| `PORT` | Port server | `3000` |
| `HOST` | Alamat bind | `0.0.0.0` |
| `TURN_URL` | Satu atau beberapa URL TURN dipisah koma, mis. `turn:turn.contoh.com:3478,turns:turn.contoh.com:443?transport=tcp` | kosong |
| `TURN_USERNAME`, `TURN_CREDENTIAL` | Kredensial TURN | kosong |
| `ICE_SERVERS` | Alternatif: array `iceServers` dalam JSON (menggantikan semua pengaturan di atas) | kosong |
| `ICE_SERVERS_URL` | Alternatif: URL yang mengembalikan array `iceServers` (mis. endpoint kredensial sementara dari penyedia TURN); hasilnya di-cache 30 menit | kosong |

Contoh ada di `.env.example`.

## Kalau video pasangan tidak muncul (TURN)

Video mengalir langsung antar device (peer-to-peer) dan hanya memakai server STUN publik. Pada sebagian jaringan — terutama **data seluler** dengan NAT ketat atau **WiFi kantor/kampus** — koneksi langsung tidak bisa terbentuk tanpa **server TURN**.

Yang terjadi bila itu menimpa kalian:

1. Setelah beberapa detik muncul lencana kuning **"Mode hemat"** di video pasangan: kalian tetap saling melihat lewat gambar kecil yang diteruskan server (lebih patah-patah dan tanpa suara), dan **foto tetap bisa diambil bersama** karena foto dipertukarkan lewat server.
2. Untuk video & suara yang mulus, pasang TURN. Pilihannya: layanan TURN terkelola (banyak yang punya paket gratis) atau `coturn` di VPS sendiri. Lalu isi `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`.

> Kredensial TURN dikirim ke browser agar bisa dipakai, jadi pilih kredensial yang bisa dicabut/diganti, atau `ICE_SERVERS_URL` yang menghasilkan kredensial sementara.

## Cara pakai

1. **Pemilik room** membuka situs, mengisi nama, lalu **Buat Room Baru** dan mengizinkan kamera.
2. Bagikan **kode** atau **tautan** ke pasangan. Pasangan membuka tautan (atau memasukkan kode), mengisi nama, lalu **Gabung**.
3. Pilih **jumlah foto** dan **hitung mundur**, serta **template** dan **latar** (perubahan muncul di layar pasangan juga). Siapa pun boleh menekan **Mulai Foto**.
4. Setelah semua pose selesai, kalian masuk layar edit: tambah **stiker**, ganti **latar**, ubah **template/teks**, lalu **Unduh PNG**. Tombol **Foto lagi** mengulang pemotretan tanpa menghilangkan pilihan template, latar, dan stiker.

## Privasi

- Foto **tidak disimpan** di server. Server hanya meneruskan pesan antara dua orang di room yang sama (dan menyimpan daftar room di memori sampai kosong).
- Ganti latar di belakang orang memproses foto **di browser kalian sendiri**. Library dan modelnya (beberapa MB) diunduh sekali dari CDN (jsDelivr dan Google Cloud Storage) saat fitur itu pertama dipakai, jadi butuh internet; fitur lain tidak memerlukannya.
- Font *Fredoka* dimuat dari Google Fonts bila tersedia; bila tidak, dipakai font sistem (tampilan sedikit berbeda, fungsinya sama).

## Struktur proyek

```
server/
  index.js        server HTTP + WebSocket (signaling, batas laju, heartbeat)
  rooms.js        logika room 2 orang (murni, mudah diuji)
public/
  index.html
  css/styles.css
  js/
    main.js       titik masuk, pemasangan layar, notifikasi
    app.js        pengendali utama (room, kamera, WebRTC, state, ekspor)
    net.js        klien WebSocket dengan sambung ulang otomatis
    rtc.js        koneksi video peer-to-peer
    session.js    protokol pemotretan bersama & pemulihan foto
    state.js      state bersama (last-writer-wins) + validasi data dari jaringan
    camera.js     kamera/mikrofon & pengambilan frame
    lib/          stiker, template, latar, render strip, segmentasi, ikon, utilitas
    views/        lobi, booth, studio (edit), panel, kanvas interaktif
```

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| "Kamera hanya bisa dipakai lewat HTTPS" | Buka lewat `https://` atau `localhost`. |
| "Izin kamera ditolak" | Klik ikon gembok/kamera di address bar → izinkan kamera → muat ulang. |
| "Room tidak ditemukan" | Kode salah, atau room sudah berakhir (server gratis bisa tidur/restart). Buat room baru. |
| Video pasangan "Menyambungkan…" lama / mode hemat | Lihat bagian TURN di atas. |
| Tidak ada suara pasangan di iPhone | Ketuk tombol "Ketuk untuk menyalakan video & suara" di video pasangan (aturan autoplay Safari). |
| Ganti latar foto gagal | Pastikan internet aktif (model diunduh sekali dari CDN), lalu tekan **Coba lagi** di panel Latar. |
