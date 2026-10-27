package controllers

import (
	"errors"
	"strings"
	"time"

	"go_vibe/config"
	"go_vibe/models"
	"go_vibe/services"
)

const dateLayout = "2006-01-02"

// resolveTaxRate memvalidasi persentase pajak. Nilai kosong memakai 11%.
func resolveTaxRate(rate *float64) (float64, error) {
	if rate == nil {
		return 11.0, nil
	}
	if *rate < 0 || *rate > 100 {
		return 0, errors.New("persentase pajak harus berada di antara 0 sampai 100")
	}
	return *rate, nil
}

// parseDateOrDefault mengubah string YYYY-MM-DD menjadi time.Time.
func parseDateOrDefault(value string, fallback time.Time) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback, nil
	}

	parsed, err := time.Parse(dateLayout, value)
	if err != nil {
		return time.Time{}, errors.New("format tanggal harus YYYY-MM-DD")
	}
	return parsed, nil
}

// generateUniqueQuotationNumber memastikan nomor penawaran belum dipakai.
func generateUniqueQuotationNumber() string {
	number := services.GenerateQuotationNumber()
	for attempt := 0; attempt < 8; attempt++ {
		var count int64
		err := config.DB.Model(&models.Quotation{}).Where("quotation_number = ?", number).Count(&count).Error
		if err != nil || count == 0 {
			return number
		}
		number = services.GenerateQuotationNumber()
	}
	return number
}

// generateUniqueInvoiceNumber memastikan nomor invoice belum dipakai.
func generateUniqueInvoiceNumber() string {
	number := services.GenerateInvoiceNumber()
	for attempt := 0; attempt < 8; attempt++ {
		var count int64
		err := config.DB.Model(&models.Invoice{}).Where("invoice_number = ?", number).Count(&count).Error
		if err != nil || count == 0 {
			return number
		}
		number = services.GenerateInvoiceNumber()
	}
	return number
}

// numberAlreadyUsed memeriksa nomor dokumen yang diinput manual pengguna.
func numberAlreadyUsed(model interface{}, column string, number string) bool {
	var count int64
	config.DB.Model(model).Where(column+" = ?", number).Count(&count)
	return count > 0
}
