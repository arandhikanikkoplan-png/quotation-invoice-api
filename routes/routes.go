package routes

import (
	"log"
	"net/http"
	"os"

	"go_vibe/controllers"
	"go_vibe/middlewares"

	"github.com/gin-gonic/gin"
)

// SetupRouter mengonfigurasi seluruh endpoint REST API dan file statis
func SetupRouter() *gin.Engine {
	r := gin.Default()

	// Pastikan folder unggahan logo tersedia saat aplikasi dijalankan.
	if err := os.MkdirAll("./public/uploads/logos", 0o755); err != nil {
		log.Printf("[PERINGATAN] Gagal menyiapkan folder logo: %v\n", err)
	}

	// Layani file statis frontend jika ada
	r.Static("/static", "./public")
	r.StaticFile("/", "./public/index.html")
	r.StaticFile("/login", "./public/login.html")

	// Endpoint health check
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Quotation & Invoice API berjalan normal",
		})
	})

	api := r.Group("/api")
	api.Use(middlewares.RequireDatabase())
	{
		// Rute Autentikasi Publik
		auth := api.Group("/auth")
		{
			auth.POST("/register", controllers.Register)
			auth.POST("/login", controllers.Login)
		}

		// Rute Terproteksi (Wajib Login & menyertakan JWT)
		protected := api.Group("")
		protected.Use(middlewares.AuthRequired())
		{
			// Profil dan pengaturan perusahaan (logo, kontak, rekening)
			protected.GET("/auth/profile", controllers.GetProfile)
			protected.PUT("/auth/profile", controllers.UpdateProfile)
			protected.POST("/auth/logo", controllers.UploadLogo)
			protected.DELETE("/auth/logo", controllers.DeleteLogo)

			// Manajemen Pelanggan (Customers)
			protected.GET("/customers", controllers.GetCustomers)
			protected.GET("/customers/:id", controllers.GetCustomerDetail)
			protected.POST("/customers", controllers.CreateCustomer)
			protected.PUT("/customers/:id", controllers.UpdateCustomer)
			protected.DELETE("/customers/:id", controllers.DeleteCustomer)

			// Manajemen Penawaran Harga (Quotations)
			protected.GET("/quotations", controllers.GetQuotations)
			protected.GET("/quotations/:id", controllers.GetQuotationDetail)
			protected.POST("/quotations", controllers.CreateQuotation)
			protected.PATCH("/quotations/:id/status", controllers.UpdateQuotationStatus)
			protected.POST("/quotations/:id/convert-to-invoice", controllers.ConvertQuotationToInvoice)
			protected.DELETE("/quotations/:id", controllers.DeleteQuotation)

			// Manajemen Tagihan (Invoices)
			protected.GET("/invoices", controllers.GetInvoices)
			protected.GET("/invoices/:id", controllers.GetInvoiceDetail)
			protected.POST("/invoices", controllers.CreateInvoice)
			protected.PATCH("/invoices/:id/status", controllers.UpdateInvoiceStatus)
			protected.DELETE("/invoices/:id", controllers.DeleteInvoice)
		}
	}

	return r
}
