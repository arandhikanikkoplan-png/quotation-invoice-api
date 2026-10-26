# Quotation & Invoice API

Aplikasi REST API dan Antarmuka Web untuk mengelola Penawaran Harga (*Quotation*) dan Tagihan Penjualan (*Invoice*) secara digital.

Dibangun menggunakan:
- **Backend:** Go (Golang) dengan framework [Gin](https://gin-gonic.com/)
- **ORM:** [GORM](https://gorm.io/)
- **Database:** PostgreSQL
- **Autentikasi:** JWT (*JSON Web Tokens*) disimpan di `localStorage`
- **Frontend:** HTML, CSS, JavaScript murni (*Vanilla*)

---

## Fitur Utama

1. **Autentikasi Pengguna:**
   - Registrasi akun baru dengan kata sandi terenkripsi (*bcrypt*).
   - Login dengan pengembalian JWT token.
   - Proteksi kepemilikan data: setiap transaksi dan pelanggan hanya dapat diakses oleh pemiliknya.
2. **Manajemen Pelanggan (Customers):**
   - Tambah, lihat daftar, detail, ubah, dan hapus pelanggan.
   - Pelanggan tidak dapat dihapus jika masih memiliki penawaran atau tagihan terkait.
3. **Manajemen Penawaran Harga (Quotations):**
   - Pembuatan penawaran dengan penomoran otomatis (`QUO-YYYYMMDD-XXXX`).
   - Penambahan banyak item barang/jasa secara dinamis dengan input responsif.
   - Perhitungan otomatis subtotal, pajak PPN (default 11%), dan grand total.
   - Perubahan status: `draft`, `sent`, `accepted`, `rejected`.
   - Konversi langsung quotation yang berstatus `accepted` menjadi invoice.
   - Detail penawaran resmi berformat lembar dokumen bisnis profesional.
   - Ekspor penawaran ke file PDF berkualitas tinggi (langsung dari tabel atau detail).
4. **Manajemen Tagihan (Invoices):**
   - Pembuatan invoice langsung atau turunan dari quotation yang disetujui.
   - Penomoran otomatis (`INV-YYYYMMDD-XXXX`).
   - Penentuan tanggal terbit dan tanggal jatuh tempo.
   - Pengubahan status pembayaran: `unpaid`, `paid`, `cancelled`.
   - Detail faktur tagihan lengkap dengan instruksi transfer pembayaran, jatuh tempo, dan tanda tangan pengesahan.
   - Ekspor invoice ke file PDF berkualitas tinggi (langsung dari tabel atau detail).
5. **Antarmuka Web Modern & Responsif di Segala Resolusi:**
   - Mendukung penuh resolusi *Mobile* (ponsel layar kecil < 480px & standar < 768px), *Tablet* (768px - 992px), *Desktop* (1024px - 1440px), serta layar lebar *Ultra-wide* (> 1400px).
   - Tabel responsif (*horizontal scroll* halus tanpa merusak tata letak).
   - Pratinjau dokumen penawaran dan invoice bergaya A4 resmi.
   - Optimasi Cetak / Print to PDF berstandar A4 (`@media print`).

---

## Struktur Folder

```text
go_vibe/
├── config/
│   └── database.go            # Konfigurasi GORM dan koneksi PostgreSQL
├── controllers/               # Handler HTTP REST API
│   ├── auth_controller.go     # Registrasi dan login
│   ├── customer_controller.go # Pengelolaan pelanggan
│   ├── quotation_controller.go# Pengelolaan quotation & konversi ke invoice
│   └── invoice_controller.go  # Pengelolaan invoice & status pembayaran
├── middlewares/
│   └── auth_middleware.go     # Middleware validasi token JWT
├── models/                    # Definisi model & migrasi database
│   ├── user.go
│   ├── customer.go
│   ├── quotation.go
│   ├── invoice.go
│   └── transaction_item.go
├── routes/
│   └── routes.go              # Routing API Gin & penyajian file statis
├── services/                  # Logika bisnis & kalkulasi otomatis
│   ├── transaction_service.go
│   └── transaction_service_test.go
├── public/                    # Frontend HTML, CSS, JS
│   ├── index.html
│   ├── login.html
│   ├── css/style.css
│   └── js/app.js
├── .env.example
├── .gitignore
├── go.mod
├── go.sum
├── main.go
└── README.md
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

### 2. Jalankan Pengujian (Unit Test)
Untuk memastikan perhitungan subtotal, pajak, dan nomor transaksi akurat:
```powershell
go test -v ./services
```

### 3. Menjalankan Aplikasi
```powershell
go run main.go
```

Aplikasi dapat langsung diakses melalui peramban web di:
- **Halaman Masuk/Daftar:** `http://localhost:8080/login`
- **Dashboard:** `http://localhost:8080/`
