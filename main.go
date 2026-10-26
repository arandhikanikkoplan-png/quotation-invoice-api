package main

import (
	"log"
	"os"

	"go_vibe/config"
	"go_vibe/routes"

	"github.com/joho/godotenv"
)

func main() {
	// Muat file .env jika ada
	if err := godotenv.Load(); err != nil {
		log.Println("Peringatan: File .env tidak ditemukan, menggunakan environment variable sistem.")
	}

	// Inisialisasi koneksi Database PostgreSQL
	_, err := config.InitDB()
	if err != nil {
		log.Printf("[PERINGATAN KONFIGURASI] %v\n", err)
		log.Println("Pastikan layanan PostgreSQL berjalan dan DATABASE_URL pada file .env sudah sesuai.")
		log.Println("Format contoh: postgres://postgres:password@localhost:5432/quotation_invoice_db?sslmode=disable")
	}

	// Baca port aplikasi dari environment variable
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("APP_PORT")
	}
	if port == "" {
		port = "8080"
	}

	// Setup routing aplikasi
	router := routes.SetupRouter()

	log.Printf("Server Quotation & Invoice API berjalan di port %s (http://localhost:%s)\n", port, port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
