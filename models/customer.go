package models

import (
	"time"
)

type Customer struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Name      string    `gorm:"size:150;not null" json:"name"`
	Email     string    `gorm:"size:100" json:"email"`
	Phone     string    `gorm:"size:30" json:"phone"`
	Address   string    `gorm:"type:text" json:"address"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Quotations []Quotation `gorm:"foreignKey:CustomerID" json:"-"`
	Invoices   []Invoice   `gorm:"foreignKey:CustomerID" json:"-"`
}
