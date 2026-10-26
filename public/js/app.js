// ==========================================================================
// GO-VIBE: QUOTATION & INVOICE MANAGER APPLICATION SCRIPT
// ==========================================================================

// 1. Periksa status login
const token = localStorage.getItem("jwt_token");
if (!token) {
    window.location.href = "/login";
}

let customersList = [];
let currentDocData = null; // Menyimpan data dokumen aktif untuk modal & ekspor

// Tampilkan nama profil pengguna dari storage
function updateHeaderProfile() {
    const userName = localStorage.getItem("user_name") || "Pengguna";
    const userEmail = localStorage.getItem("user_email") || "";
    document.getElementById("user-display").textContent = `${userName} (${userEmail})`;
}
updateHeaderProfile();

// Ambil profil segar dari backend jika memungkinkan
async function fetchUserProfile() {
    try {
        const res = await apiFetch("/api/auth/profile");
        if (res && res.ok) {
            const data = await res.json();
            if (data.user) {
                localStorage.setItem("user_name", data.user.name);
                localStorage.setItem("user_email", data.user.email);
                updateHeaderProfile();
            }
        }
    } catch (e) {
        // Fallback ke localStorage yang sudah ada
    }
}
fetchUserProfile();

function logout() {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    window.location.href = "/login";
}

// Request helper dengan JWT header
async function apiFetch(url, options = {}) {
    options.headers = {
        ...options.headers,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
    try {
        const res = await fetch(url, options);
        if (res.status === 401) {
            logout();
            return null;
        }
        return res;
    } catch (err) {
        showGlobalAlert("Terjadi gangguan koneksi ke server", false);
        return null;
    }
}

function showGlobalAlert(message, isSuccess = false) {
    const el = document.getElementById("global-alert");
    if (!el) return;
    el.textContent = message;
    el.className = isSuccess ? "alert alert-success" : "alert alert-error";
    el.style.display = "block";
    setTimeout(() => {
        el.style.display = "none";
    }, 4500);
}

function switchSection(name) {
    ["customers", "quotations", "invoices"].forEach(sec => {
        const sectionEl = document.getElementById(`sec-${sec}`);
        const pillEl = document.getElementById(`pill-${sec}`);
        if (sectionEl) sectionEl.style.display = (sec === name) ? "block" : "none";
        if (pillEl) pillEl.classList.toggle("active", sec === name);
    });

    if (name === "customers") loadCustomers();
    if (name === "quotations") loadQuotations();
    if (name === "invoices") loadInvoices();
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
}

function formatRupiah(val) {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

function formatDate(dateStr) {
    if (!dateStr) return "-";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr.substring(0, 10);
        return d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    } catch (e) {
        return dateStr.substring(0, 10);
    }
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ================= CUSTOMERS =================
async function loadCustomers() {
    const tbody = document.getElementById("customer-table-body");
    try {
        const res = await apiFetch("/api/customers");
        if (!res) return;
        const data = await res.json();
        customersList = data.customers || [];

        if (customersList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 25px;">Belum ada data pelanggan. Klik <strong>"+ Tambah Pelanggan"</strong> untuk menambahkan pelanggan baru.</td></tr>`;
            return;
        }

        tbody.innerHTML = customersList.map(c => `
            <tr>
                <td><strong>#${c.id}</strong></td>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.email || "-")}</td>
                <td>${escapeHtml(c.phone || "-")}</td>
                <td>${escapeHtml(c.address || "-")}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id})">Hapus</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="color: #dc2626; text-align: center; padding: 20px;">Gagal memuat pelanggan. Pastikan koneksi database aktif.</td></tr>`;
    }
}

function openCustomerModal() {
    document.getElementById("cust-name").value = "";
    document.getElementById("cust-email").value = "";
    document.getElementById("cust-phone").value = "";
    document.getElementById("cust-address").value = "";
    document.getElementById("modal-customer").classList.add("show");
}

async function saveCustomer(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById("cust-name").value.trim(),
        email: document.getElementById("cust-email").value.trim(),
        phone: document.getElementById("cust-phone").value.trim(),
        address: document.getElementById("cust-address").value.trim()
    };

    if (!body.name) {
        alert("Nama pelanggan tidak boleh kosong!");
        return;
    }

    const res = await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify(body)
    });

    if (res && res.ok) {
        closeModal("modal-customer");
        showGlobalAlert("Pelanggan baru berhasil disimpan!", true);
        loadCustomers();
    } else if (res) {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan pelanggan");
    }
}

async function deleteCustomer(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus pelanggan ini?")) return;
    const res = await apiFetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res) return;
    const data = await res.json();
    if (res.ok) {
        showGlobalAlert(data.message || "Pelanggan berhasil dihapus", true);
        loadCustomers();
    } else {
        showGlobalAlert(data.error || "Gagal menghapus pelanggan", false);
    }
}

// ================= DYNAMIC ITEMS & CALCULATION =================
function addItemRow(prefix) {
    const container = document.getElementById(`${prefix}-items-container`);
    const div = document.createElement("div");
    div.className = "item-row";
    div.innerHTML = `
        <input type="text" placeholder="Nama Produk / Layanan" class="${prefix}-item-name" required style="flex: 3; min-width: 140px;">
        <div class="item-row-grid" style="flex: 3; display: flex; gap: 8px;">
            <input type="number" placeholder="Qty" value="1" min="1" class="${prefix}-item-qty" oninput="recalculateTotals('${prefix}')" required style="flex: 1; min-width: 60px;">
            <input type="number" placeholder="Harga Satuan (Rp)" value="0" min="0" step="1000" class="${prefix}-item-price" oninput="recalculateTotals('${prefix}')" required style="flex: 2; min-width: 100px;">
            <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.item-row').remove(); recalculateTotals('${prefix}')" title="Hapus baris">&times;</button>
        </div>
    `;
    container.appendChild(div);
    recalculateTotals(prefix);
}

function recalculateTotals(prefix) {
    const names = document.querySelectorAll(`.${prefix}-item-name`);
    const qtys = document.querySelectorAll(`.${prefix}-item-qty`);
    const prices = document.querySelectorAll(`.${prefix}-item-price`);
    const taxRate = parseFloat(document.getElementById(`${prefix}-tax-rate`).value) || 0;

    let subtotal = 0;
    for (let i = 0; i < qtys.length; i++) {
        const q = parseFloat(qtys[i].value) || 0;
        const p = parseFloat(prices[i].value) || 0;
        subtotal += (q * p);
    }

    const tax = Math.round((taxRate / 100) * subtotal);
    const grandTotal = subtotal + tax;

    document.getElementById(`${prefix}-subtotal-display`).textContent = formatRupiah(subtotal);
    document.getElementById(`${prefix}-tax-display`).textContent = `${formatRupiah(tax)} (${taxRate}%)`;
    document.getElementById(`${prefix}-grand-total-display`).textContent = formatRupiah(grandTotal);
}

function populateCustomerSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' +
        customersList.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

// ================= QUOTATIONS =================
async function loadQuotations() {
    const tbody = document.getElementById("quotation-table-body");
    try {
        const res = await apiFetch("/api/quotations");
        if (!res) return;
        const data = await res.json();
        const list = data.quotations || [];

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 25px;">Belum ada data penawaran. Klik <strong>"+ Buat Penawaran"</strong> untuk membuat penawaran baru.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(q => `
            <tr>
                <td><strong style="color: var(--primary); font-family: monospace;">${escapeHtml(q.quotation_number)}</strong></td>
                <td><strong>${escapeHtml(q.customer ? q.customer.name : "-")}</strong></td>
                <td>${formatDate(q.issue_date)}</td>
                <td>${formatRupiah(q.subtotal)}</td>
                <td>${formatRupiah(q.tax_amount)} <small style="color:#64748b;">(${q.tax_rate}%)</small></td>
                <td><strong style="color: #0f172a;">${formatRupiah(q.grand_total)}</strong></td>
                <td><span class="badge badge-${q.status}">${translateStatus(q.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-sm" onclick="viewQuotationDetail(${q.id})" title="Lihat Dokumen">👁️ Detail</button>
                        <button class="btn btn-outline-primary btn-sm" onclick="downloadQuotationPDF(${q.id})" title="Unduh File PDF">📄 PDF</button>
                        ${q.status === 'draft' ? `<button class="btn btn-warning btn-sm" onclick="updateQuoStatus(${q.id}, 'sent')">Kirim</button>` : ''}
                        ${q.status === 'sent' ? `
                            <button class="btn btn-success btn-sm" onclick="updateQuoStatus(${q.id}, 'accepted')">Setuju</button>
                            <button class="btn btn-danger btn-sm" onclick="updateQuoStatus(${q.id}, 'rejected')">Tolak</button>
                        ` : ''}
                        ${q.status === 'accepted' ? `<button class="btn btn-primary btn-sm" onclick="convertToInvoice(${q.id})">Jadikan Invoice</button>` : ''}
                        <button class="btn btn-outline-secondary btn-sm" onclick="deleteQuotation(${q.id})" title="Hapus Penawaran">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="color: #dc2626; text-align: center; padding: 20px;">Gagal memuat data penawaran.</td></tr>`;
    }
}

function openQuotationModal() {
    populateCustomerSelect("quo-customer");
    document.getElementById("quo-items-container").innerHTML = "";
    addItemRow("quo");
    document.getElementById("modal-quotation").classList.add("show");
}

async function saveQuotation(e) {
    e.preventDefault();
    const customerId = parseInt(document.getElementById("quo-customer").value);
    if (!customerId) return alert("Pilih pelanggan terlebih dahulu!");

    const taxRate = parseFloat(document.getElementById("quo-tax-rate").value) || 0;
    const names = document.querySelectorAll(".quo-item-name");
    const qtys = document.querySelectorAll(".quo-item-qty");
    const prices = document.querySelectorAll(".quo-item-price");

    const items = [];
    for (let i = 0; i < names.length; i++) {
        const nameVal = names[i].value.trim();
        if (!nameVal) continue;
        items.push({
            item_name: nameVal,
            quantity: parseInt(qtys[i].value) || 1,
            unit_price: parseFloat(prices[i].value) || 0
        });
    }

    if (items.length === 0) {
        return alert("Harap isi setidaknya 1 item produk atau layanan!");
    }

    const res = await apiFetch("/api/quotations", {
        method: "POST",
        body: JSON.stringify({ customer_id: customerId, tax_rate: taxRate, items: items })
    });

    if (res && res.ok) {
        closeModal("modal-quotation");
        showGlobalAlert("Penawaran harga berhasil disimpan!", true);
        loadQuotations();
    } else if (res) {
        const err = await res.json();
        alert(err.error || "Gagal membuat quotation");
    }
}

async function updateQuoStatus(id, newStatus) {
    const res = await apiFetch(`/api/quotations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
    });
    if (res && res.ok) {
        showGlobalAlert(`Status penawaran berhasil diubah menjadi ${translateStatus(newStatus)}!`, true);
        loadQuotations();
        // Jika sedang terbuka di modal, muat ulang detailnya
        if (currentDocData && currentDocData.type === "quotation" && currentDocData.id === id) {
            viewQuotationDetail(id);
        }
    } else if (res) {
        const err = await res.json();
        showGlobalAlert(err.error || "Gagal memperbarui status", false);
    }
}

async function convertToInvoice(id) {
    if (!confirm("Ubah quotation yang disetujui ini menjadi invoice tagihan pelanggan?")) return;
    const res = await apiFetch(`/api/quotations/${id}/convert-to-invoice`, { method: "POST" });
    if (res && res.ok) {
        showGlobalAlert("Berhasil dikonversi menjadi Faktur Invoice!", true);
        closeModal("modal-detail");
        switchSection("invoices");
    } else if (res) {
        const err = await res.json();
        showGlobalAlert(err.error || "Gagal mengonversi ke invoice", false);
    }
}

async function deleteQuotation(id) {
    if (!confirm("Hapus dokumen penawaran harga ini beserta itemnya?")) return;
    const res = await apiFetch(`/api/quotations/${id}`, { method: "DELETE" });
    if (res && res.ok) {
        showGlobalAlert("Quotation berhasil dihapus", true);
        loadQuotations();
        closeModal("modal-detail");
    }
}

// ================= INVOICES =================
async function loadInvoices() {
    const tbody = document.getElementById("invoice-table-body");
    try {
        const res = await apiFetch("/api/invoices");
        if (!res) return;
        const data = await res.json();
        const list = data.invoices || [];

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 25px;">Belum ada tagihan. Klik <strong>"+ Buat Tagihan Langsung"</strong> atau konversi dari Quotation yang disetujui.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(inv => `
            <tr>
                <td><strong style="color: var(--primary); font-family: monospace;">${escapeHtml(inv.invoice_number)}</strong></td>
                <td><strong>${escapeHtml(inv.customer ? inv.customer.name : "-")}</strong></td>
                <td>${formatDate(inv.issue_date)}</td>
                <td>${formatDate(inv.due_date)}</td>
                <td><strong style="color: #0f172a;">${formatRupiah(inv.grand_total)}</strong></td>
                <td><span class="badge badge-${inv.status}">${translateStatus(inv.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-sm" onclick="viewInvoiceDetail(${inv.id})" title="Lihat Faktur">👁️ Detail</button>
                        <button class="btn btn-outline-primary btn-sm" onclick="downloadInvoicePDF(${inv.id})" title="Unduh File PDF">📄 PDF</button>
                        ${inv.status === 'unpaid' ? `
                            <button class="btn btn-success btn-sm" onclick="updateInvStatus(${inv.id}, 'paid')">Lunas</button>
                            <button class="btn btn-danger btn-sm" onclick="updateInvStatus(${inv.id}, 'cancelled')">Batal</button>
                        ` : ''}
                        <button class="btn btn-outline-secondary btn-sm" onclick="deleteInvoice(${inv.id})" title="Hapus Invoice">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: #dc2626; text-align: center; padding: 20px;">Gagal memuat data tagihan.</td></tr>`;
    }
}

function openInvoiceModal() {
    populateCustomerSelect("inv-customer");
    document.getElementById("inv-items-container").innerHTML = "";
    addItemRow("inv");
    // Default due date: 14 hari dari hari ini
    const d = new Date();
    d.setDate(d.getDate() + 14);
    document.getElementById("inv-due-date").value = d.toISOString().split("T")[0];
    document.getElementById("modal-invoice").classList.add("show");
}

async function saveInvoice(e) {
    e.preventDefault();
    const customerId = parseInt(document.getElementById("inv-customer").value);
    if (!customerId) return alert("Pilih pelanggan terlebih dahulu!");

    const taxRate = parseFloat(document.getElementById("inv-tax-rate").value) || 0;
    const dueDate = document.getElementById("inv-due-date").value;
    const names = document.querySelectorAll(".inv-item-name");
    const qtys = document.querySelectorAll(".inv-item-qty");
    const prices = document.querySelectorAll(".inv-item-price");

    const items = [];
    for (let i = 0; i < names.length; i++) {
        const nameVal = names[i].value.trim();
        if (!nameVal) continue;
        items.push({
            item_name: nameVal,
            quantity: parseInt(qtys[i].value) || 1,
            unit_price: parseFloat(prices[i].value) || 0
        });
    }

    if (items.length === 0) {
        return alert("Harap isi setidaknya 1 item produk atau layanan!");
    }

    const res = await apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify({ customer_id: customerId, tax_rate: taxRate, due_date: dueDate, items: items })
    });

    if (res && res.ok) {
        closeModal("modal-invoice");
        showGlobalAlert("Invoice berhasil dibuat!", true);
        loadInvoices();
    } else if (res) {
        const err = await res.json();
        alert(err.error || "Gagal membuat invoice");
    }
}

async function updateInvStatus(id, newStatus) {
    const res = await apiFetch(`/api/invoices/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
    });
    if (res && res.ok) {
        showGlobalAlert(`Status invoice diubah menjadi ${translateStatus(newStatus)}!`, true);
        loadInvoices();
        if (currentDocData && currentDocData.type === "invoice" && currentDocData.id === id) {
            viewInvoiceDetail(id);
        }
    } else if (res) {
        const err = await res.json();
        showGlobalAlert(err.error || "Gagal memperbarui status", false);
    }
}

async function deleteInvoice(id) {
    if (!confirm("Hapus tagihan invoice ini beserta seluruh itemnya?")) return;
    const res = await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res && res.ok) {
        showGlobalAlert("Invoice berhasil dihapus", true);
        loadInvoices();
        closeModal("modal-detail");
    }
}

// ================= STATUS TRANSLATION HELPER =================
function translateStatus(st) {
    const map = {
        "draft": "Draft",
        "sent": "Terkirim",
        "accepted": "Disetujui",
        "rejected": "Ditolak",
        "unpaid": "Belum Lunas",
        "paid": "Lunas",
        "cancelled": "Dibatalkan"
    };
    return map[st] || st;
}

// ================= RENDER DOKUMEN PROFESIONAL =================
function renderDocumentPaper(type, data) {
    const isQuo = (type === "quotation");
    const docTitle = isQuo ? "PENAWARAN HARGA" : "FAKTUR TAGIHAN";
    const docSubTitle = isQuo ? "OFFICIAL PRICE QUOTATION" : "COMMERCIAL INVOICE";
    const docNumber = isQuo ? data.quotation_number : data.invoice_number;
    const issueDateStr = formatDate(data.issue_date);
    const dueDateStr = isQuo ? null : formatDate(data.due_date);
    const customer = data.customer || {};
    const items = data.items || [];
    const issuerName = localStorage.getItem("user_name") || "Go-Vibe Solusi Bisnis";
    const issuerEmail = localStorage.getItem("user_email") || "sales@go-vibe.com";

    return `
        <div class="doc-paper" id="printable-doc-sheet">
            <!-- Header Dokumen -->
            <div class="doc-header-block">
                <div class="doc-issuer-brand">
                    <h1>${escapeHtml(issuerName)}</h1>
                    <div class="doc-issuer-sub">Layanan Penjualan, Jasa & Solusi Teknologi</div>
                    <div class="doc-issuer-meta">
                        <div>📧 ${escapeHtml(issuerEmail)}</div>
                        <div>🌐 https://go-vibe.local &nbsp;|&nbsp; 📍 Indonesia</div>
                    </div>
                </div>
                <div class="doc-heading-right">
                    <div class="doc-type-title">${docTitle}</div>
                    <div style="font-size: 11px; color: var(--secondary); letter-spacing: 1px; margin-bottom: 4px;">${docSubTitle}</div>
                    <div class="doc-number-display">#${escapeHtml(docNumber)}</div>
                    <div><span class="badge badge-${data.status}">${translateStatus(data.status)}</span></div>
                </div>
            </div>

            <!-- Grid Informasi Dokumen & Pelanggan -->
            <div class="doc-meta-grid">
                <div class="doc-meta-card">
                    <h5>Ditujukan Kepada (Customer / Bill To)</h5>
                    <div class="doc-customer-name">${escapeHtml(customer.name || "Pelanggan Umum")}</div>
                    <div class="doc-customer-line"><strong>Email:</strong> ${escapeHtml(customer.email || "-")}</div>
                    <div class="doc-customer-line"><strong>Telepon:</strong> ${escapeHtml(customer.phone || "-")}</div>
                    <div class="doc-customer-line"><strong>Alamat:</strong> ${escapeHtml(customer.address || "-")}</div>
                </div>
                <div class="doc-meta-card">
                    <h5>Detail Dokumen Transaksi</h5>
                    <div class="doc-meta-item">
                        <span class="label">Nomor Dokumen:</span>
                        <span class="val" style="font-family: monospace;">${escapeHtml(docNumber)}</span>
                    </div>
                    <div class="doc-meta-item">
                        <span class="label">Tanggal Diterbitkan:</span>
                        <span class="val">${issueDateStr}</span>
                    </div>
                    ${dueDateStr ? `
                    <div class="doc-meta-item">
                        <span class="label">Jatuh Tempo Pembayaran:</span>
                        <span class="val" style="color: var(--danger);">${dueDateStr}</span>
                    </div>
                    ` : `
                    <div class="doc-meta-item">
                        <span class="label">Masa Berlaku Penawaran:</span>
                        <span class="val">14 Hari Kalender</span>
                    </div>
                    `}
                    ${data.quotation && data.quotation.quotation_number ? `
                    <div class="doc-meta-item">
                        <span class="label">Ref. Penawaran:</span>
                        <span class="val" style="font-family: monospace;">#${escapeHtml(data.quotation.quotation_number)}</span>
                    </div>
                    ` : ''}
                    <div class="doc-meta-item">
                        <span class="label">Mata Uang Transaksi:</span>
                        <span class="val">IDR (Rupiah Indonesia)</span>
                    </div>
                </div>
            </div>

            <!-- Tabel Rincian Item -->
            <div class="doc-table-wrapper">
                <table class="doc-table">
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 45px;">No.</th>
                            <th class="text-left">Deskripsi Produk / Layanan Jasa</th>
                            <th class="text-center" style="width: 80px;">Kuantitas</th>
                            <th class="text-right" style="width: 140px;">Harga Satuan</th>
                            <th class="text-right" style="width: 150px;">Total (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.length === 0 ? `<tr><td colspan="5" class="text-center" style="padding: 16px; color:#64748b;">Tidak ada rincian item.</td></tr>` : 
                            items.map((item, idx) => `
                            <tr>
                                <td class="text-center" style="color: #64748b;">${idx + 1}</td>
                                <td><strong>${escapeHtml(item.item_name)}</strong></td>
                                <td class="text-center">${item.quantity}</td>
                                <td class="text-right">${formatRupiah(item.unit_price)}</td>
                                <td class="text-right"><strong>${formatRupiah(item.total_price)}</strong></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>

            <!-- Ringkasan Perhitungan Keuangan -->
            <div class="doc-calc-container">
                <div class="doc-summary-box">
                    <div class="doc-summary-row">
                        <span>Subtotal Keseluruhan:</span>
                        <strong>${formatRupiah(data.subtotal)}</strong>
                    </div>
                    <div class="doc-summary-row">
                        <span>Pajak (PPN ${data.tax_rate}%):</span>
                        <strong>${formatRupiah(data.tax_amount)}</strong>
                    </div>
                    <div class="doc-summary-total">
                        <span>GRAND TOTAL:</span>
                        <strong>${formatRupiah(data.grand_total)}</strong>
                    </div>
                </div>
            </div>

            <!-- Catatan & Ketentuan -->
            <div class="doc-notes-block">
                <strong>Catatan & Syarat Ketentuan:</strong>
                ${isQuo ? `
                    • Penawaran harga ini resmi dan berlaku selama 14 hari sejak tanggal penerbitan.<br>
                    • Konfirmasi persetujuan dapat dilakukan dengan menandatangani dokumen ini atau menghubungi tim sales kami.<br>
                    • Harga sudah mencakup ketentuan pajak yang berlaku.
                ` : `
                    • Harap melakukan pembayaran penuh sebelum tanggal jatuh tempo.<br>
                    • Pembayaran dapat ditransfer ke rekening resmi: <strong>Bank Central Asia (BCA) No. Rek: 123-456-7890 a.n. PT Go-Vibe Indonesia</strong>.<br>
                    • Mohon sertakan nomor invoice pada berita transfer dan konfirmasikan bukti transfer kepada tim kami.
                `}
            </div>

            <!-- Pengesahan / Tanda Tangan -->
            <div class="doc-signatures">
                <div class="doc-sign-box">
                    <div class="doc-sign-title">${isQuo ? "Diterbitkan Oleh (Sales):" : "Disiapkan Oleh (Keuangan):"}</div>
                    <div class="doc-sign-line"></div>
                    <div class="doc-sign-name">${escapeHtml(issuerName)}</div>
                    <div class="doc-sign-role">Otorisasi Manajemen</div>
                </div>
                <div class="doc-sign-box">
                    <div class="doc-sign-title">${isQuo ? "Diterima / Disetujui Oleh:" : "Diterima Oleh (Pelanggan):"}</div>
                    <div class="doc-sign-line"></div>
                    <div class="doc-sign-name">${escapeHtml(customer.name || "Pelanggan")}</div>
                    <div class="doc-sign-role">Tanda Tangan & Cap Perusahaan</div>
                </div>
            </div>
        </div>
    `;
}

// ================= VIEW DETAIL MODALS =================
async function viewQuotationDetail(id) {
    const res = await apiFetch(`/api/quotations/${id}`);
    if (!res) return;
    const data = await res.json();
    const q = data.quotation;
    if (!q) return alert("Data quotation tidak ditemukan");

    currentDocData = { type: "quotation", id: q.id, doc: q };

    document.getElementById("detail-title").innerHTML = `
        <span>Detail Penawaran:</span>
        <strong style="font-family: monospace; color: var(--primary);">#${escapeHtml(q.quotation_number)}</strong>
    `;

    // Action buttons toolbar di header modal
    document.getElementById("detail-actions-bar").innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="exportCurrentDocToPDF()">📥 Unduh PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Cetak</button>
        ${q.status === 'draft' ? `<button class="btn btn-warning btn-sm" onclick="updateQuoStatus(${q.id}, 'sent')">Kirim</button>` : ''}
        ${q.status === 'sent' ? `
            <button class="btn btn-success btn-sm" onclick="updateQuoStatus(${q.id}, 'accepted')">Setujui</button>
            <button class="btn btn-danger btn-sm" onclick="updateQuoStatus(${q.id}, 'rejected')">Tolak</button>
        ` : ''}
        ${q.status === 'accepted' ? `<button class="btn btn-success btn-sm" onclick="convertToInvoice(${q.id})">Jadikan Invoice</button>` : ''}
        <button class="btn btn-outline-secondary btn-sm" onclick="closeModal('modal-detail')">Tutup</button>
    `;

    document.getElementById("detail-body").innerHTML = renderDocumentPaper("quotation", q);
    document.getElementById("modal-detail").classList.add("show");
}

async function viewInvoiceDetail(id) {
    const res = await apiFetch(`/api/invoices/${id}`);
    if (!res) return;
    const data = await res.json();
    const inv = data.invoice;
    if (!inv) return alert("Data invoice tidak ditemukan");

    currentDocData = { type: "invoice", id: inv.id, doc: inv };

    document.getElementById("detail-title").innerHTML = `
        <span>Detail Tagihan:</span>
        <strong style="font-family: monospace; color: var(--primary);">#${escapeHtml(inv.invoice_number)}</strong>
    `;

    // Action buttons toolbar di header modal
    document.getElementById("detail-actions-bar").innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="exportCurrentDocToPDF()">📥 Unduh PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Cetak</button>
        ${inv.status === 'unpaid' ? `
            <button class="btn btn-success btn-sm" onclick="updateInvStatus(${inv.id}, 'paid')">Tandai Lunas</button>
            <button class="btn btn-danger btn-sm" onclick="updateInvStatus(${inv.id}, 'cancelled')">Batalkan</button>
        ` : ''}
        <button class="btn btn-outline-secondary btn-sm" onclick="closeModal('modal-detail')">Tutup</button>
    `;

    document.getElementById("detail-body").innerHTML = renderDocumentPaper("invoice", inv);
    document.getElementById("modal-detail").classList.add("show");
}

// ================= EKSPOR PDF ENGINE =================
async function triggerPDFDownload(element, filename) {
    if (typeof html2pdf === "undefined") {
        showGlobalAlert("Library PDF sedang disiapkan, beralih ke dialog cetak PDF...", false);
        window.print();
        return;
    }

    showGlobalAlert("Menyiapkan dokumen PDF berkualitas tinggi...", true);

    const opt = {
        margin: [10, 10, 10, 10], // Margin A4 dalam mm (top, left, bottom, right)
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2, // 2x resolusi tajam
            useCORS: true,
            logging: false,
            letterRendering: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(element).save();
        showGlobalAlert(`Berhasil mengunduh ${filename}!`, true);
    } catch (err) {
        console.error("Gagal export PDF:", err);
        showGlobalAlert("Gagal menghasilkan file PDF otomatis, membuka dialog cetak...", false);
        window.print();
    }
}

// Ekspor dari modal yang sedang terbuka
function exportCurrentDocToPDF() {
    if (!currentDocData || !currentDocData.doc) {
        return alert("Tidak ada dokumen yang sedang ditampilkan");
    }
    const elem = document.getElementById("printable-doc-sheet");
    if (!elem) return;

    const isQuo = (currentDocData.type === "quotation");
    const docNum = isQuo ? currentDocData.doc.quotation_number : currentDocData.doc.invoice_number;
    const prefix = isQuo ? "Penawaran" : "Invoice";
    const filename = `${prefix}_${docNum}.pdf`;

    triggerPDFDownload(elem, filename);
}

// Ekspor langsung dari tombol tabel Quotation tanpa harus buka modal
async function downloadQuotationPDF(id) {
    showGlobalAlert("Memuat data penawaran untuk diekspor...", true);
    const res = await apiFetch(`/api/quotations/${id}`);
    if (!res) return;
    const data = await res.json();
    const q = data.quotation;
    if (!q) return alert("Gagal memuat detail penawaran");

    const container = document.getElementById("pdf-export-hidden");
    container.innerHTML = renderDocumentPaper("quotation", q);
    const elem = container.querySelector(".doc-paper");

    const filename = `Penawaran_${q.quotation_number}.pdf`;
    await triggerPDFDownload(elem, filename);
    container.innerHTML = "";
}

// Ekspor langsung dari tombol tabel Invoice tanpa harus buka modal
async function downloadInvoicePDF(id) {
    showGlobalAlert("Memuat data tagihan untuk diekspor...", true);
    const res = await apiFetch(`/api/invoices/${id}`);
    if (!res) return;
    const data = await res.json();
    const inv = data.invoice;
    if (!inv) return alert("Gagal memuat detail invoice");

    const container = document.getElementById("pdf-export-hidden");
    container.innerHTML = renderDocumentPaper("invoice", inv);
    const elem = container.querySelector(".doc-paper");

    const filename = `Invoice_${inv.invoice_number}.pdf`;
    await triggerPDFDownload(elem, filename);
    container.innerHTML = "";
}

// Inisialisasi awal
loadCustomers();
