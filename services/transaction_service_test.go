package services

import (
	"strings"
	"testing"
)

func TestCalculateTotals(t *testing.T) {
	items := []ItemInput{
		{
			ItemName:  "Desain Logo",
			Quantity:  2,
			UnitPrice: 500000,
		},
		{
			ItemName:  "Pengembangan Website",
			Quantity:  1,
			UnitPrice: 2000000,
		},
	}

	taxRate := 11.0
	subtotal, taxAmount, grandTotal, processedItems := CalculateTotals(items, taxRate)

	// Subtotal = (2 * 500,000) + (1 * 2,000,000) = 3,000,000
	expectedSubtotal := 3000000.0
	if subtotal != expectedSubtotal {
		t.Errorf("Subtotal salah: diharapkan %.2f, didapatkan %.2f", expectedSubtotal, subtotal)
	}

	// Pajak 11% = 11% * 3,000,000 = 330,000
	expectedTax := 330000.0
	if taxAmount != expectedTax {
		t.Errorf("Pajak salah: diharapkan %.2f, didapatkan %.2f", expectedTax, taxAmount)
	}

	// Grand Total = 3,000,000 + 330,000 = 3,330,000
	expectedGrandTotal := 3330000.0
	if grandTotal != expectedGrandTotal {
		t.Errorf("Grand Total salah: diharapkan %.2f, didapatkan %.2f", expectedGrandTotal, grandTotal)
	}

	if len(processedItems) != 2 {
		t.Errorf("Jumlah item salah: diharapkan 2, didapatkan %d", len(processedItems))
	}
}

func TestGenerateNumbers(t *testing.T) {
	quoNum := GenerateQuotationNumber()
	if !strings.HasPrefix(quoNum, "QUO-") {
		t.Errorf("Format nomor quotation salah: %s", quoNum)
	}

	invNum := GenerateInvoiceNumber()
	if !strings.HasPrefix(invNum, "INV-") {
		t.Errorf("Format nomor invoice salah: %s", invNum)
	}
}
