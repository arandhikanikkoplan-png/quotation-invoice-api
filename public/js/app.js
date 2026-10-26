// Periksa status login
const token = localStorage.getItem("jwt_token");
if (!token) {
    window.location.href = "/login";
}

let customersList = [];

// Header profil
document.getElementById("user-display").textContent = 
    `${localStorage.getItem("user_name") || "Pengguna"} (${localStorage.getItem("user_email") || ""})`;

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
    const res = await fetch(url, options);
    if (res.status === 401) {
        logout();
        return null;
    }
    return res;
}

function showGlobalAlert(message, isSuccess = false) {
    const el = document.getElementById("global-alert");
    el.textContent = message;
    el.className = isSuccess ? "alert alert-success" : "alert alert-error";
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 4000);
}

function switchSection(name) {
    ["customers", "quotations", "invoices"].forEach(sec => {
        document.getElementById(`sec-${sec}`).style.display = (sec === name) ? "block" : "none";
        document.getElementById(`pill-${sec}`).classList.toggle("active", sec === name);
    });

    if (name === "customers") loadCustomers();
    if (name === "quotations") loadQuotations();
    if (name === "invoices") loadInvoices();
}

function closeModal(id) {
    document.getElementById(id).classList.remove("show");
}

function formatRupiah(val) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(val);
}

// ================= CUSTOMERS =================
async function loadCustomers() {
    const tbody = document.getElementById("customer-table-body");
    try {
        const res = await apiFetch("/api/customers");
        const data = await res.json();
        customersList = data.customers || [];

        if (customersList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #718096;">Belum ada data pelanggan. Klik "+ Tambah Pelanggan" untuk mulai.</td></tr>`;
            return;
        }

        tbody.innerHTML = customersList.map(c => `
            <tr>
                <td>${c.id}</td>
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
        tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Gagal memuat pelanggan. Pastikan database PostgreSQL aktif.</td></tr>`;
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
        name: document.getElementById("cust-name").value,
        email: document.getElementById("cust-email").value,
        phone: document.getElementById("cust-phone").value,
        address: document.getElementById("cust-address").value
    };

    const res = await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify(body)
    });

    if (res && res.ok) {
        closeModal("modal-customer");
        showGlobalAlert("Pelanggan berhasil disimpan!", true);
        loadCustomers();
    } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan pelanggan");
    }
}

async function deleteCustomer(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus pelanggan ini?")) return;
    const res = await apiFetch(`/api/customers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res && res.ok) {
        showGlobalAlert(data.message, true);
        loadCustomers();
    } else {
        showGlobalAlert(data.error || "Gagal menghapus pelanggan");
    }
}

// ================= DYNAMIC ITEMS & CALCULATION =================
function addItemRow(prefix) {
    const container = document.getElementById(`${prefix}-items-container`);
    const div = document.createElement("div");
    div.className = "item-row";
    div.style.display = "flex";
    div.style.gap = "8px";
    div.style.marginBottom = "8px";
    div.innerHTML = `
        <input type="text" placeholder="Nama Barang / Jasa" class="${prefix}-item-name" required style="flex: 3;">
        <input type="number" placeholder="Qty" value="1" min="1" class="${prefix}-item-qty" oninput="recalculateTotals('${prefix}')" required style="flex: 1;">
        <input type="number" placeholder="Harga Satuan" value="0" min="0" step="1000" class="${prefix}-item-price" oninput="recalculateTotals('${prefix}')" required style="flex: 2;">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); recalculateTotals('${prefix}')">X</button>
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

    const tax = Math.round((taxRate / 100) * subtotal * 100) / 100;
    const grandTotal = subtotal + tax;

    document.getElementById(`${prefix}-subtotal-display`).textContent = formatRupiah(subtotal);
    document.getElementById(`${prefix}-tax-display`).textContent = formatRupiah(tax);
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
        const data = await res.json();
        const list = data.quotations || [];

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #718096;">Belum ada penawaran. Klik "+ Buat Penawaran".</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(q => `
            <tr>
                <td><strong>${escapeHtml(q.quotation_number)}</strong></td>
                <td>${escapeHtml(q.customer ? q.customer.name : "-")}</td>
                <td>${q.issue_date ? q.issue_date.substring(0, 10) : "-"}</td>
                <td>${formatRupiah(q.subtotal)}</td>
                <td>${formatRupiah(q.tax_amount)}</td>
                <td><strong>${formatRupiah(q.grand_total)}</strong></td>
                <td><span class="badge badge-${q.status}">${q.status}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="viewQuotationDetail(${q.id})">Detail</button>
                    ${q.status === 'draft' ? `<button class="btn btn-sm" style="background:#d69e2e;color:#fff;" onclick="updateQuoStatus(${q.id}, 'sent')">Kirim</button>` : ''}
                    ${q.status === 'sent' ? `
                        <button class="btn btn-success btn-sm" onclick="updateQuoStatus(${q.id}, 'accepted')">Setuju</button>
                        <button class="btn btn-danger btn-sm" onclick="updateQuoStatus(${q.id}, 'rejected')">Tolak</button>
                    ` : ''}
                    ${q.status === 'accepted' ? `<button class="btn btn-primary btn-sm" onclick="convertToInvoice(${q.id})">Jadikan Invoice</button>` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteQuotation(${q.id})">Hapus</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Gagal memuat data penawaran.</td></tr>`;
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
        items.push({
            item_name: names[i].value,
            quantity: parseInt(qtys[i].value) || 1,
            unit_price: parseFloat(prices[i].value) || 0
        });
    }

    const res = await apiFetch("/api/quotations", {
        method: "POST",
        body: JSON.stringify({ customer_id: customerId, tax_rate: taxRate, items: items })
    });

    if (res && res.ok) {
        closeModal("modal-quotation");
        showGlobalAlert("Quotation berhasil dibuat!", true);
        loadQuotations();
    } else {
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
        showGlobalAlert(`Status berhasil diubah menjadi ${newStatus}!`, true);
        loadQuotations();
    } else {
        const err = await res.json();
        showGlobalAlert(err.error || "Gagal memperbarui status");
    }
}

async function convertToInvoice(id) {
    if (!confirm("Ubah quotation yang telah disetujui ini menjadi invoice tagihan?")) return;
    const res = await apiFetch(`/api/quotations/${id}/convert-to-invoice`, { method: "POST" });
    if (res && res.ok) {
        showGlobalAlert("Berhasil dikonversi menjadi Invoice!", true);
        switchSection("invoices");
    } else {
        const err = await res.json();
        showGlobalAlert(err.error || "Gagal mengonversi");
    }
}

async function deleteQuotation(id) {
    if (!confirm("Hapus penawaran harga ini?")) return;
    const res = await apiFetch(`/api/quotations/${id}`, { method: "DELETE" });
    if (res && res.ok) {
        showGlobalAlert("Quotation berhasil dihapus", true);
        loadQuotations();
    }
}

async function viewQuotationDetail(id) {
    const res = await apiFetch(`/api/quotations/${id}`);
    const data = await res.json();
    const q = data.quotation;

    document.getElementById("detail-title").textContent = `Detail Penawaran: ${q.quotation_number}`;
    document.getElementById("detail-body").innerHTML = `
        <p><strong>Pelanggan:</strong> ${escapeHtml(q.customer ? q.customer.name : "-")}</p>
        <p><strong>Status:</strong> <span class="badge badge-${q.status}">${q.status}</span></p>
        <p><strong>Tanggal:</strong> ${q.issue_date ? q.issue_date.substring(0, 10) : "-"}</p>
        <h5 style="margin-top: 15px;">Item Penawaran:</h5>
        <table>
            <thead><tr><th>Barang/Jasa</th><th>Qty</th><th>Harga Satuan</th><th>Total</th></tr></thead>
            <tbody>
                ${(q.items || []).map(item => `
                    <tr><td>${escapeHtml(item.item_name)}</td><td>${item.quantity}</td><td>${formatRupiah(item.unit_price)}</td><td>${formatRupiah(item.total_price)}</td></tr>
                `).join("")}
            </tbody>
        </table>
        <div style="margin-top: 15px; text-align: right;">
            <div>Subtotal: <strong>${formatRupiah(q.subtotal)}</strong></div>
            <div>Pajak (${q.tax_rate}%): <strong>${formatRupiah(q.tax_amount)}</strong></div>
            <div style="font-size: 16px; margin-top: 5px;">Grand Total: <strong style="color: #2b6cb0;">${formatRupiah(q.grand_total)}</strong></div>
        </div>
    `;
    document.getElementById("modal-detail").classList.add("show");
}

// ================= INVOICES =================
async function loadInvoices() {
    const tbody = document.getElementById("invoice-table-body");
    try {
        const res = await apiFetch("/api/invoices");
        const data = await res.json();
        const list = data.invoices || [];

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #718096;">Belum ada tagihan. Klik "+ Buat Tagihan Langsung" atau konversi dari Quotation.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(inv => `
            <tr>
                <td><strong>${escapeHtml(inv.invoice_number)}</strong></td>
                <td>${escapeHtml(inv.customer ? inv.customer.name : "-")}</td>
                <td>${inv.issue_date ? inv.issue_date.substring(0, 10) : "-"}</td>
                <td>${inv.due_date ? inv.due_date.substring(0, 10) : "-"}</td>
                <td><strong>${formatRupiah(inv.grand_total)}</strong></td>
                <td><span class="badge badge-${inv.status}">${inv.status}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="viewInvoiceDetail(${inv.id})">Detail</button>
                    ${inv.status === 'unpaid' ? `<button class="btn btn-success btn-sm" onclick="updateInvStatus(${inv.id}, 'paid')">Tandai Lunas</button>` : ''}
                    ${inv.status === 'unpaid' ? `<button class="btn btn-danger btn-sm" onclick="updateInvStatus(${inv.id}, 'cancelled')">Batalkan</button>` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteInvoice(${inv.id})">Hapus</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center;">Gagal memuat data tagihan.</td></tr>`;
    }
}

function openInvoiceModal() {
    populateCustomerSelect("inv-customer");
    document.getElementById("inv-items-container").innerHTML = "";
    addItemRow("inv");
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
        items.push({
            item_name: names[i].value,
            quantity: parseInt(qtys[i].value) || 1,
            unit_price: parseFloat(prices[i].value) || 0
        });
    }

    const res = await apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify({ customer_id: customerId, tax_rate: taxRate, due_date: dueDate, items: items })
    });

    if (res && res.ok) {
        closeModal("modal-invoice");
        showGlobalAlert("Invoice berhasil dibuat!", true);
        loadInvoices();
    } else {
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
        showGlobalAlert(`Status invoice diubah menjadi ${newStatus}!`, true);
        loadInvoices();
    }
}

async function deleteInvoice(id) {
    if (!confirm("Hapus tagihan ini?")) return;
    const res = await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res && res.ok) {
        showGlobalAlert("Invoice berhasil dihapus", true);
        loadInvoices();
    }
}

async function viewInvoiceDetail(id) {
    const res = await apiFetch(`/api/invoices/${id}`);
    const data = await res.json();
    const inv = data.invoice;

    document.getElementById("detail-title").textContent = `Detail Tagihan: ${inv.invoice_number}`;
    document.getElementById("detail-body").innerHTML = `
        <p><strong>Pelanggan:</strong> ${escapeHtml(inv.customer ? inv.customer.name : "-")}</p>
        <p><strong>Status:</strong> <span class="badge badge-${inv.status}">${inv.status}</span></p>
        <p><strong>Tanggal Terbit:</strong> ${inv.issue_date ? inv.issue_date.substring(0, 10) : "-"}</p>
        <p><strong>Jatuh Tempo:</strong> ${inv.due_date ? inv.due_date.substring(0, 10) : "-"}</p>
        <h5 style="margin-top: 15px;">Item Tagihan:</h5>
        <table>
            <thead><tr><th>Barang/Jasa</th><th>Qty</th><th>Harga Satuan</th><th>Total</th></tr></thead>
            <tbody>
                ${(inv.items || []).map(item => `
                    <tr><td>${escapeHtml(item.item_name)}</td><td>${item.quantity}</td><td>${formatRupiah(item.unit_price)}</td><td>${formatRupiah(item.total_price)}</td></tr>
                `).join("")}
            </tbody>
        </table>
        <div style="margin-top: 15px; text-align: right;">
            <div>Subtotal: <strong>${formatRupiah(inv.subtotal)}</strong></div>
            <div>Pajak (${inv.tax_rate}%): <strong>${formatRupiah(inv.tax_amount)}</strong></div>
            <div style="font-size: 16px; margin-top: 5px;">Grand Total: <strong style="color: #2b6cb0;">${formatRupiah(inv.grand_total)}</strong></div>
        </div>
    `;
    document.getElementById("modal-detail").classList.add("show");
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Inisialisasi awal
loadCustomers();
