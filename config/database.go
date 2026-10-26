package config

import (
	"errors"
	"fmt"
	"log"
	"os"

	"go_vibe/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB menginisialisasi koneksi database PostgreSQL menggunakan DATABASE_URL
func InitDB() (*gorm.DB, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, errors.New("variabel lingkungan DATABASE_URL belum diatur. Silakan periksa file .env")
	}

	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("gagal terhubung ke database PostgreSQL: %v", err)
	}

	log.Println("Koneksi database PostgreSQL berhasil diinisialisasi.")

	// Auto-migration untuk membuat atau memperbarui tabel otomatis
	err = db.AutoMigrate(
		&models.User{},
		&models.Customer{},
		&models.Quotation{},
		&models.Invoice{},
		&models.TransactionItem{},
	)
	if err != nil {
		return nil, fmt.Errorf("gagal melakukan migrasi tabel: %v", err)
	}

	log.Println("Migrasi tabel database berhasil dilakukan.")
	DB = db
	return DB, nil
}
