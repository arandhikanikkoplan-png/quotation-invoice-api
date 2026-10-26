package controllers

import (
	"net/http"

	"go_vibe/config"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
)

type CustomerInput struct {
	Name    string `json:"name" binding:"required"`
	Email   string `json:"email"`
	Phone   string `json:"phone"`
	Address string `json:"address"`
}

// GetCustomers mengambil daftar seluruh pelanggan milik pengguna yang sedang login
func GetCustomers(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var customers []models.Customer
	if err := config.DB.Where("user_id = ?", userID).Order("id desc").Find(&customers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar pelanggan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"customers": customers})
}

// GetCustomerDetail mengambil detail satu pelanggan berdasarkan ID
func GetCustomerDetail(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var customer models.Customer
	if err := config.DB.Where("id = ? AND user_id = ?", id, userID).First(&customer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"customer": customer})
}

// CreateCustomer menambahkan pelanggan baru untuk pengguna yang login
func CreateCustomer(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)

	var input CustomerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	customer := models.Customer{
		UserID:  userID,
		Name:    input.Name,
		Email:   input.Email,
		Phone:   input.Phone,
		Address: input.Address,
	}

	if err := config.DB.Create(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data pelanggan"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Pelanggan berhasil ditambahkan",
		"customer": customer,
	})
}

// UpdateCustomer memperbarui data pelanggan
func UpdateCustomer(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var customer models.Customer
	if err := config.DB.Where("id = ? AND user_id = ?", id, userID).First(&customer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	var input CustomerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	customer.Name = input.Name
	customer.Email = input.Email
	customer.Phone = input.Phone
	customer.Address = input.Address

	if err := config.DB.Save(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data pelanggan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Data pelanggan berhasil diperbarui",
		"customer": customer,
	})
}

// DeleteCustomer menghapus pelanggan jika tidak memiliki transaksi terkait
func DeleteCustomer(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	id := c.Param("id")

	var customer models.Customer
	if err := config.DB.Where("id = ? AND user_id = ?", id, userID).First(&customer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	// Periksa apakah pelanggan memiliki transaksi terkait di Quotation
	var quotationCount int64
	config.DB.Model(&models.Quotation{}).Where("customer_id = ?", customer.ID).Count(&quotationCount)
	if quotationCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Pelanggan tidak dapat dihapus karena masih memiliki penawaran harga (quotation) terkait",
		})
		return
	}

	// Periksa apakah pelanggan memiliki transaksi terkait di Invoice
	var invoiceCount int64
	config.DB.Model(&models.Invoice{}).Where("customer_id = ?", customer.ID).Count(&invoiceCount)
	if invoiceCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Pelanggan tidak dapat dihapus karena masih memiliki tagihan (invoice) terkait",
		})
		return
	}

	if err := config.DB.Delete(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus pelanggan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pelanggan berhasil dihapus"})
}
