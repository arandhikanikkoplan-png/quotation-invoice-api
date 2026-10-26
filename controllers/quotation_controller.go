package controllers

import (
	"net/http"
	"time"

	"go_vibe/config"
	"go_vibe/models"
	"go_vibe/services"

	"github.com/gin-gonic/gin"
)

type CreateQuotationInput struct {
	CustomerID      uint                 `json:"customer_id" binding:"required"`
	QuotationNumber string               `json:"quotation_number"`
	IssueDate       string               `json:"issue_date"` // format YYYY-MM-DD
	TaxRate         *float64             `json:"tax_rate"`   // opsional, default 11%
	Items           []services.ItemInput `json:"items" binding:"required,min=1"`
}

type UpdateStatusInput struct {
	Status string `json:"status" binding:"required"`
}

// GetQuotations mengambil daftar penawaran harga milik pengguna
func GetQuotations(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var quotations []models.Quotation
	if err := config.DB.Preload("Customer").Where("user_id = ?", userID).Order("id desc").Find(&quotations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar quotation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"quotations": quotations})
}

// GetQuotationDetail mengambil detail lengkap penawaran beserta item-itemnya
func GetQuotationDetail(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var quotation models.Quotation
	if err := config.DB.Preload("Customer").Where("id = ? AND user_id = ?", id, userID).First(&quotation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	// Ambil item transaksi
	var items []models.TransactionItem
	config.DB.Where("transaction_type = ? AND transaction_id = ?", "quotation", quotation.ID).Find(&items)
	quotation.Items = items

	c.JSON(http.StatusOK, gin.H{"quotation": quotation})
}

// CreateQuotation membuat penawaran harga baru beserta item-itemnya
func CreateQuotation(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var input CreateQuotationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	// Validasi kepemilikan Customer
	var customer models.Customer
	if err := config.DB.Where("id = ? AND user_id = ?", input.CustomerID, userID).First(&customer).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pelanggan tidak valid atau bukan milik Anda"})
		return
	}

	taxRate := 11.0
	if input.TaxRate != nil {
		taxRate = *input.TaxRate
	}

	subtotal, taxAmount, grandTotal, processedItems := services.CalculateTotals(input.Items, taxRate)

	quoNumber := input.QuotationNumber
	if quoNumber == "" {
		quoNumber = services.GenerateQuotationNumber()
	}

	issueDate := time.Now()
	if input.IssueDate != "" {
		if parsedDate, err := time.Parse("2006-01-02", input.IssueDate); err == nil {
			issueDate = parsedDate
		}
	}

	quotation := models.Quotation{
		UserID:          userID,
		CustomerID:      customer.ID,
		QuotationNumber: quoNumber,
		IssueDate:       issueDate,
		Status:          "draft",
		Subtotal:        subtotal,
		TaxRate:         taxRate,
		TaxAmount:       taxAmount,
		GrandTotal:      grandTotal,
	}

	// Simpan dalam transaksi database
	tx := config.DB.Begin()
	if err := tx.Create(&quotation).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan quotation"})
		return
	}

	for i := range processedItems {
		processedItems[i].TransactionType = "quotation"
		processedItems[i].TransactionID = quotation.ID
		if err := tx.Create(&processedItems[i]).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan item quotation"})
			return
		}
	}

	tx.Commit()

	quotation.Items = processedItems
	quotation.Customer = &customer
	c.JSON(http.StatusCreated, gin.H{
		"message":   "Quotation berhasil dibuat",
		"quotation": quotation,
	})
}

// UpdateQuotationStatus mengubah status quotation (draft, sent, accepted, rejected)
func UpdateQuotationStatus(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var quotation models.Quotation
	if err := config.DB.Where("id = ? AND user_id = ?", id, userID).First(&quotation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	var input UpdateStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input status tidak valid"})
		return
	}

	validStatuses := map[string]bool{
		"draft":    true,
		"sent":     true,
		"accepted": true,
		"rejected": true,
	}

	if !validStatuses[input.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status harus salah satu dari: draft, sent, accepted, rejected"})
		return
	}

	quotation.Status = input.Status
	if err := config.DB.Save(&quotation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status quotation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Status quotation berhasil diperbarui",
		"quotation": quotation,
	})
}

// ConvertQuotationToInvoice mengubah quotation yang berstatus accepted menjadi invoice
func ConvertQuotationToInvoice(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var quotation models.Quotation
	if err := config.DB.Where("id = ? AND user_id = ?", id, userID).First(&quotation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	if quotation.Status != "accepted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya quotation dengan status 'accepted' yang dapat diubah menjadi invoice"})
		return
	}

	// Ambil item dari quotation
	var items []models.TransactionItem
	config.DB.Where("transaction_type = ? AND transaction_id = ?", "quotation", quotation.ID).Find(&items)

	now := time.Now()
	invoice := models.Invoice{
		UserID:        userID,
		CustomerID:    quotation.CustomerID,
		QuotationID:   &quotation.ID,
		InvoiceNumber: services.GenerateInvoiceNumber(),
		IssueDate:     now,
		DueDate:       now.AddDate(0, 0, 14), // Default jatuh tempo 14 hari
		Status:        "unpaid",
		Subtotal:      quotation.Subtotal,
		TaxRate:       quotation.TaxRate,
		TaxAmount:     quotation.TaxAmount,
		GrandTotal:    quotation.GrandTotal,
	}

	tx := config.DB.Begin()
	if err := tx.Create(&invoice).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat invoice dari quotation"})
		return
	}

	var invoiceItems []models.TransactionItem
	for _, item := range items {
		newItem := models.TransactionItem{
			TransactionType: "invoice",
			TransactionID:   invoice.ID,
			ItemName:        item.ItemName,
			Quantity:        item.Quantity,
			UnitPrice:       item.UnitPrice,
			TotalPrice:      item.TotalPrice,
		}
		if err := tx.Create(&newItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyalin item ke invoice"})
			return
		}
		invoiceItems = append(invoiceItems, newItem)
	}

	tx.Commit()

	invoice.Items = invoiceItems
	c.JSON(http.StatusCreated, gin.H{
		"message": "Quotation berhasil dikonversi menjadi invoice",
		"invoice": invoice,
	})
}

// DeleteQuotation menghapus penawaran beserta item-itemnya
func DeleteQuotation(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var quotation models.Quotation
	if err := config.DB.Where("id = ? AND user_id = ?", id, userID).First(&quotation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	tx := config.DB.Begin()
	if err := tx.Where("transaction_type = ? AND transaction_id = ?", "quotation", quotation.ID).Delete(&models.TransactionItem{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus item quotation"})
		return
	}

	if err := tx.Delete(&quotation).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus quotation"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Quotation berhasil dihapus"})
}
