package controllers

import (
	"net/http"
	"strings"
	"time"

	"go_vibe/config"
	"go_vibe/models"
	"go_vibe/services"

	"github.com/gin-gonic/gin"
)

type CreateInvoiceInput struct {
	CustomerID    uint                 `json:"customer_id" binding:"required"`
	InvoiceNumber string               `json:"invoice_number"`
	IssueDate     string               `json:"issue_date"` // YYYY-MM-DD
	DueDate       string               `json:"due_date"`   // YYYY-MM-DD
	TaxRate       *float64             `json:"tax_rate"`   // opsional, default 11%
	Items         []services.ItemInput `json:"items" binding:"required,min=1,dive"`
}

// GetInvoices mengambil daftar tagihan milik pengguna
func GetInvoices(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var invoices []models.Invoice
	if err := config.DB.Preload("Customer").Preload("Quotation").Where("user_id = ?", userID).Order("id desc").Find(&invoices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar invoice"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"invoices": invoices})
}

// GetInvoiceDetail mengambil detail lengkap tagihan beserta item-itemnya
func GetInvoiceDetail(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var invoice models.Invoice
	if err := config.DB.Preload("Customer").Preload("Quotation").Where("id = ? AND user_id = ?", id, userID).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	var items []models.TransactionItem
	config.DB.Where("transaction_type = ? AND transaction_id = ?", "invoice", invoice.ID).Find(&items)
	invoice.Items = items

	c.JSON(http.StatusOK, gin.H{"invoice": invoice})
}

// CreateInvoice membuat invoice secara langsung tanpa penawaran
func CreateInvoice(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var input CreateInvoiceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	var customer models.Customer
	if err := config.DB.Where("id = ? AND user_id = ?", input.CustomerID, userID).First(&customer).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pelanggan tidak valid atau bukan milik Anda"})
		return
	}

	taxRate, err := resolveTaxRate(input.TaxRate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, item := range input.Items {
		if strings.TrimSpace(item.ItemName) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nama item produk/layanan tidak boleh kosong"})
			return
		}
	}

	subtotal, taxAmount, grandTotal, processedItems := services.CalculateTotals(input.Items, taxRate)
	for i := range processedItems {
		processedItems[i].ItemName = strings.TrimSpace(processedItems[i].ItemName)
	}

	invNumber := strings.TrimSpace(input.InvoiceNumber)
	if len(invNumber) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor invoice maksimal 50 karakter"})
		return
	}
	if invNumber == "" {
		invNumber = generateUniqueInvoiceNumber()
	} else if numberAlreadyUsed(&models.Invoice{}, "invoice_number", invNumber) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor invoice sudah digunakan"})
		return
	}

	issueDate, err := parseDateOrDefault(input.IssueDate, time.Now())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dueDate, err := parseDateOrDefault(input.DueDate, issueDate.AddDate(0, 0, 14))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if dueDate.Before(issueDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal jatuh tempo tidak boleh sebelum tanggal terbit"})
		return
	}

	invoice := models.Invoice{
		UserID:        userID,
		CustomerID:    customer.ID,
		InvoiceNumber: invNumber,
		IssueDate:     issueDate,
		DueDate:       dueDate,
		Status:        "unpaid",
		Subtotal:      subtotal,
		TaxRate:       taxRate,
		TaxAmount:     taxAmount,
		GrandTotal:    grandTotal,
	}

	tx := config.DB.Begin()
	if err := tx.Create(&invoice).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan invoice"})
		return
	}

	for i := range processedItems {
		processedItems[i].TransactionType = "invoice"
		processedItems[i].TransactionID = invoice.ID
		if err := tx.Create(&processedItems[i]).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan item invoice"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan penyimpanan invoice"})
		return
	}

	invoice.Items = processedItems
	invoice.Customer = &customer
	c.JSON(http.StatusCreated, gin.H{
		"message": "Invoice berhasil dibuat",
		"invoice": invoice,
	})
}

// UpdateInvoiceStatus memperbarui status tagihan (unpaid, paid, cancelled)
func UpdateInvoiceStatus(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var invoice models.Invoice
	if err := config.DB.Where("id = ? AND user_id = ?", id, userID).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	var input UpdateStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input status tidak valid"})
		return
	}

	validStatuses := map[string]bool{
		"unpaid":    true,
		"paid":      true,
		"cancelled": true,
	}

	if !validStatuses[input.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status harus salah satu dari: unpaid, paid, cancelled"})
		return
	}

	invoice.Status = input.Status
	if err := config.DB.Save(&invoice).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status invoice"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Status invoice berhasil diperbarui",
		"invoice": invoice,
	})
}

// DeleteInvoice menghapus invoice beserta item-itemnya
func DeleteInvoice(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var invoice models.Invoice
	if err := config.DB.Where("id = ? AND user_id = ?", id, userID).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	tx := config.DB.Begin()
	if err := tx.Where("transaction_type = ? AND transaction_id = ?", "invoice", invoice.ID).Delete(&models.TransactionItem{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus item invoice"})
		return
	}

	if err := tx.Delete(&invoice).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus invoice"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan penghapusan invoice"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Invoice berhasil dihapus"})
}
