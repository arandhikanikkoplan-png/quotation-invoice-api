package services

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"go_vibe/models"
)

type ItemInput struct {
	ItemName  string  `json:"item_name" binding:"required"`
	Quantity  int     `json:"quantity" binding:"required,min=1"`
	UnitPrice float64 `json:"unit_price" binding:"required,min=0"`
}

// CalculateTotals menghitung Subtotal, Pajak, dan Grand Total secara otomatis
func CalculateTotals(items []ItemInput, taxRate float64) (subtotal float64, taxAmount float64, grandTotal float64, processedItems []models.TransactionItem) {
	if taxRate < 0 {
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

	taxAmount = math.Round((taxRate/100.0)*subtotal*100) / 100
	grandTotal = subtotal + taxAmount
	return subtotal, taxAmount, grandTotal, processedItems
}

// GenerateQuotationNumber membuat nomor penawaran otomatis dengan format QUO-YYYYMMDD-XXXX
func GenerateQuotationNumber() string {
	dateStr := time.Now().Format("20060102")
	randomNum := rand.Intn(9000) + 1000
	return fmt.Sprintf("QUO-%s-%d", dateStr, randomNum)
}

// GenerateInvoiceNumber membuat nomor tagihan otomatis dengan format INV-YYYYMMDD-XXXX
func GenerateInvoiceNumber() string {
	dateStr := time.Now().Format("20060102")
	randomNum := rand.Intn(9000) + 1000
	return fmt.Sprintf("INV-%s-%d", dateStr, randomNum)
}
