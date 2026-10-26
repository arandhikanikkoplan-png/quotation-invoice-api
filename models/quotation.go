package models

import (
	"time"
)

// Status: draft, sent, accepted, rejected
type Quotation struct {
	ID              uint              `gorm:"primaryKey" json:"id"`
	UserID          uint              `gorm:"not null;index" json:"user_id"`
	CustomerID      uint              `gorm:"not null;index" json:"customer_id"`
	Customer        *Customer         `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	QuotationNumber string            `gorm:"size:50;not null" json:"quotation_number"`
	IssueDate       time.Time         `json:"issue_date"`
	Status          string            `gorm:"size:20;not null;default:'draft'" json:"status"`
	Subtotal        float64           `gorm:"not null;default:0" json:"subtotal"`
	TaxRate         float64           `gorm:"not null;default:11" json:"tax_rate"` // Persentase pajak, default 11%
	TaxAmount       float64           `gorm:"not null;default:0" json:"tax_amount"`
	GrandTotal      float64           `gorm:"not null;default:0" json:"grand_total"`
	Items           []TransactionItem `gorm:"-" json:"items,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}
