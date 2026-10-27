package services

import (
	"crypto/rand"
	"fmt"
	"math"
	"math/big"
	"time"

	"go_vibe/models"
)

type ItemInput struct {
	ItemName  string  `json:"item_name" binding:"required,max=200"`
	Quantity  int     `json:"quantity" binding:"required,min=1"`
	UnitPrice float64 `json:"unit_price" binding:"gte=0"`
}

// CalculateTotals menghitung Subtotal, Pajak, dan Grand Total secara otomatis
func CalculateTotals(items []ItemInput, taxRate float64) (subtotal float64, taxAmount float64, grandTotal float64, processedItems []models.TransactionItem) {
	if taxRate < 0 || taxRate > 100 {
		taxRate = 11.0
	}

	for _, item := range items {
		totalPrice := float64(item.Quantity) * item.UnitPrice
		subtotal += totalPrice

		processedItems = append(processedItems, models.TransactionItem{
			ItemName:   item.ItemName,
			Quantity:   item.Quantity,
			UnitPrice:  item.UnitPrice,
			TotalPrice: totalPrice,
		})
	}

	subtotal = roundToTwoDecimals(subtotal)
	taxAmount = roundToTwoDecimals((taxRate / 100.0) * subtotal)
	grandTotal = roundToTwoDecimals(subtotal + taxAmount)
	return subtotal, taxAmount, grandTotal, processedItems
}

// roundToTwoDecimals membulatkan nilai uang ke dua angka di belakang koma.
func roundToTwoDecimals(value float64) float64 {
	return math.Round(value*100) / 100
}

// randomSuffix menghasilkan 4 digit acak yang aman (1000 - 9999).
func randomSuffix() int64 {
	number, err := rand.Int(rand.Reader, big.NewInt(9000))
	if err != nil {
		return time.Now().UnixNano()%9000 + 1000
	}
	return number.Int64() + 1000
}

// GenerateQuotationNumber membuat nomor penawaran otomatis dengan format QUO-YYYYMMDD-XXXX
func GenerateQuotationNumber() string {
	dateStr := time.Now().Format("20060102")
	return fmt.Sprintf("QUO-%s-%d", dateStr, randomSuffix())
}

// GenerateInvoiceNumber membuat nomor tagihan otomatis dengan format INV-YYYYMMDD-XXXX
func GenerateInvoiceNumber() string {
	dateStr := time.Now().Format("20060102")
	return fmt.Sprintf("INV-%s-%d", dateStr, randomSuffix())
}
