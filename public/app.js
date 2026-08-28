// app.js - الوظائف الأساسية للواجهة الأمامية

const API_BASE = '/api';
let currentUser = null;
let authToken = null;
let currentParsed = null;

// ============================================
// المصادقة
// ============================================

async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            showApp();
            loadDashboard();
            loadCustomers();
            loadProducts();
            loadInvoices();
            loadPurchases();
            loadSuppliers();
            loadAudit();
            loadSettings();
        } else {
            showToast(data.error || 'فشل تسجيل الدخول', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('حدث خطأ أثناء تسجيل الدخول', 'error');
    }
}

async function register(username, password, name) {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, name })
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم إنشاء الحساب بنجاح 🎉', 'success');
            showLogin();
        } else {
            showToast(data.error || 'فشل إنشاء الحساب', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast('حدث خطأ أثناء إنشاء الحساب', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    authToken = null;
    showLogin();
    showToast('تم تسجيل الخروج', 'info');
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

// ============================================
// عرض الصفحات
// ============================================

function showLogin() {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('appContent').style.display = 'none';
    document.getElementById('mainNav').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').style.display = 'block';
    document.getElementById('appContent').style.display = 'none';
    document.getElementById('mainNav').style.display = 'none';
}

function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    document.getElementById('mainNav').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser ? currentUser.name || currentUser.username : 'مستخدم';
    
    // ✅ إظهار القسم الافتراضي
    showSection('dashboard');
}

function showSection(sectionId) {
    // إخفاء جميع الأقسام
    document.querySelectorAll('section').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });
    
    // إظهار القسم المطلوب
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
        section.classList.add('active');
    }
    
    // تحديث الروابط النشطة
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });
}

// ============================================
// عرض رسائل التنبيه (Toast)
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        // إنشاء container إذا لم يوجد
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; max-width:400px;';
        document.body.appendChild(newContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
        color: ${type === 'warning' ? '#333' : '#fff'};
        padding: 12px 20px;
        margin-top: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        font-size: 14px;
    `;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// معالجات النماذج (Handlers)
// ============================================

function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!username || !password) {
        showToast('الرجاء إدخال اسم المستخدم وكلمة المرور', 'warning');
        return;
    }
    
    login(username, password);
}

function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const name = document.getElementById('regName').value.trim();
    
    if (!username || !password) {
        showToast('الرجاء إدخال اسم المستخدم وكلمة المرور', 'warning');
        return;
    }
    
    if (password.length < 6) {
        showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
        return;
    }
    
    register(username, password, name || username);
}

function handleAIParse() {
    const text = document.getElementById('aiInput').value.trim();
    if (!text) {
        showToast('الرجاء إدخال نص المعاملة', 'warning');
        return;
    }
    parseTransaction(text);
}

function handleAICommit() {
    if (currentParsed) {
        commitTransaction(currentParsed);
    } else {
        showToast('لا توجد معاملة للحفظ', 'warning');
    }
}

function handleAddCustomer() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    
    if (!name) {
        showToast('الرجاء إدخال اسم العميل', 'warning');
        return;
    }
    
    addCustomer(name, phone, address);
}

function handleAddSupplier() {
    const name = document.getElementById('supplierName').value.trim();
    const phone = document.getElementById('supplierPhone').value.trim();
    const address = document.getElementById('supplierAddress').value.trim();
    
    if (!name) {
        showToast('الرجاء إدخال اسم المورد', 'warning');
        return;
    }
    
    addSupplier(name, phone, address);
}

function handleAddProduct() {
    const name = document.getElementById('productName').value.trim();
    const unit = document.getElementById('productUnit').value.trim() || 'قطعة';
    const salePrice = parseFloat(document.getElementById('productSalePrice').value) || 0;
    const costPrice = parseFloat(document.getElementById('productCostPrice').value) || 0;
    const stock = parseFloat(document.getElementById('productStock').value) || 0;
    
    if (!name) {
        showToast('الرجاء إدخال اسم المنتج', 'warning');
        return;
    }
    
    addProduct(name, unit, salePrice, costPrice, stock);
}

function handleAddPurchase() {
    submitPurchase();
}

// ============================================
// لوحة التحكم
// ============================================

async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/dashboard`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('statSales').textContent = data.sales || 0;
            document.getElementById('statReceivables').textContent = data.receivables || 0;
            document.getElementById('statCustomers').textContent = data.customers || 0;
            document.getElementById('statProducts').textContent = data.products || 0;
            document.getElementById('statInvoices').textContent = data.invoices || 0;
            document.getElementById('statPayments').textContent = data.payments || 0;
            document.getElementById('statInventory').textContent = data.inventory_value || 0;
        }
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// ============================================
// الذكاء الاصطناعي
// ============================================

async function parseTransaction(text) {
    const btn = document.getElementById('aiParseBtn');
    const resultDiv = document.getElementById('aiResult');
    
    btn.disabled = true;
    btn.textContent = '⏳ جاري التحليل...';
    resultDiv.innerHTML = '<p class="text-muted">⏳ جاري تحليل النص...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/ai/parse`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ text })
        });
        const data = await response.json();
        if (data.success) {
            currentParsed = data.parsed;
            displayResult(data.parsed);
        } else {
            resultDiv.innerHTML = `<p class="text-danger">❌ ${data.error || 'خطأ في التحليل'}</p>`;
        }
    } catch (error) {
        console.error('AI Parse error:', error);
        resultDiv.innerHTML = '<p class="text-danger">❌ حدث خطأ أثناء تحليل النص</p>';
        showToast('حدث خطأ أثناء تحليل النص', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 تحليل';
    }
}

function displayResult(parsed) {
    const resultDiv = document.getElementById('aiResult');
    resultDiv.innerHTML = `
        <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-top:10px;">
            <pre style="margin:0; white-space:pre-wrap; word-break:break-all;">${JSON.stringify(parsed, null, 2)}</pre>
            <p style="margin-top:10px;">
                <strong>الحالة:</strong> 
                <span style="color:${parsed.ready ? '#28a745' : '#dc3545'}">
                    ${parsed.ready ? '✅ جاهز للحفظ' : '❌ يحتاج إلى تعديل'}
                </span>
            </p>
            ${parsed.validation_errors && parsed.validation_errors.length > 0 ? 
                `<p style="color:#dc3545;"><strong>الأخطاء:</strong> ${parsed.validation_errors.join(', ')}</p>` : ''}
        </div>
    `;
    document.getElementById('aiCommitBtn').style.display = parsed.ready ? 'inline-block' : 'none';
}

async function commitTransaction(parsed) {
    try {
        const response = await fetch(`${API_BASE}/transactions/commit`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ parsed })
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم حفظ المعاملة بنجاح ✅', 'success');
            document.getElementById('aiResult').innerHTML = `
                <div style="background:#d4edda; padding:15px; border-radius:8px; color:#155724;">
                    ✅ تم حفظ المعاملة بنجاح<br>
                    رقم الفاتورة: ${data.invoice?.inv_no || 'N/A'}
                </div>
            `;
            document.getElementById('aiCommitBtn').style.display = 'none';
            loadInvoices();
            loadDashboard();
        } else {
            showToast(data.error || 'فشل حفظ المعاملة', 'error');
        }
    } catch (error) {
        console.error('Commit error:', error);
        showToast('حدث خطأ أثناء حفظ المعاملة', 'error');
    }
}

// ============================================
// العملاء
// ============================================

async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            const tbody = document.getElementById('customersList');
            if (!data.customers || data.customers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">لا يوجد عملاء</td></tr>';
                return;
            }
            tbody.innerHTML = data.customers.map(c => `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.phone || '-'}</td>
                    <td>${c.address || '-'}</td>
                    <td>${c.balance || 0}</td>
                    <td>
                        <button onclick="viewCustomer(${c.id})" class="btn-sm btn-info">👁️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load customers error:', error);
    }
}

async function addCustomer(name, phone, address) {
    try {
        const response = await fetch(`${API_BASE}/customers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name, phone, address })
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم إضافة العميل بنجاح ✅', 'success');
            document.getElementById('customerForm').reset();
            loadCustomers();
            loadDashboard();
        } else {
            showToast(data.error || 'فشل إضافة العميل', 'error');
        }
    } catch (error) {
        console.error('Add customer error:', error);
        showToast('حدث خطأ أثناء إضافة العميل', 'error');
    }
}

// ============================================
// الموردين
// ============================================

async function loadSuppliers() {
    try {
        const response = await fetch(`${API_BASE}/suppliers`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            const tbody = document.getElementById('suppliersList');
            if (!data.suppliers || data.suppliers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">لا يوجد موردين</td></tr>';
                return;
            }
            tbody.innerHTML = data.suppliers.map(s => `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.phone || '-'}</td>
                    <td>${s.address || '-'}</td>
                    <td>${s.balance || 0}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load suppliers error:', error);
    }
}

async function addSupplier(name, phone, address) {
    try {
        const response = await fetch(`${API_BASE}/suppliers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name, phone, address })
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم إضافة المورد بنجاح ✅', 'success');
            document.getElementById('supplierForm').reset();
            loadSuppliers();
        } else {
            showToast(data.error || 'فشل إضافة المورد', 'error');
        }
    } catch (error) {
        console.error('Add supplier error:', error);
        showToast('حدث خطأ أثناء إضافة المورد', 'error');
    }
}

// ============================================
// المنتجات
// ============================================

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            const tbody = document.getElementById('productsList');
            if (!data.products || data.products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">لا يوجد منتجات</td></tr>';
                return;
            }
            tbody.innerHTML = data.products.map(p => `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.unit || 'قطعة'}</td>
                    <td>${p.sale_price || 0}</td>
                    <td>${p.cost_price || 0}</td>
                    <td>${p.stock || 0}</td>
                    <td>
                        <button onclick="adjustStock(${p.id})" class="btn-sm btn-primary">📦</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load products error:', error);
    }
}

async function addProduct(name, unit, salePrice, costPrice, stock) {
    try {
        const response = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name, unit, sale_price: salePrice, cost_price: costPrice, stock })
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم إضافة المنتج بنجاح ✅', 'success');
            document.getElementById('productForm').reset();
            loadProducts();
            loadDashboard();
        } else {
            showToast(data.error || 'فشل إضافة المنتج', 'error');
        }
    } catch (error) {
        console.error('Add product error:', error);
        showToast('حدث خطأ أثناء إضافة المنتج', 'error');
    }
}

window.adjustStock = function(id) {
    const quantity = prompt('أدخل الكمية (رقم موجب للإضافة، سالب للخصم):');
    if (quantity === null) return;
    
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty === 0) {
        showToast('الكمية غير صحيحة', 'error');
        return;
    }
    
    fetch(`${API_BASE}/products/${id}/stock`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ quantity: qty })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showToast('تم تحديث المخزون بنجاح ✅', 'success');
            loadProducts();
        } else {
            showToast(data.error || 'فشل تحديث المخزون', 'error');
        }
    })
    .catch(err => {
        console.error('Adjust stock error:', err);
        showToast('حدث خطأ أثناء تحديث المخزون', 'error');
    });
};

// ============================================
// الفواتير
// ============================================

async function loadInvoices() {
    try {
        const response = await fetch(`${API_BASE}/invoices`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            const tbody = document.getElementById('invoicesList');
            if (!data.invoices || data.invoices.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">لا يوجد فواتير</td></tr>';
                return;
            }
            tbody.innerHTML = data.invoices.map(i => `
                <tr>
                    <td><strong>${i.inv_no}</strong></td>
                    <td>${i.customer_name || '-'}</td>
                    <td>${i.total || 0}</td>
                    <td>${i.paid || 0}</td>
                    <td><span class="status ${i.status}">${i.status}</span></td>
                    <td>${new Date(i.created_at).toLocaleDateString('ar')}</td>
                    <td>
                        <button onclick="viewInvoice(${i.id})" class="btn-sm btn-info">👁️</button>
                        ${i.status !== 'cancelled' ? `<button onclick="cancelInvoice(${i.id})" class="btn-sm btn-danger">🗑️</button>` : ''}
                        ${i.pdf_path ? `<button onclick="downloadPDF('${i.inv_no}')" class="btn-sm btn-success">📄</button>` : ''}
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load invoices error:', error);
    }
}

async function cancelInvoice(id) {
    if (!confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟ سيتم استرجاع المخزون.')) return;
    try {
        const response = await fetch(`${API_BASE}/invoices/${id}/cancel`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم إلغاء الفاتورة بنجاح ✅', 'success');
            loadInvoices();
            loadProducts();
        } else {
            showToast(data.error || 'فشل إلغاء الفاتورة', 'error');
        }
    } catch (error) {
        console.error('Cancel invoice error:', error);
        showToast('حدث خطأ أثناء إلغاء الفاتورة', 'error');
    }
}

function downloadPDF(invNo) {
    window.open(`/invoices/${invNo}.pdf`, '_blank');
}

// ============================================
// فواتير الشراء
// ============================================

let purchaseItems = [];

function addPurchaseItem() {
    const container = document.getElementById('purchaseItemsContainer');
    const index = purchaseItems.length;
    
    const div = document.createElement('div');
    div.className = 'purchase-item';
    div.innerHTML = `
        <input type="text" placeholder="اسم المنتج" id="pItemName_${index}">
        <input type="number" placeholder="الكمية" id="pItemQty_${index}">
        <input type="number" placeholder="السعر" id="pItemPrice_${index}">
        <button onclick="removePurchaseItem(${index})" class="btn-sm btn-danger">✕</button>
    `;
    container.appendChild(div);
    purchaseItems.push(index);
}

function removePurchaseItem(index) {
    const container = document.getElementById('purchaseItemsContainer');
    const children = container.children;
    for (let i = 0; i < children.length; i++) {
        if (children[i].dataset.index == index) {
            children[i].remove();
            break;
        }
    }
    purchaseItems = purchaseItems.filter(i => i !== index);
}

async function submitPurchase() {
    const supplier = document.getElementById('purchaseSupplier').value.trim();
    if (!supplier) {
        showToast('الرجاء إدخال اسم المورد', 'error');
        return;
    }
    
    const items = [];
    const container = document.getElementById('purchaseItemsContainer');
    const children = container.children;
    
    for (let i = 0; i < children.length; i++) {
        const div = children[i];
        const name = div.querySelector('[id^="pItemName_"]')?.value.trim();
        const qty = parseFloat(div.querySelector('[id^="pItemQty_"]')?.value);
        const price = parseFloat(div.querySelector('[id^="pItemPrice_"]')?.value);
        
        if (name && qty > 0 && price >= 0) {
            items.push({ name, qty, price });
        }
    }
    
    if (items.length === 0) {
        showToast('الرجاء إضافة صنف واحد على الأقل', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/purchases`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ supplier, items })
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم إنشاء فاتورة الشراء بنجاح ✅', 'success');
            document.getElementById('purchaseForm').reset();
            document.getElementById('purchaseItemsContainer').innerHTML = '';
            purchaseItems = [];
            loadPurchases();
            loadProducts();
        } else {
            showToast(data.error || 'فشل إنشاء فاتورة الشراء', 'error');
        }
    } catch (error) {
        console.error('Submit purchase error:', error);
        showToast('حدث خطأ أثناء إنشاء فاتورة الشراء', 'error');
    }
}

async function loadPurchases() {
    try {
        const response = await fetch(`${API_BASE}/purchases`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            const tbody = document.getElementById('purchasesList');
            if (!data.invoices || data.invoices.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">لا يوجد فواتير شراء</td></tr>';
                return;
            }
            tbody.innerHTML = data.invoices.map(i => `
                <tr>
                    <td><strong>${i.inv_no}</strong></td>
                    <td>${i.supplier_name || '-'}</td>
                    <td>${i.total || 0}</td>
                    <td>${i.status}</td>
                    <td>${new Date(i.created_at).toLocaleDateString('ar')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load purchases error:', error);
    }
}

// ============================================
// التقارير
// ============================================

async function loadReport(type) {
    const content = document.getElementById('reportContent');
    content.innerHTML = '<p class="text-muted">⏳ جاري تحميل التقرير...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/reports/${type}`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            content.innerHTML = `<pre style="background:#1e1e1e; color:#d4d4d4; padding:15px; border-radius:8px; overflow-x:auto;">${JSON.stringify(data, null, 2)}</pre>`;
        } else {
            content.innerHTML = `<p class="text-danger">❌ ${data.error || 'خطأ في تحميل التقرير'}</p>`;
        }
    } catch (error) {
        console.error('Load report error:', error);
        content.innerHTML = '<p class="text-danger">❌ حدث خطأ في تحميل التقرير</p>';
    }
}

// ============================================
// سجل التدقيق
// ============================================

async function loadAudit() {
    try {
        const response = await fetch(`${API_BASE}/audit`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            const tbody = document.getElementById('auditList');
            if (!data.logs || data.logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">لا يوجد سجلات</td></tr>';
                return;
            }
            tbody.innerHTML = data.logs.map(log => `
                <tr>
                    <td>${log.id}</td>
                    <td><span class="status active">${log.action}</span></td>
                    <td>${log.entity_type}</td>
                    <td>${log.details || '-'}</td>
                    <td>${new Date(log.created_at).toLocaleString('ar')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load audit error:', error);
        showToast('حدث خطأ في تحميل سجل التدقيق', 'error');
    }
}

// ============================================
// الإعدادات
// ============================================

async function saveSetting(key, value) {
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ key, value })
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم حفظ الإعداد بنجاح ✅', 'success');
        } else {
            showToast(data.error || 'فشل حفظ الإعداد', 'error');
        }
    } catch (error) {
        console.error('Save setting error:', error);
        showToast('حدث خطأ أثناء حفظ الإعداد', 'error');
    }
}

async function loadSettings() {
    // يتم تحميل الإعدادات عند الحاجة
}

async function saveSettings() {
    const settings = {
        company_name: document.getElementById('setting_company_name')?.value || '',
        company_phone: document.getElementById('setting_company_phone')?.value || '',
        smtp_host: document.getElementById('setting_smtp_host')?.value || '',
        smtp_port: document.getElementById('setting_smtp_port')?.value || '',
        smtp_user: document.getElementById('setting_smtp_user')?.value || '',
        smtp_pass: document.getElementById('setting_smtp_pass')?.value || ''
    };
    
    for (const [key, value] of Object.entries(settings)) {
        if (value) {
            await saveSetting(key, value);
        }
    }
    
    showToast('تم حفظ جميع الإعدادات ✅', 'success');
}

// ============================================
// المدفوعات
// ============================================

async function recordPayment(invoiceId, amount, method, reference) {
    try {
        const response = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ invoiceId, amount, method, reference })
        });
        const data = await response.json();
        if (data.success) {
            showToast('تم تسجيل الدفعة بنجاح ✅', 'success');
            loadInvoices();
        } else {
            showToast(data.error || 'فشل تسجيل الدفعة', 'error');
        }
    } catch (error) {
        console.error('Record payment error:', error);
        showToast('حدث خطأ أثناء تسجيل الدفعة', 'error');
    }
}

// ============================================
// التهيئة
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        try {
            authToken = savedToken;
            currentUser = JSON.parse(savedUser);
            showApp();
            loadDashboard();
            loadCustomers();
            loadProducts();
            loadInvoices();
            loadPurchases();
            loadSuppliers();
            loadAudit();
            loadSettings();
            
            // تحديث التاريخ
            const dateEl = document.getElementById('dashboardDate');
            if (dateEl) {
                dateEl.textContent = new Date().toLocaleDateString('ar', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
        } catch (e) {
            console.error('Init error:', e);
            showLogin();
        }
    } else {
        showLogin();
    }
});

console.log('🌉 Jusoor Accounting v4.0 - تم التحميل بنجاح');
