package models

import (
	"time"
)

type TransactionItem struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	TransactionType string    `gorm:"size:20;not null;index" json:"transaction_type"` // "quotation" atau "invoice"
	TransactionID   uint      `gorm:"not null;index" json:"transaction_id"`
	ItemName        string    `gorm:"size:200;not null" json:"item_name"`
	Quantity        int       `gorm:"not null;default:1" json:"quantity"`
	UnitPrice       float64   `gorm:"not null;default:0" json:"unit_price"`
	TotalPrice      float64   `gorm:"not null;default:0" json:"total_price"` // Quantity * UnitPrice
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
