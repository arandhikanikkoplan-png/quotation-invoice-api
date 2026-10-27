package models

import (
	"time"
)

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Name     string `gorm:"size:100;not null" json:"name"`
	Email    string `gorm:"size:100;uniqueIndex;not null" json:"email"`
	Password string `gorm:"not null" json:"-"`

	// Identitas perusahaan yang dipakai pada dokumen penawaran & invoice
	CompanyName    string `gorm:"size:150" json:"company_name"`
	CompanyEmail   string `gorm:"size:100" json:"company_email"`
	CompanyPhone   string `gorm:"size:30" json:"company_phone"`
	CompanyWebsite string `gorm:"size:150" json:"company_website"`
	CompanyAddress string `gorm:"type:text" json:"company_address"`
	LogoURL        string `gorm:"size:255" json:"logo_url"`

	// Informasi pembayaran yang ditampilkan pada invoice
	BankName    string `gorm:"size:100" json:"bank_name"`
	BankAccount string `gorm:"size:50" json:"bank_account"`
	BankHolder  string `gorm:"size:150" json:"bank_holder"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Customers  []Customer  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Quotations []Quotation `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Invoices   []Invoice   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}
