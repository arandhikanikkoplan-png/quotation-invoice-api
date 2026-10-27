package services

import (
	"regexp"
	"strings"
	"testing"
	"time"
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

	pattern := regexp.MustCompile(`^(QUO|INV)-\d{8}-\d{4}$`)
	for i := 0; i < 20; i++ {
		if num := GenerateQuotationNumber(); !pattern.MatchString(num) {
			t.Errorf("Format nomor quotation tidak sesuai: %s", num)
		}
		if num := GenerateInvoiceNumber(); !pattern.MatchString(num) {
			t.Errorf("Format nomor invoice tidak sesuai: %s", num)
		}
	}
}

func TestCalculateTotalsAllowsZeroPrice(t *testing.T) {
	items := []ItemInput{
		{ItemName: "Biaya Gratis", Quantity: 1, UnitPrice: 0},
	}

	subtotal, taxAmount, grandTotal, processedItems := CalculateTotals(items, 11)

	if subtotal != 0 || taxAmount != 0 || grandTotal != 0 {
		t.Errorf("Total untuk harga 0 seharusnya 0, didapat: %.2f / %.2f / %.2f", subtotal, taxAmount, grandTotal)
	}
	if len(processedItems) != 1 {
		t.Errorf("Jumlah item salah: diharapkan 1, didapatkan %d", len(processedItems))
	}
}

func TestCalculateTotalsRoundsCurrency(t *testing.T) {
	items := []ItemInput{
		{ItemName: "Item Desimal", Quantity: 3, UnitPrice: 333.33},
	}

	subtotal, taxAmount, grandTotal, _ := CalculateTotals(items, 11)

	if subtotal != 999.99 {
		t.Errorf("Subtotal salah: diharapkan 999.99, didapatkan %.2f", subtotal)
	}
	if taxAmount != 110.00 {
		t.Errorf("Pajak salah: diharapkan 110.00, didapatkan %.2f", taxAmount)
	}
	if grandTotal != 1109.99 {
		t.Errorf("Grand total salah: diharapkan 1109.99, didapatkan %.2f", grandTotal)
	}
}

func TestCalculateTotalsFallsBackOnInvalidTaxRate(t *testing.T) {
	items := []ItemInput{
		{ItemName: "Jasa", Quantity: 1, UnitPrice: 1000000},
	}

	_, taxAmount, _, _ := CalculateTotals(items, 150)

	if taxAmount != 110000 {
		t.Errorf("Pajak untuk tarif tidak valid seharusnya memakai 11%%, didapatkan %.2f", taxAmount)
	}
}

func TestGeneratedNumberUsesTodayDate(t *testing.T) {
	expectedDate := time.Now().Format("20060102")
	number := GenerateQuotationNumber()
	if !strings.Contains(number, expectedDate) {
		t.Errorf("Nomor quotation harus memuat tanggal hari ini (%s): %s", expectedDate, number)
	}
}
