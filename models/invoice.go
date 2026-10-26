package models

import (
	"time"
)

// Status: unpaid, paid, cancelled
type Invoice struct {
	ID            uint              `gorm:"primaryKey" json:"id"`
	UserID        uint              `gorm:"not null;index" json:"user_id"`
	CustomerID    uint              `gorm:"not null;index" json:"customer_id"`
	Customer      *Customer         `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	QuotationID   *uint             `gorm:"index" json:"quotation_id,omitempty"`
	Quotation     *Quotation        `gorm:"foreignKey:QuotationID" json:"quotation,omitempty"`
	InvoiceNumber string            `gorm:"size:50;not null;uniqueIndex" json:"invoice_number"`
	IssueDate     time.Time         `json:"issue_date"`
	DueDate       time.Time         `json:"due_date"`
	Status        string            `gorm:"size:20;not null;default:'unpaid'" json:"status"`
	Subtotal      float64           `gorm:"not null;default:0" json:"subtotal"`
	TaxRate       float64           `gorm:"not null;default:11" json:"tax_rate"` // Default 11%
	TaxAmount     float64           `gorm:"not null;default:0" json:"tax_amount"`
	GrandTotal    float64           `gorm:"not null;default:0" json:"grand_total"`
	Items         []TransactionItem `gorm:"-" json:"items,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}
