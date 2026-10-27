package middlewares

import (
	"net/http"

	"go_vibe/config"

	"github.com/gin-gonic/gin"
)

// RequireDatabase menjaga agar API tidak panic ketika koneksi database gagal.
func RequireDatabase() gin.HandlerFunc {
	return func(c *gin.Context) {
		if config.DB == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "Database belum terhubung. Periksa layanan PostgreSQL dan konfigurasi DATABASE_URL.",
			})
			return
		}
		c.Next()
	}
}
