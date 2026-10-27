package controllers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go_vibe/config"
	"go_vibe/middlewares"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const (
	logoDirectory = "public/uploads/logos"
	logoURLPrefix = "/static/uploads/logos/"
	maxLogoSize   = 2 * 1024 * 1024 // 2 MB
)

type RegisterInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UpdateProfileInput berisi identitas perusahaan yang tampil pada dokumen.
type UpdateProfileInput struct {
	CompanyName    string `json:"company_name"`
	CompanyEmail   string `json:"company_email"`
	CompanyPhone   string `json:"company_phone"`
	CompanyWebsite string `json:"company_website"`
	CompanyAddress string `json:"company_address"`
	BankName       string `json:"bank_name"`
	BankAccount    string `json:"bank_account"`
	BankHolder     string `json:"bank_holder"`
}

// userPayload menyusun data profil yang aman untuk dikirim ke frontend.
func userPayload(user models.User) gin.H {
	return gin.H{
		"id":              user.ID,
		"name":            user.Name,
		"email":           user.Email,
		"company_name":    user.CompanyName,
		"company_email":   user.CompanyEmail,
		"company_phone":   user.CompanyPhone,
		"company_website": user.CompanyWebsite,
		"company_address": user.CompanyAddress,
		"logo_url":        user.LogoURL,
		"bank_name":       user.BankName,
		"bank_account":    user.BankAccount,
		"bank_holder":     user.BankHolder,
		"created_at":      user.CreatedAt,
	}
}

// Register menangani pendaftaran pengguna baru
func Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))

	// Periksa apakah email sudah terdaftar (tidak membedakan huruf besar/kecil)
	var existingUser models.User
	if err := config.DB.Where("LOWER(email) = ?", input.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email sudah digunakan oleh akun lain"})
		return
	}

	// Hash password menggunakan bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengenkripsi kata sandi"})
		return
	}

	user := models.User{
		Name:     input.Name,
		Email:    input.Email,
		Password: string(hashedPassword),
	}

	if err := config.DB.Create(&user).Error; err != nil {
		// Tangani kemungkinan dua permintaan mendaftar dengan email yang sama.
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") ||
			strings.Contains(strings.ToLower(err.Error()), "unique") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email sudah digunakan oleh akun lain"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan pengguna baru"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Pendaftaran berhasil",
		"user":    userPayload(user),
	})
}

// Login menangani autentikasi pengguna dan mengembalikan token JWT
func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))

	var user models.User
	if err := config.DB.Where("LOWER(email) = ?", email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau kata sandi salah"})
		return
	}

	// Bandingkan password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau kata sandi salah"})
		return
	}

	// Buat token JWT
	token, err := middlewares.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token autentikasi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login berhasil",
		"token":   token,
		"user":    userPayload(user),
	})
}

// GetProfile mengembalikan data profil pengguna yang sedang login
func GetProfile(c *gin.Context) {
	user, err := currentUser(c)
	if err != nil {
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": userPayload(user)})
}

// UpdateProfile memperbarui identitas perusahaan, logo, dan info pembayaran.
func UpdateProfile(c *gin.Context) {
	user, err := currentUser(c)
	if err != nil {
		return
	}

	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	user.CompanyName = strings.TrimSpace(input.CompanyName)
	user.CompanyEmail = strings.TrimSpace(input.CompanyEmail)
	user.CompanyPhone = strings.TrimSpace(input.CompanyPhone)
	user.CompanyWebsite = strings.TrimSpace(input.CompanyWebsite)
	user.CompanyAddress = strings.TrimSpace(input.CompanyAddress)
	user.BankName = strings.TrimSpace(input.BankName)
	user.BankAccount = strings.TrimSpace(input.BankAccount)
	user.BankHolder = strings.TrimSpace(input.BankHolder)

	if len(user.CompanyName) > 150 || len(user.CompanyEmail) > 100 ||
		len(user.CompanyPhone) > 30 || len(user.CompanyWebsite) > 150 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Panjang data perusahaan melebihi batas yang diizinkan"})
		return
	}

	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan pengaturan perusahaan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Pengaturan perusahaan berhasil disimpan",
		"user":    userPayload(user),
	})
}

// UploadLogo menyimpan logo perusahaan dan mengaitkannya dengan akun pengguna.
func UploadLogo(c *gin.Context) {
	user, err := currentUser(c)
	if err != nil {
		return
	}

	file, err := c.FormFile("logo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File logo wajib dipilih"})
		return
	}

	if file.Size > maxLogoSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ukuran logo maksimal 2 MB"})
		return
	}

	// Validasi isi file, bukan hanya ekstensi, agar file berbahaya ditolak.
	opened, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membaca file logo"})
		return
	}
	header := make([]byte, 512)
	n, readErr := opened.Read(header)
	opened.Close()
	if readErr != nil && !errors.Is(readErr, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal memeriksa file logo"})
		return
	}

	contentType := http.DetectContentType(header[:n])
	allowedExtensions := map[string]string{
		"image/png":  ".png",
		"image/jpeg": ".jpg",
		"image/webp": ".webp",
	}
	extension, ok := allowedExtensions[contentType]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format logo harus PNG, JPG, atau WebP"})
		return
	}

	if err := os.MkdirAll(logoDirectory, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan folder penyimpanan logo"})
		return
	}

	filename := fmt.Sprintf("logo_%d_%d%s", user.ID, time.Now().UnixNano(), extension)
	destination := filepath.Join(logoDirectory, filename)
	if err := c.SaveUploadedFile(file, destination); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file logo"})
		return
	}

	oldLogo := user.LogoURL
	user.LogoURL = logoURLPrefix + filename
	if err := config.DB.Save(&user).Error; err != nil {
		_ = os.Remove(destination)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data logo"})
		return
	}

	removeLogoFile(oldLogo)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Logo berhasil diunggah",
		"logo_url": user.LogoURL,
		"user":     userPayload(user),
	})
}

// DeleteLogo menghapus logo perusahaan dari akun dan penyimpanan.
func DeleteLogo(c *gin.Context) {
	user, err := currentUser(c)
	if err != nil {
		return
	}

	if user.LogoURL == "" {
		c.JSON(http.StatusOK, gin.H{
			"message": "Akun ini belum memiliki logo",
			"user":    userPayload(user),
		})
		return
	}

	oldLogo := user.LogoURL
	user.LogoURL = ""
	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus logo"})
		return
	}

	removeLogoFile(oldLogo)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logo berhasil dihapus",
		"user":    userPayload(user),
	})
}

// currentUser mengambil pengguna yang sedang login dari context JWT.
func currentUser(c *gin.Context) (models.User, error) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Pengguna tidak terautentikasi"})
		return models.User{}, errors.New("pengguna tidak terautentikasi")
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data pengguna tidak ditemukan"})
		return models.User{}, err
	}
	return user, nil
}

// removeLogoFile hanya menghapus file yang memang tersimpan di folder logo.
func removeLogoFile(logoURL string) {
	if !strings.HasPrefix(logoURL, logoURLPrefix) {
		return
	}
	filename := filepath.Base(logoURL)
	if filename == "." || filename == string(filepath.Separator) {
		return
	}
	_ = os.Remove(filepath.Join(logoDirectory, filename))
}
