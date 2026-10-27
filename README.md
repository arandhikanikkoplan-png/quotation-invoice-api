# Quotation & Invoice API

Aplikasi REST API dan Antarmuka Web untuk mengelola Penawaran Harga (*Quotation*) dan Tagihan Penjualan (*Invoice*) secara digital.

Dibangun menggunakan:
- **Backend:** Go (Golang) dengan framework [Gin](https://gin-gonic.com/)
- **ORM:** [GORM](https://gorm.io/)
- **Database:** PostgreSQL
- **Autentikasi:** JWT (*JSON Web Tokens*) disimpan di `localStorage`
- **Frontend:** HTML, CSS, JavaScript murni (*Vanilla*)
- **Ekspor PDF:** [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) (sudah dibundel di `public/js`)

---

## Fitur Utama

1. **Autentikasi Pengguna:**
   - Registrasi akun baru dengan kata sandi terenkripsi (*bcrypt*).
   - Login dengan pengembalian JWT token.
   - Proteksi kepemilikan data: setiap transaksi dan pelanggan hanya dapat diakses oleh pemiliknya.
2. **Pengaturan Perusahaan & Logo:**
   - Unggah logo perusahaan (PNG/JPG/WebP, maks. 2 MB) langsung dari dashboard.
   - Logo otomatis tampil pada dokumen penawaran dan invoice, serta pada bilah navigasi.
   - Identitas perusahaan (nama, email, telepon, website, alamat) dapat diubah kapan saja.
   - Informasi rekening pembayaran (bank, nomor rekening, atas nama) tampil pada invoice.
3. **Manajemen Pelanggan (Customers):**
   - Tambah, lihat daftar, detail, ubah, dan hapus pelanggan.
   - Pelanggan tidak dapat dihapus jika masih memiliki penawaran atau tagihan terkait.
4. **Manajemen Penawaran Harga (Quotations):**
   - Pembuatan penawaran dengan penomoran otomatis (`QUO-YYYYMMDD-XXXX`) dan pengecekan duplikasi.
   - Penambahan banyak item barang/jasa secara dinamis dengan total per baris.
   - Perhitungan otomatis subtotal, pajak PPN (default 11%), dan grand total.
   - Tanggal penawaran dapat ditentukan saat membuat dokumen.
   - Perubahan status: `draft`, `sent`, `accepted`, `rejected`.
   - Konversi langsung quotation berstatus `accepted` menjadi invoice (dicegah dari konversi ganda).
   - Detail penawaran resmi berformat lembar dokumen bisnis profesional.
   - **Ekspor PDF** kualitas tinggi langsung dari tabel maupun halaman detail.
5. **Manajemen Tagihan (Invoices):**
   - Pembuatan invoice langsung atau turunan dari quotation yang disetujui.
   - Penomoran otomatis (`INV-YYYYMMDD-XXXX`) dengan pengecekan duplikasi.
   - Penentuan tanggal terbit dan tanggal jatuh tempo (divalidasi tidak boleh mundur).
   - Pengubahan status pembayaran: `unpaid`, `paid`, `cancelled`.
   - Detail faktur lengkap dengan instruksi transfer, jatuh tempo, dan tanda tangan pengesahan.
   - **Ekspor PDF** kualitas tinggi langsung dari tabel maupun halaman detail.
6. **Antarmuka Web Modern & Responsif di Segala Resolusi:**
   - Mendukung ponsel kecil (< 420px), ponsel standar (< 640px), tablet (≤ 820px), desktop (≤ 1280px), hingga layar lebar/ultra-wide (≥ 1440px dan ≥ 1800px).
   - Tabel berubah menjadi kartu yang mudah dibaca pada layar kecil.
   - Modal gaya *bottom sheet* pada ponsel dan *dialog* pada desktop.
   - Pratinjau dokumen penawaran dan invoice bergaya A4 dengan logo perusahaan.
   - Ekspor PDF selalu menggunakan lebar A4 konsisten, termasuk saat dibuka dari ponsel.
   - Optimasi Cetak / Print to PDF berstandar A4 (`@media print`).

---

## Struktur Folder

```text
go_vibe/
├── config/
│   └── database.go             # Konfigurasi GORM dan koneksi PostgreSQL
├── controllers/                # Handler HTTP REST API
│   ├── auth_controller.go      # Registrasi, login, profil, logo perusahaan
│   ├── customer_controller.go  # Pengelolaan pelanggan
│   ├── quotation_controller.go # Pengelolaan quotation & konversi ke invoice
│   ├── invoice_controller.go   # Pengelolaan invoice & status pembayaran
│   └── helpers.go              # Validasi tanggal/pajak & nomor unik
├── middlewares/
│   ├── auth_middleware.go      # Middleware validasi token JWT
│   └── database_middleware.go  # Respons 503 saat database belum terhubung
├── models/                     # Definisi model & migrasi database
│   ├── user.go                 # Termasuk identitas perusahaan, logo, rekening
│   ├── customer.go
│   ├── quotation.go
│   ├── invoice.go
│   └── transaction_item.go
├── routes/
│   └── routes.go               # Routing API Gin & penyajian file statis
├── services/                   # Logika bisnis & kalkulasi otomatis
│   ├── transaction_service.go
│   └── transaction_service_test.go
├── public/                     # Frontend HTML, CSS, JS
│   ├── index.html
│   ├── login.html
│   ├── favicon.svg
│   ├── css/style.css
│   ├── js/app.js
│   ├── js/html2pdf.bundle.min.js
│   └── uploads/logos/          # Logo yang diunggah (dibuat otomatis, tidak di-commit)
├── .env.example
├── .gitignore
├── go.mod
├── go.sum
├── main.go
└── README.md
```

---

## Endpoint API

### Autentikasi (publik)
| Method | Endpoint | Keterangan |
| --- | --- | --- |
| POST | `/api/auth/register` | Registrasi akun baru |
| POST | `/api/auth/login` | Login dan mendapatkan JWT |
| GET | `/api/health` | Health check (tanpa database) |

### Profil & Pengaturan Perusahaan (perlu JWT)
| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/auth/profile` | Ambil profil, identitas perusahaan, dan logo |
| PUT | `/api/auth/profile` | Simpan identitas perusahaan & rekening |
| POST | `/api/auth/logo` | Unggah logo (`multipart/form-data`, field `logo`) |
| DELETE | `/api/auth/logo` | Hapus logo perusahaan |

### Pelanggan, Quotation, dan Invoice (perlu JWT)
| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET/POST | `/api/customers` | Daftar / tambah pelanggan |
| GET/PUT/DELETE | `/api/customers/:id` | Detail / ubah / hapus pelanggan |
| GET/POST | `/api/quotations` | Daftar / buat penawaran |
| GET/DELETE | `/api/quotations/:id` | Detail / hapus penawaran |
| PATCH | `/api/quotations/:id/status` | Ubah status penawaran |
| POST | `/api/quotations/:id/convert-to-invoice` | Konversi ke invoice |
| GET/POST | `/api/invoices` | Daftar / buat invoice |
| GET/DELETE | `/api/invoices/:id` | Detail / hapus invoice |
| PATCH | `/api/invoices/:id/status` | Ubah status pembayaran |

Semua endpoint terproteksi memerlukan header:

```http
Authorization: Bearer <token>
```

---

## Panduan Menjalankan Aplikasi

### 1. Salin Konfigurasi Environment
Salin file `.env.example` menjadi `.env`:
```powershell
Copy-Item .env.example .env
```
Sesuaikan nilai `DATABASE_URL` dengan database PostgreSQL Anda:
```env
APP_PORT=8080
DATABASE_URL=postgres://postgres:password_kamu@localhost:5432/quotation_invoice_db?sslmode=disable
JWT_SECRET=kunci_rahasia_bebas_kamu
```

> Folder `public/uploads/` dibuat otomatis saat server berjalan dan sudah masuk `.gitignore`. Logo disimpan di sana dan disajikan melalui `/static/uploads/logos/...`.

### 2. Jalankan Pengujian (Unit Test)
Untuk memastikan perhitungan subtotal, pajak, pembulatan uang, dan nomor transaksi akurat:
```powershell
go test -v ./services
```

Pemeriksaan tambahan:
```powershell
go vet ./...
go build ./...
```

### 3. Menjalankan Aplikasi
```powershell
go run main.go
```

Aplikasi dapat langsung diakses melalui peramban web di:
- **Halaman Masuk/Daftar:** `http://localhost:8080/login`
- **Dashboard:** `http://localhost:8080/`

---

## Cara Mengunggah Logo & Mengatur Identitas Dokumen

1. Masuk ke dashboard.
2. Klik tombol **⚙️ Pengaturan** pada bilah navigasi.
3. Pada bagian **Logo Perusahaan**, klik **Pilih Logo** lalu pilih file PNG, JPG, atau WebP (maks. 2 MB).
4. Isi identitas perusahaan dan informasi rekening pembayaran, lalu klik **Simpan Pengaturan**.
5. Logo dan identitas tersebut otomatis muncul pada:
   - Pratinjau dokumen penawaran dan invoice.
   - Hasil ekspor PDF (tombol **📄 PDF** pada tabel atau **📥 Unduh PDF** pada detail).
   - Hasil cetak / Print to PDF (**🖨️ Cetak**).

---

## Catatan Teknis

- Perhitungan pajak dan total dibulatkan ke dua angka desimal di backend dan frontend agar hasil konsisten.
- Nomor dokumen otomatis memakai angka acak kriptografis dan diperiksa keunikan sebelum disimpan.
- Quotation yang sudah dikonversi menjadi invoice tidak dapat dihapus agar riwayat transaksi tetap utuh.
- Jika database belum terhubung, endpoint API mengembalikan `503` dengan pesan yang jelas (bukan panic).
- File `.env` tidak boleh di-commit; gunakan `.env.example` sebagai referensi.
