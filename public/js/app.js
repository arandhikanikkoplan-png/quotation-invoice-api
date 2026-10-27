// ==========================================================================
// GO-VIBE: QUOTATION & INVOICE MANAGER APPLICATION SCRIPT
// ==========================================================================

// 1. Periksa status login
const token = localStorage.getItem("jwt_token");
if (!token) {
    window.location.href = "/login";
}

const PROFILE_STORAGE_KEY = "company_profile";
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

let customersList = [];
let currentDocData = null; // Menyimpan data dokumen aktif untuk modal & ekspor
let profile = loadStoredProfile();
let alertTimer = null;
let pdfInProgress = false;

// ================= PROFIL & BRANDING =================
function loadStoredProfile() {
    try {
        return JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)) || {};
    } catch (err) {
        return {};
    }
}

function saveProfile(user) {
    if (!user) return;
    profile = { ...profile, ...user };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    if (user.name) localStorage.setItem("user_name", user.name);
    if (user.email) localStorage.setItem("user_email", user.email);
    renderBranding();
}

function companyDisplayName() {
    return (profile.company_name || profile.name || "Perusahaan Anda").trim();
}

function companyInitial() {
    const name = companyDisplayName();
    return (name.charAt(0) || "Q").toUpperCase();
}

function renderBranding() {
    const display = document.getElementById("user-display");
    if (display) {
        const name = profile.company_name || profile.name || "Pengguna";
        const email = profile.company_email || profile.email || "";
        display.textContent = email ? `${name} · ${email}` : name;
        display.title = email ? `${name} (${email})` : name;
    }

    const logoImg = document.getElementById("brand-logo-img");
    const logoLetter = document.getElementById("brand-logo-letter");
    if (!logoImg || !logoLetter) return;

    if (profile.logo_url) {
        logoImg.src = profile.logo_url;
        logoImg.hidden = false;
        logoLetter.hidden = true;
    } else {
        logoImg.hidden = true;
        logoImg.removeAttribute("src");
        logoLetter.hidden = false;
        logoLetter.textContent = companyInitial();
    }
}

function logout() {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    window.location.href = "/login";
}

// Request helper dengan JWT header (mendukung JSON maupun FormData)
async function apiFetch(url, options = {}) {
    const opts = { ...options };
    const currentToken = localStorage.getItem("jwt_token");
    opts.headers = {
        ...(options.headers || {}),
        "Authorization": `Bearer ${currentToken}`
    };
    if (opts.body && !(opts.body instanceof FormData)) {
        opts.headers["Content-Type"] = "application/json";
    }

    try {
        const res = await fetch(url, opts);
        if (res.status === 401) {
            logout();
            return null;
        }
        return res;
    } catch (err) {
        showToast("Terjadi gangguan koneksi ke server. Periksa apakah server sudah berjalan.", false);
        return null;
    }
}

async function readError(res, fallback) {
    try {
        const data = await res.json();
        return data.error || data.message || fallback;
    } catch (err) {
        return fallback;
    }
}

function showToast(message, isSuccess = false) {
    const el = document.getElementById("global-alert");
    if (!el) return;
    el.textContent = message;
    el.className = isSuccess ? "alert toast alert-success" : "alert toast alert-error";
    el.style.display = "flex";
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => {
        el.style.display = "none";
    }, 5000);
}

// Alias agar kompatibel dengan pemanggilan lama
function showGlobalAlert(message, isSuccess = false) {
    showToast(message, isSuccess);
}

// ================= MODAL HELPERS =================
function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("show");
    document.body.classList.add("modal-open");
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("show");
    if (!document.querySelector(".modal.show")) {
        document.body.classList.remove("modal-open");
    }
}

function bindModalDismiss() {
    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("mousedown", event => {
            if (event.target === modal) closeModal(modal.id);
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        const opened = document.querySelector(".modal.show");
        if (opened) closeModal(opened.id);
    });
}

// ================= FORMATTERS =================
function formatRupiah(val) {
    const num = parseFloat(val) || 0;
    return rupiahFormatter.format(num);
}

function formatNumber(val) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(parseFloat(val) || 0);
}

function formatDate(dateStr) {
    if (!dateStr) return "-";
    let d = null;
    if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, day] = dateStr.split("-").map(Number);
        d = new Date(y, m - 1, day);
    } else {
        d = new Date(dateStr);
    }
    if (!d || isNaN(d.getTime())) {
        return String(dateStr).substring(0, 10);
    }
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function todayISO() {
    return toISODate(new Date());
}

function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addDaysISO(dateStr, days) {
    const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    return toISODate(base);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function sanitizeFilename(name) {
    return String(name || "dokumen")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "_");
}

// ================= TAB NAVIGATION =================
function switchSection(name) {
    ["customers", "quotations", "invoices"].forEach(sec => {
        const sectionEl = document.getElementById(`sec-${sec}`);
        const pillEl = document.getElementById(`pill-${sec}`);
        if (sectionEl) sectionEl.style.display = (sec === name) ? "block" : "none";
        if (pillEl) {
            pillEl.classList.toggle("active", sec === name);
            if (sec === name) {
                pillEl.setAttribute("aria-current", "page");
            } else {
                pillEl.removeAttribute("aria-current");
            }
        }
    });

    if (name === "customers") loadCustomers();
    if (name === "quotations") loadQuotations();
    if (name === "invoices") loadInvoices();
}

// ================= EMPTY & LOADING STATES =================
function loadingRow(colspan, text) {
    return `<tr><td colspan="${colspan}" class="empty-cell">
        <div class="empty-state"><span class="spinner"></span><strong>${escapeHtml(text)}</strong></div>
    </td></tr>`;
}

function emptyRow(colspan, icon, title, hint) {
    return `<tr><td colspan="${colspan}" class="empty-cell">
        <div class="empty-state">
            <span class="empty-icon" aria-hidden="true">${icon}</span>
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(hint)}</span>
        </div>
    </td></tr>`;
}

// ================= CUSTOMERS =================
async function loadCustomers() {
    const tbody = document.getElementById("customer-table-body");
    if (tbody) tbody.innerHTML = loadingRow(6, "Memuat pelanggan...");

    try {
        const res = await apiFetch("/api/customers");
        if (!res) return false;
        if (!res.ok) {
            tbody.innerHTML = emptyRow(6, "⚠️", "Gagal memuat pelanggan", await readError(res, "Silakan coba lagi."));
            return false;
        }

        const data = await res.json();
        customersList = data.customers || [];

        if (customersList.length === 0) {
            tbody.innerHTML = emptyRow(6, "👥", "Belum ada pelanggan", "Klik “+ Tambah Pelanggan” untuk menambahkan pelanggan pertama Anda.");
            return true;
        }

        tbody.innerHTML = customersList.map(c => `
            <tr>
                <td data-label="ID"><strong>#${c.id}</strong></td>
                <td data-label="Nama"><strong>${escapeHtml(c.name)}</strong></td>
                <td data-label="Email">${escapeHtml(c.email || "-")}</td>
                <td data-label="Telepon">${escapeHtml(c.phone || "-")}</td>
                <td data-label="Alamat"><span class="cell-clip">${escapeHtml(c.address || "-")}</span></td>
                <td data-label="Aksi">
                    <div class="action-buttons">
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="openEditCustomerModal(${c.id})">✏️ Edit</button>
                        <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteCustomer(${c.id})">Hapus</button>
                    </div>
                </td>
            </tr>
        `).join("");
        return true;
    } catch (err) {
        tbody.innerHTML = emptyRow(6, "⚠️", "Gagal memuat pelanggan", "Pastikan koneksi database dan server aktif.");
        return false;
    }
}

function resetCustomerForm() {
    document.getElementById("cust-id").value = "";
    document.getElementById("cust-name").value = "";
    document.getElementById("cust-email").value = "";
    document.getElementById("cust-phone").value = "";
    document.getElementById("cust-address").value = "";
}

function openCustomerModal() {
    resetCustomerForm();
    document.getElementById("modal-customer-title").textContent = "Tambah Pelanggan Baru";
    openModal("modal-customer");
}

function openEditCustomerModal(id) {
    const customer = customersList.find(c => c.id === id);
    if (!customer) {
        showToast("Data pelanggan tidak ditemukan", false);
        return;
    }
    document.getElementById("cust-id").value = customer.id;
    document.getElementById("cust-name").value = customer.name || "";
    document.getElementById("cust-email").value = customer.email || "";
    document.getElementById("cust-phone").value = customer.phone || "";
    document.getElementById("cust-address").value = customer.address || "";
    document.getElementById("modal-customer-title").textContent = "Edit Data Pelanggan";
    openModal("modal-customer");
}

async function saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById("cust-id").value;
    const body = {
        name: document.getElementById("cust-name").value.trim(),
        email: document.getElementById("cust-email").value.trim(),
        phone: document.getElementById("cust-phone").value.trim(),
        address: document.getElementById("cust-address").value.trim()
    };

    if (!body.name) {
        showToast("Nama pelanggan tidak boleh kosong", false);
        return;
    }

    const isEdit = Boolean(id);
    const res = await apiFetch(isEdit ? `/api/customers/${id}` : "/api/customers", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(body)
    });

    if (res && res.ok) {
        closeModal("modal-customer");
        showToast(isEdit ? "Data pelanggan berhasil diperbarui" : "Pelanggan baru berhasil disimpan", true);
        loadCustomers();
    } else if (res) {
        showToast(await readError(res, "Gagal menyimpan pelanggan"), false);
    }
}

async function deleteCustomer(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus pelanggan ini?")) return;
    const res = await apiFetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res) return;

    if (res.ok) {
        showToast("Pelanggan berhasil dihapus", true);
        loadCustomers();
    } else {
        showToast(await readError(res, "Gagal menghapus pelanggan"), false);
    }
}

// ================= DYNAMIC ITEMS & CALCULATION =================
function addItemRow(prefix) {
    const container = document.getElementById(`${prefix}-items-container`);
    if (!container) return;

    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
        <div class="item-field item-name-field">
            <label class="item-label">Nama Produk / Layanan</label>
            <input type="text" class="${prefix}-item-name" placeholder="Contoh: Pengembangan Website" maxlength="200">
        </div>
        <div class="item-field">
            <label class="item-label">Qty</label>
            <input type="number" class="${prefix}-item-qty" value="1" min="1" step="1" inputmode="numeric">
        </div>
        <div class="item-field">
            <label class="item-label">Harga Satuan</label>
            <input type="number" class="${prefix}-item-price" value="0" min="0" step="1000" inputmode="decimal">
        </div>
        <div class="item-field item-total-field">
            <label class="item-label">Total</label>
            <span class="item-total-value">Rp 0</span>
        </div>
        <button type="button" class="btn btn-icon btn-outline-danger item-remove" title="Hapus baris" aria-label="Hapus baris item"
            onclick="removeItemRow(this, '${prefix}')">×</button>
    `;

    container.appendChild(row);
    row.querySelectorAll(`.${prefix}-item-qty, .${prefix}-item-price`).forEach(input => {
        input.addEventListener("input", () => recalculateTotals(prefix));
    });
    recalculateTotals(prefix);
}

function removeItemRow(button, prefix) {
    const container = document.getElementById(`${prefix}-items-container`);
    const row = button.closest(".item-row");
    if (!container || !row) return;
    row.remove();
    if (!container.querySelector(".item-row")) {
        addItemRow(prefix);
        return;
    }
    recalculateTotals(prefix);
}

function recalculateTotals(prefix) {
    const container = document.getElementById(`${prefix}-items-container`);
    const taxInput = document.getElementById(`${prefix}-tax-rate`);
    if (!container || !taxInput) return;

    const taxRate = Math.min(100, Math.max(0, parseFloat(taxInput.value) || 0));
    let subtotal = 0;

    container.querySelectorAll(".item-row").forEach(row => {
        const qtyInput = row.querySelector(`.${prefix}-item-qty`);
        const priceInput = row.querySelector(`.${prefix}-item-price`);
        const qty = Math.max(0, parseInt(qtyInput ? qtyInput.value : "0", 10) || 0);
        const price = Math.max(0, parseFloat(priceInput ? priceInput.value : "0") || 0);
        const total = qty * price;
        subtotal += total;

        const totalEl = row.querySelector(".item-total-value");
        if (totalEl) totalEl.textContent = formatRupiah(total);
    });

    const tax = Math.round((taxRate / 100) * subtotal * 100) / 100;
    const grandTotal = subtotal + tax;

    setText(`${prefix}-subtotal-display`, formatRupiah(subtotal));
    setText(`${prefix}-tax-label`, `Pajak (PPN ${formatNumber(taxRate)}%)`);
    setText(`${prefix}-tax-display`, formatRupiah(tax));
    setText(`${prefix}-grand-total-display`, formatRupiah(grandTotal));
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function collectItems(prefix) {
    const rows = document.querySelectorAll(`#${prefix}-items-container .item-row`);
    const items = [];
    rows.forEach(row => {
        const nameInput = row.querySelector(`.${prefix}-item-name`);
        const qtyInput = row.querySelector(`.${prefix}-item-qty`);
        const priceInput = row.querySelector(`.${prefix}-item-price`);
        const name = nameInput ? nameInput.value.trim() : "";
        if (!name) return;

        items.push({
            item_name: name,
            quantity: Math.max(1, parseInt(qtyInput ? qtyInput.value : "1", 10) || 1),
            unit_price: Math.max(0, parseFloat(priceInput ? priceInput.value : "0") || 0)
        });
    });
    return items;
}

function populateCustomerSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' +
        customersList.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

// ================= QUOTATIONS =================
async function loadQuotations() {
    const tbody = document.getElementById("quotation-table-body");
    if (tbody) tbody.innerHTML = loadingRow(8, "Memuat data penawaran...");

    try {
        const res = await apiFetch("/api/quotations");
        if (!res) return;
        if (!res.ok) {
            tbody.innerHTML = emptyRow(8, "⚠️", "Gagal memuat penawaran", await readError(res, "Silakan coba lagi."));
            return;
        }

        const data = await res.json();
        const list = data.quotations || [];

        if (list.length === 0) {
            tbody.innerHTML = emptyRow(8, "📋", "Belum ada penawaran", "Klik “+ Buat Penawaran” untuk membuat quotation baru.");
            return;
        }

        tbody.innerHTML = list.map(q => `
            <tr>
                <td data-label="No. Quotation"><strong class="doc-code">${escapeHtml(q.quotation_number)}</strong></td>
                <td data-label="Pelanggan"><strong>${escapeHtml(q.customer ? q.customer.name : "-")}</strong></td>
                <td data-label="Tanggal">${formatDate(q.issue_date)}</td>
                <td data-label="Subtotal">${formatRupiah(q.subtotal)}</td>
                <td data-label="Pajak">${formatRupiah(q.tax_amount)} <small class="muted">(${formatNumber(q.tax_rate)}%)</small></td>
                <td data-label="Grand Total"><strong class="amount-strong">${formatRupiah(q.grand_total)}</strong></td>
                <td data-label="Status"><span class="badge badge-${escapeHtml(q.status)}">${translateStatus(q.status)}</span></td>
                <td data-label="Aksi">
                    <div class="action-buttons">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="viewQuotationDetail(${q.id})" title="Lihat dokumen">👁️ Detail</button>
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="downloadQuotationPDF(${q.id})" title="Unduh file PDF">📄 PDF</button>
                        ${q.status === "draft" ? `<button type="button" class="btn btn-warning btn-sm" onclick="updateQuoStatus(${q.id}, 'sent')">Kirim</button>` : ""}
                        ${q.status === "sent" ? `
                            <button type="button" class="btn btn-success btn-sm" onclick="updateQuoStatus(${q.id}, 'accepted')">Setuju</button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="updateQuoStatus(${q.id}, 'rejected')">Tolak</button>
                        ` : ""}
                        ${q.status === "accepted" ? `<button type="button" class="btn btn-primary btn-sm" onclick="convertToInvoice(${q.id})">Jadikan Invoice</button>` : ""}
                        <button type="button" class="btn btn-outline-danger btn-sm btn-icon" onclick="deleteQuotation(${q.id})" title="Hapus penawaran" aria-label="Hapus penawaran">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = emptyRow(8, "⚠️", "Gagal memuat penawaran", "Pastikan koneksi database dan server aktif.");
    }
}

async function openQuotationModal() {
    if (!customersList.length) {
        const loaded = await loadCustomers();
        if (!loaded) return;
    }
    if (!customersList.length) {
        showToast("Tambahkan pelanggan terlebih dahulu sebelum membuat penawaran", false);
        openCustomerModal();
        return;
    }

    populateCustomerSelect("quo-customer");
    document.getElementById("quo-issue-date").value = todayISO();
    document.getElementById("quo-tax-rate").value = "11";
    document.getElementById("quo-items-container").innerHTML = "";
    addItemRow("quo");
    openModal("modal-quotation");
}

async function saveQuotation(e) {
    e.preventDefault();
    const customerId = parseInt(document.getElementById("quo-customer").value, 10);
    if (!customerId) {
        showToast("Pilih pelanggan terlebih dahulu", false);
        return;
    }

    const taxRate = parseFloat(document.getElementById("quo-tax-rate").value) || 0;
    const items = collectItems("quo");
    if (items.length === 0) {
        showToast("Harap isi setidaknya 1 item produk atau layanan", false);
        return;
    }

    const res = await apiFetch("/api/quotations", {
        method: "POST",
        body: JSON.stringify({
            customer_id: customerId,
            tax_rate: taxRate,
            issue_date: document.getElementById("quo-issue-date").value,
            items: items
        })
    });

    if (res && res.ok) {
        closeModal("modal-quotation");
        showToast("Penawaran harga berhasil disimpan", true);
        loadQuotations();
    } else if (res) {
        showToast(await readError(res, "Gagal membuat quotation"), false);
    }
}

async function updateQuoStatus(id, newStatus) {
    const res = await apiFetch(`/api/quotations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
    });
    if (res && res.ok) {
        showToast(`Status penawaran diubah menjadi ${translateStatus(newStatus)}`, true);
        loadQuotations();
        if (currentDocData && currentDocData.type === "quotation" && currentDocData.id === id) {
            viewQuotationDetail(id);
        }
    } else if (res) {
        showToast(await readError(res, "Gagal memperbarui status"), false);
    }
}

async function convertToInvoice(id) {
    if (!confirm("Ubah quotation yang disetujui ini menjadi invoice tagihan pelanggan?")) return;
    const res = await apiFetch(`/api/quotations/${id}/convert-to-invoice`, { method: "POST" });
    if (res && res.ok) {
        showToast("Quotation berhasil dikonversi menjadi invoice", true);
        currentDocData = null;
        closeModal("modal-detail");
        switchSection("invoices");
    } else if (res) {
        showToast(await readError(res, "Gagal mengonversi ke invoice"), false);
    }
}

async function deleteQuotation(id) {
    if (!confirm("Hapus dokumen penawaran harga ini beserta seluruh itemnya?")) return;
    const res = await apiFetch(`/api/quotations/${id}`, { method: "DELETE" });
    if (!res) return;

    if (res.ok) {
        showToast("Quotation berhasil dihapus", true);
        currentDocData = null;
        closeModal("modal-detail");
        loadQuotations();
    } else {
        showToast(await readError(res, "Gagal menghapus quotation"), false);
    }
}

// ================= INVOICES =================
async function loadInvoices() {
    const tbody = document.getElementById("invoice-table-body");
    if (tbody) tbody.innerHTML = loadingRow(7, "Memuat data tagihan...");

    try {
        const res = await apiFetch("/api/invoices");
        if (!res) return;
        if (!res.ok) {
            tbody.innerHTML = emptyRow(7, "⚠️", "Gagal memuat tagihan", await readError(res, "Silakan coba lagi."));
            return;
        }

        const data = await res.json();
        const list = data.invoices || [];

        if (list.length === 0) {
            tbody.innerHTML = emptyRow(7, "💳", "Belum ada tagihan", "Buat tagihan langsung atau konversi dari quotation yang disetujui.");
            return;
        }

        tbody.innerHTML = list.map(inv => `
            <tr>
                <td data-label="No. Invoice"><strong class="doc-code">${escapeHtml(inv.invoice_number)}</strong></td>
                <td data-label="Pelanggan"><strong>${escapeHtml(inv.customer ? inv.customer.name : "-")}</strong></td>
                <td data-label="Tanggal Terbit">${formatDate(inv.issue_date)}</td>
                <td data-label="Jatuh Tempo">${formatDate(inv.due_date)}</td>
                <td data-label="Grand Total"><strong class="amount-strong">${formatRupiah(inv.grand_total)}</strong></td>
                <td data-label="Status"><span class="badge badge-${escapeHtml(inv.status)}">${translateStatus(inv.status)}</span></td>
                <td data-label="Aksi">
                    <div class="action-buttons">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="viewInvoiceDetail(${inv.id})" title="Lihat faktur">👁️ Detail</button>
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="downloadInvoicePDF(${inv.id})" title="Unduh file PDF">📄 PDF</button>
                        ${inv.status === "unpaid" ? `
                            <button type="button" class="btn btn-success btn-sm" onclick="updateInvStatus(${inv.id}, 'paid')">Lunas</button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="updateInvStatus(${inv.id}, 'cancelled')">Batal</button>
                        ` : ""}
                        <button type="button" class="btn btn-outline-danger btn-sm btn-icon" onclick="deleteInvoice(${inv.id})" title="Hapus invoice" aria-label="Hapus invoice">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = emptyRow(7, "⚠️", "Gagal memuat tagihan", "Pastikan koneksi database dan server aktif.");
    }
}

async function openInvoiceModal() {
    if (!customersList.length) {
        const loaded = await loadCustomers();
        if (!loaded) return;
    }
    if (!customersList.length) {
        showToast("Tambahkan pelanggan terlebih dahulu sebelum membuat invoice", false);
        openCustomerModal();
        return;
    }

    populateCustomerSelect("inv-customer");
    const today = todayISO();
    document.getElementById("inv-issue-date").value = today;
    document.getElementById("inv-due-date").value = addDaysISO(today, 14);
    document.getElementById("inv-tax-rate").value = "11";
    document.getElementById("inv-items-container").innerHTML = "";
    addItemRow("inv");
    openModal("modal-invoice");
}

async function saveInvoice(e) {
    e.preventDefault();
    const customerId = parseInt(document.getElementById("inv-customer").value, 10);
    if (!customerId) {
        showToast("Pilih pelanggan terlebih dahulu", false);
        return;
    }

    const issueDate = document.getElementById("inv-issue-date").value;
    const dueDate = document.getElementById("inv-due-date").value;
    if (issueDate && dueDate && dueDate < issueDate) {
        showToast("Tanggal jatuh tempo tidak boleh sebelum tanggal terbit", false);
        return;
    }

    const taxRate = parseFloat(document.getElementById("inv-tax-rate").value) || 0;
    const items = collectItems("inv");
    if (items.length === 0) {
        showToast("Harap isi setidaknya 1 item produk atau layanan", false);
        return;
    }

    const res = await apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
            customer_id: customerId,
            tax_rate: taxRate,
            issue_date: issueDate,
            due_date: dueDate,
            items: items
        })
    });

    if (res && res.ok) {
        closeModal("modal-invoice");
        showToast("Invoice berhasil dibuat", true);
        loadInvoices();
    } else if (res) {
        showToast(await readError(res, "Gagal membuat invoice"), false);
    }
}

async function updateInvStatus(id, newStatus) {
    const res = await apiFetch(`/api/invoices/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
    });
    if (res && res.ok) {
        showToast(`Status invoice diubah menjadi ${translateStatus(newStatus)}`, true);
        loadInvoices();
        if (currentDocData && currentDocData.type === "invoice" && currentDocData.id === id) {
            viewInvoiceDetail(id);
        }
    } else if (res) {
        showToast(await readError(res, "Gagal memperbarui status"), false);
    }
}

async function deleteInvoice(id) {
    if (!confirm("Hapus tagihan invoice ini beserta seluruh itemnya?")) return;
    const res = await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (!res) return;

    if (res.ok) {
        showToast("Invoice berhasil dihapus", true);
        currentDocData = null;
        closeModal("modal-detail");
        loadInvoices();
    } else {
        showToast(await readError(res, "Gagal menghapus invoice"), false);
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
    return map[st] || st || "-";
}

// ================= PENGATURAN PERUSAHAAN & LOGO =================
function bindLogoPicker() {
    const picker = document.getElementById("btn-pick-logo");
    const input = document.getElementById("logo-file");
    if (!picker || !input) return;

    // Label sudah membuka dialog file secara native saat diklik/diketuk.
    // Ini hanya fallback agar kontrol tetap bisa dipakai lewat keyboard.
    picker.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            input.click();
        }
    });
}

function openCompanyModal() {
    document.getElementById("comp-name").value = profile.company_name || "";
    document.getElementById("comp-email").value = profile.company_email || "";
    document.getElementById("comp-phone").value = profile.company_phone || "";
    document.getElementById("comp-website").value = profile.company_website || "";
    document.getElementById("comp-address").value = profile.company_address || "";
    document.getElementById("comp-bank-name").value = profile.bank_name || "";
    document.getElementById("comp-bank-account").value = profile.bank_account || "";
    document.getElementById("comp-bank-holder").value = profile.bank_holder || "";
    document.getElementById("logo-upload-status").textContent = "";
    renderLogoPreview();
    openModal("modal-company");
}

function renderLogoPreview() {
    const img = document.getElementById("logo-preview-img");
    const placeholder = document.querySelector(".logo-preview-placeholder");
    const removeBtn = document.getElementById("btn-remove-logo");
    if (!img || !placeholder) return;

    if (profile.logo_url) {
        img.src = profile.logo_url;
        img.hidden = false;
        placeholder.hidden = true;
        if (removeBtn) removeBtn.disabled = false;
    } else {
        img.hidden = true;
        img.removeAttribute("src");
        placeholder.hidden = false;
        if (removeBtn) removeBtn.disabled = true;
    }
}

async function handleLogoSelected(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
        showToast("Format logo harus PNG, JPG, atau WebP", false);
        return;
    }
    if (file.size > MAX_LOGO_SIZE) {
        showToast("Ukuran logo maksimal 2 MB", false);
        return;
    }

    const img = document.getElementById("logo-preview-img");
    const placeholder = document.querySelector(".logo-preview-placeholder");
    const status = document.getElementById("logo-upload-status");
    const localUrl = URL.createObjectURL(file);
    img.src = localUrl;
    img.hidden = false;
    if (placeholder) placeholder.hidden = true;
    status.textContent = "Mengunggah logo...";
    status.classList.remove("text-danger");

    const formData = new FormData();
    formData.append("logo", file);

    const res = await apiFetch("/api/auth/logo", { method: "POST", body: formData });
    URL.revokeObjectURL(localUrl);

    if (res && res.ok) {
        const data = await res.json();
        saveProfile(data.user || { logo_url: data.logo_url });
        renderLogoPreview();
        status.textContent = "Logo berhasil diunggah.";
        showToast("Logo perusahaan berhasil diperbarui", true);
    } else {
        renderLogoPreview();
        status.textContent = "";
        if (res) showToast(await readError(res, "Gagal mengunggah logo"), false);
    }
}

async function removeLogo() {
    if (!profile.logo_url) return;
    if (!confirm("Hapus logo perusahaan dari dokumen penawaran dan invoice?")) return;

    const status = document.getElementById("logo-upload-status");
    status.textContent = "Menghapus logo...";

    const res = await apiFetch("/api/auth/logo", { method: "DELETE" });
    if (res && res.ok) {
        const data = await res.json();
        saveProfile(data.user || { logo_url: "" });
        renderLogoPreview();
        status.textContent = "Logo berhasil dihapus.";
        showToast("Logo perusahaan berhasil dihapus", true);
    } else {
        status.textContent = "";
        if (res) showToast(await readError(res, "Gagal menghapus logo"), false);
    }
}

async function saveCompanyProfile(e) {
    e.preventDefault();
    const body = {
        company_name: document.getElementById("comp-name").value.trim(),
        company_email: document.getElementById("comp-email").value.trim(),
        company_phone: document.getElementById("comp-phone").value.trim(),
        company_website: document.getElementById("comp-website").value.trim(),
        company_address: document.getElementById("comp-address").value.trim(),
        bank_name: document.getElementById("comp-bank-name").value.trim(),
        bank_account: document.getElementById("comp-bank-account").value.trim(),
        bank_holder: document.getElementById("comp-bank-holder").value.trim()
    };

    const res = await apiFetch("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(body)
    });

    if (res && res.ok) {
        const data = await res.json();
        saveProfile(data.user);
        closeModal("modal-company");
        showToast("Pengaturan perusahaan berhasil disimpan", true);
    } else if (res) {
        showToast(await readError(res, "Gagal menyimpan pengaturan perusahaan"), false);
    }
}

// ================= RENDER DOKUMEN PROFESIONAL =================
function invoicePaymentNotes() {
    const bankName = (profile.bank_name || "").trim();
    const bankAccount = (profile.bank_account || "").trim();
    const bankHolder = (profile.bank_holder || "").trim();

    if (bankName || bankAccount || bankHolder) {
        const bankLines = [`<strong>${escapeHtml(bankName || "Rekening resmi perusahaan")}</strong>`];
        if (bankAccount) bankLines.push(`No. Rekening: <strong>${escapeHtml(bankAccount)}</strong>`);
        if (bankHolder) bankLines.push(`a.n. <strong>${escapeHtml(bankHolder)}</strong>`);

        return `• Harap lakukan pembayaran penuh sebelum tanggal jatuh tempo.<br>
            • Pembayaran dapat ditransfer ke:
            <span class="doc-bank-details">${bankLines.join("<br>")}</span>
            • Mohon sertakan nomor invoice pada berita transfer dan konfirmasikan bukti transfer kepada tim kami.`;
    }

    return `• Harap lakukan pembayaran penuh sebelum tanggal jatuh tempo.<br>
        • Hubungi tim kami untuk informasi rekening pembayaran resmi.<br>
        • Mohon sertakan nomor invoice pada berita transfer dan konfirmasikan bukti transfer kepada tim kami.`;
}

function renderDocumentPaper(type, data) {
    const isQuo = (type === "quotation");
    const docTitle = isQuo ? "PENAWARAN HARGA" : "FAKTUR TAGIHAN";
    const docSubTitle = isQuo ? "OFFICIAL PRICE QUOTATION" : "COMMERCIAL INVOICE";
    const docNumber = isQuo ? data.quotation_number : data.invoice_number;
    const issueDateStr = formatDate(data.issue_date);
    const dueDateStr = isQuo ? null : formatDate(data.due_date);
    const customer = data.customer || {};
    const items = data.items || [];

    const issuerName = companyDisplayName();
    const issuerEmail = profile.company_email || profile.email || localStorage.getItem("user_email") || "";
    const issuerPhone = profile.company_phone || "";
    const issuerWebsite = profile.company_website || "";
    const issuerAddress = profile.company_address || "";
    const logoUrl = profile.logo_url || "";

    const logoMarkup = logoUrl
        ? `<img class="doc-logo" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(issuerName)}">`
        : `<div class="doc-logo doc-logo-fallback" aria-hidden="true">${escapeHtml(companyInitial())}</div>`;

    const contactLines = [];
    if (issuerEmail) contactLines.push(`<span>✉ ${escapeHtml(issuerEmail)}</span>`);
    if (issuerPhone) contactLines.push(`<span>☎ ${escapeHtml(issuerPhone)}</span>`);
    if (issuerWebsite) contactLines.push(`<span>🌐 ${escapeHtml(issuerWebsite)}</span>`);
    if (issuerAddress) contactLines.push(`<span>📍 ${escapeHtml(issuerAddress)}</span>`);

    return `
        <div class="doc-paper" id="printable-doc-sheet">
            <div class="doc-header-block">
                <div class="doc-issuer-brand">
                    <div class="doc-brand-lockup">
                        ${logoMarkup}
                        <div class="doc-brand-text">
                            <h1>${escapeHtml(issuerName)}</h1>
                            <div class="doc-issuer-sub">Layanan Penjualan, Jasa &amp; Solusi Teknologi</div>
                            <div class="doc-issuer-meta">
                                ${contactLines.length ? contactLines.join("") : "<span>Indonesia</span>"}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="doc-heading-right">
                    <div class="doc-type-title">${docTitle}</div>
                    <div class="doc-type-subtitle">${docSubTitle}</div>
                    <div class="doc-number-display">#${escapeHtml(docNumber)}</div>
                    <div><span class="badge badge-${escapeHtml(data.status)}">${translateStatus(data.status)}</span></div>
                </div>
            </div>

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
                        <span class="val doc-code">${escapeHtml(docNumber)}</span>
                    </div>
                    <div class="doc-meta-item">
                        <span class="label">Tanggal Diterbitkan:</span>
                        <span class="val">${issueDateStr}</span>
                    </div>
                    ${dueDateStr ? `
                    <div class="doc-meta-item">
                        <span class="label">Jatuh Tempo Pembayaran:</span>
                        <span class="val text-danger">${dueDateStr}</span>
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
                        <span class="val doc-code">#${escapeHtml(data.quotation.quotation_number)}</span>
                    </div>
                    ` : ""}
                    <div class="doc-meta-item">
                        <span class="label">Mata Uang Transaksi:</span>
                        <span class="val">IDR (Rupiah Indonesia)</span>
                    </div>
                </div>
            </div>

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

            <div class="doc-calc-container">
                <div class="doc-summary-box">
                    <div class="doc-summary-row">
                        <span>Subtotal Keseluruhan:</span>
                        <strong>${formatRupiah(data.subtotal)}</strong>
                    </div>
                    <div class="doc-summary-row">
                        <span>Pajak (PPN ${formatNumber(data.tax_rate)}%):</span>
                        <strong>${formatRupiah(data.tax_amount)}</strong>
                    </div>
                    <div class="doc-summary-total">
                        <span>GRAND TOTAL:</span>
                        <strong>${formatRupiah(data.grand_total)}</strong>
                    </div>
                </div>
            </div>

            <div class="doc-notes-block">
                <strong>Catatan &amp; Syarat Ketentuan:</strong>
                ${isQuo ? `
                    • Penawaran harga ini resmi dan berlaku selama 14 hari sejak tanggal penerbitan.<br>
                    • Konfirmasi persetujuan dapat dilakukan dengan menandatangani dokumen ini atau menghubungi tim sales kami.<br>
                    • Harga sudah mencakup ketentuan pajak yang berlaku.
                ` : invoicePaymentNotes()}
            </div>

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
                    <div class="doc-sign-role">Tanda Tangan &amp; Cap Perusahaan</div>
                </div>
            </div>

            <div class="doc-footer">
                Dokumen ini dibuat secara digital melalui Quotation &amp; Invoice Manager.
            </div>
        </div>
    `;
}

// ================= VIEW DETAIL MODALS =================
async function viewQuotationDetail(id) {
    const res = await apiFetch(`/api/quotations/${id}`);
    if (!res) return;
    if (!res.ok) {
        showToast(await readError(res, "Gagal memuat detail penawaran"), false);
        return;
    }

    const data = await res.json();
    const q = data.quotation;
    if (!q) {
        showToast("Data quotation tidak ditemukan", false);
        return;
    }

    currentDocData = { type: "quotation", id: q.id, doc: q };

    document.getElementById("detail-title").innerHTML = `
        <span>Detail Penawaran:</span>
        <strong class="doc-code">#${escapeHtml(q.quotation_number)}</strong>
    `;

    document.getElementById("detail-actions-bar").innerHTML = `
        <button type="button" class="btn btn-primary btn-sm" onclick="exportCurrentDocToPDF()">📥 Unduh PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="printCurrentDoc()">🖨️ Cetak</button>
        ${q.status === "draft" ? `<button type="button" class="btn btn-warning btn-sm" onclick="updateQuoStatus(${q.id}, 'sent')">Kirim</button>` : ""}
        ${q.status === "sent" ? `
            <button type="button" class="btn btn-success btn-sm" onclick="updateQuoStatus(${q.id}, 'accepted')">Setujui</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="updateQuoStatus(${q.id}, 'rejected')">Tolak</button>
        ` : ""}
        ${q.status === "accepted" ? `<button type="button" class="btn btn-success btn-sm" onclick="convertToInvoice(${q.id})">Jadikan Invoice</button>` : ""}
        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="closeModal('modal-detail')">Tutup</button>
    `;

    document.getElementById("detail-body").innerHTML = renderDocumentPaper("quotation", q);
    openModal("modal-detail");
}

async function viewInvoiceDetail(id) {
    const res = await apiFetch(`/api/invoices/${id}`);
    if (!res) return;
    if (!res.ok) {
        showToast(await readError(res, "Gagal memuat detail invoice"), false);
        return;
    }

    const data = await res.json();
    const inv = data.invoice;
    if (!inv) {
        showToast("Data invoice tidak ditemukan", false);
        return;
    }

    currentDocData = { type: "invoice", id: inv.id, doc: inv };

    document.getElementById("detail-title").innerHTML = `
        <span>Detail Tagihan:</span>
        <strong class="doc-code">#${escapeHtml(inv.invoice_number)}</strong>
    `;

    document.getElementById("detail-actions-bar").innerHTML = `
        <button type="button" class="btn btn-primary btn-sm" onclick="exportCurrentDocToPDF()">📥 Unduh PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="printCurrentDoc()">🖨️ Cetak</button>
        ${inv.status === "unpaid" ? `
            <button type="button" class="btn btn-success btn-sm" onclick="updateInvStatus(${inv.id}, 'paid')">Tandai Lunas</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="updateInvStatus(${inv.id}, 'cancelled')">Batalkan</button>
        ` : ""}
        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="closeModal('modal-detail')">Tutup</button>
    `;

    document.getElementById("detail-body").innerHTML = renderDocumentPaper("invoice", inv);
    openModal("modal-detail");
}

// ================= EKSPOR PDF ENGINE =================
function waitForImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    return Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
        });
    }));
}

async function triggerPDFDownload(element, filename) {
    const safeFilename = sanitizeFilename(filename);

    if (typeof html2pdf === "undefined") {
        throw new Error("Pustaka html2pdf tidak tersedia");
    }

    const opt = {
        margin: [8, 8, 8, 8], // Margin A4 dalam mm
        filename: safeFilename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            letterRendering: true,
            windowWidth: 1280,
            windowHeight: 1600
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
    };

    await html2pdf().set(opt).from(element).save();
}

async function exportDocumentPDF(type, data, filename) {
    const container = document.getElementById("pdf-export-hidden");
    if (!container || pdfInProgress) return;

    pdfInProgress = true;
    showToast("Menyiapkan dokumen PDF berkualitas tinggi...", true);

    container.innerHTML = renderDocumentPaper(type, data);
    const element = container.querySelector(".doc-paper");
    if (!element) {
        container.innerHTML = "";
        pdfInProgress = false;
        return;
    }

    element.classList.add("pdf-doc");

    try {
        await waitForImages(element);
        await triggerPDFDownload(element, filename);
        showToast(`File ${sanitizeFilename(filename)} berhasil diunduh`, true);
    } catch (err) {
        console.error("Gagal export PDF:", err);
        showToast("Gagal menghasilkan PDF otomatis. Membuka dialog cetak sebagai alternatif...", false);
        printDocument(type, data);
    } finally {
        container.innerHTML = "";
        pdfInProgress = false;
    }
}

function exportCurrentDocToPDF() {
    if (!currentDocData || !currentDocData.doc) {
        showToast("Tidak ada dokumen yang sedang ditampilkan", false);
        return;
    }

    const isQuo = currentDocData.type === "quotation";
    const docNumber = isQuo ? currentDocData.doc.quotation_number : currentDocData.doc.invoice_number;
    const prefix = isQuo ? "Penawaran" : "Invoice";
    exportDocumentPDF(currentDocData.type, currentDocData.doc, `${prefix}_${docNumber}.pdf`);
}

async function downloadQuotationPDF(id) {
    showToast("Memuat data penawaran untuk diekspor...", true);
    const res = await apiFetch(`/api/quotations/${id}`);
    if (!res) return;
    if (!res.ok) {
        showToast(await readError(res, "Gagal memuat detail penawaran"), false);
        return;
    }

    const data = await res.json();
    const q = data.quotation;
    if (!q) {
        showToast("Gagal memuat detail penawaran", false);
        return;
    }

    exportDocumentPDF("quotation", q, `Penawaran_${q.quotation_number}.pdf`);
}

async function downloadInvoicePDF(id) {
    showToast("Memuat data tagihan untuk diekspor...", true);
    const res = await apiFetch(`/api/invoices/${id}`);
    if (!res) return;
    if (!res.ok) {
        showToast(await readError(res, "Gagal memuat detail invoice"), false);
        return;
    }

    const data = await res.json();
    const inv = data.invoice;
    if (!inv) {
        showToast("Gagal memuat detail invoice", false);
        return;
    }

    exportDocumentPDF("invoice", inv, `Invoice_${inv.invoice_number}.pdf`);
}

// ================= CETAK (PRINT TO PDF) =================
async function printDocument(type, data) {
    const area = document.getElementById("print-area");
    if (!area) return;

    area.innerHTML = renderDocumentPaper(type, data);
    try {
        await waitForImages(area);
    } catch (err) {
        // Tetap lanjutkan pencetakan walau gambar gagal dimuat.
    }

    const cleanup = () => {
        area.innerHTML = "";
        window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Cadangan jika event afterprint tidak dipicu oleh peramban.
    setTimeout(cleanup, 60000);
}

function printCurrentDoc() {
    if (!currentDocData || !currentDocData.doc) {
        showToast("Tidak ada dokumen yang sedang ditampilkan", false);
        return;
    }
    printDocument(currentDocData.type, currentDocData.doc);
}

// ================= FETCH PROFIL SEGAR =================
async function fetchUserProfile() {
    try {
        const res = await apiFetch("/api/auth/profile");
        if (!res || !res.ok) return;
        const data = await res.json();
        if (data.user) saveProfile(data.user);
    } catch (err) {
        // Fallback ke data localStorage yang sudah ada
    }
}

// ================= INISIALISASI =================
function initApp() {
    renderBranding();
    bindModalDismiss();
    bindLogoPicker();
    loadCustomers();
    fetchUserProfile();
}

initApp();
