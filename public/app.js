// app.js - الوظائف الأساسية للواجهة الأمامية

const API_BASE = '/api';
let currentUser = null;
let authToken = null;

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
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('حدث خطأ أثناء تسجيل الدخول');
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
            alert('تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن');
            showLogin();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Register error:', error);
        alert('حدث خطأ أثناء إنشاء الحساب');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    authToken = null;
    showLogin();
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
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
            document.getElementById('statSales').textContent = `المبيعات: ${data.sales}`;
            document.getElementById('statReceivables').textContent = `المستحقات: ${data.receivables}`;
            document.getElementById('statCustomers').textContent = `العملاء: ${data.customers}`;
            document.getElementById('statProducts').textContent = `المنتجات: ${data.products}`;
            document.getElementById('statInvoices').textContent = `الفواتير: ${data.invoices}`;
            document.getElementById('statPayments').textContent = `المدفوعات: ${data.payments}`;
            document.getElementById('statInventory').textContent = `قيمة المخزون: ${data.inventory_value}`;
        }
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// ============================================
// الذكاء الاصطناعي
// ============================================

async function parseTransaction(text) {
    try {
        const response = await fetch(`${API_BASE}/ai/parse`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ text })
        });
        const data = await response.json();
        if (data.success) {
            displayResult(data.parsed);
            return data.parsed;
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('AI Parse error:', error);
        alert('حدث خطأ أثناء تحليل النص');
    }
}

function displayResult(parsed) {
    const resultDiv = document.getElementById('aiResult');
    resultDiv.innerHTML = `
        <pre>${JSON.stringify(parsed, null, 2)}</pre>
        <p>الحالة: ${parsed.ready ? '✅ جاهز للحفظ' : '❌ يحتاج إلى تعديل'}</p>
        ${parsed.validation_errors ? `<p>الأخطاء: ${parsed.validation_errors.join(', ')}</p>` : ''}
    `;
    document.getElementById('aiCommitBtn').style.display = parsed.ready ? 'block' : 'none';
    window.currentParsed = parsed;
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
            alert('تم حفظ المعاملة بنجاح');
            loadInvoices();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Commit error:', error);
        alert('حدث خطأ أثناء حفظ المعاملة');
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
            tbody.innerHTML = data.customers.map(c => `
                <tr>
                    <td>${c.name}</td>
                    <td>${c.phone || '-'}</td>
                    <td>${c.balance || 0}</td>
                    <td>
                        <button onclick="viewCustomer(${c.id})">عرض</button>
                        <button onclick="deleteCustomer(${c.id})">حذف</button>
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
            alert('تم إضافة العميل بنجاح');
            loadCustomers();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Add customer error:', error);
        alert('حدث خطأ أثناء إضافة العميل');
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
            tbody.innerHTML = data.products.map(p => `
                <tr>
                    <td>${p.name}</td>
                    <td>${p.unit || 'قطعة'}</td>
                    <td>${p.sale_price || 0}</td>
                    <td>${p.cost_price || 0}</td>
                    <td>${p.stock || 0}</td>
                    <td>
                        <button onclick="adjustStock(${p.id})">تعديل المخزون</button>
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
            alert('تم إضافة المنتج بنجاح');
            loadProducts();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Add product error:', error);
        alert('حدث خطأ أثناء إضافة المنتج');
    }
}

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
            tbody.innerHTML = data.invoices.map(i => `
                <tr>
                    <td>${i.inv_no}</td>
                    <td>${i.customer_name || '-'}</td>
                    <td>${i.total || 0}</td>
                    <td>${i.paid || 0}</td>
                    <td>${i.status}</td>
                    <td>${new Date(i.created_at).toLocaleDateString()}</td>
                    <td>
                        <button onclick="viewInvoice(${i.id})">عرض</button>
                        <button onclick="cancelInvoice(${i.id})">إلغاء</button>
                        ${i.pdf_path ? `<button onclick="downloadPDF('${i.inv_no}')">PDF</button>` : ''}
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load invoices error:', error);
    }
}

async function cancelInvoice(id) {
    if (!confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟')) return;
    try {
        const response = await fetch(`${API_BASE}/invoices/${id}/cancel`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            alert('تم إلغاء الفاتورة بنجاح');
            loadInvoices();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Cancel invoice error:', error);
        alert('حدث خطأ أثناء إلغاء الفاتورة');
    }
}

// ============================================
// فواتير الشراء
// ============================================

async function loadPurchases() {
    try {
        const response = await fetch(`${API_BASE}/purchases`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            const tbody = document.getElementById('purchasesList');
            tbody.innerHTML = data.invoices.map(i => `
                <tr>
                    <td>${i.inv_no}</td>
                    <td>${i.supplier_name || '-'}</td>
                    <td>${i.total || 0}</td>
                    <td>${new Date(i.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load purchases error:', error);
    }
}

async function addPurchase(supplier, items) {
    try {
        const response = await fetch(`${API_BASE}/purchases`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ supplier, items })
        });
        const data = await response.json();
        if (data.success) {
            alert('تم إنشاء فاتورة الشراء بنجاح');
            loadPurchases();
            loadProducts();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Add purchase error:', error);
        alert('حدث خطأ أثناء إنشاء فاتورة الشراء');
    }
}

// ============================================
// التقارير
// ============================================

async function loadReport(type) {
    try {
        const response = await fetch(`${API_BASE}/reports/${type}`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
            const content = document.getElementById('reportContent');
            content.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
    } catch (error) {
        console.error('Load report error:', error);
        alert('حدث خطأ أثناء تحميل التقرير');
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
            alert('تم حفظ الإعداد بنجاح');
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Save setting error:', error);
        alert('حدث خطأ أثناء حفظ الإعداد');
    }
}

// ============================================
// التنقل بين الصفحات
// ============================================

function showLogin() {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('appContent').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').style.display = 'block';
    document.getElementById('appContent').style.display = 'none';
}

function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    document.getElementById('userName').textContent = currentUser ? currentUser.name : '';
}

// ============================================
// أحداث (Event Listeners)
// ============================================

// تسجيل الدخول
document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(username, password);
});

// تسجيل مستخدم
document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const name = document.getElementById('regName').value;
    register(username, password, name);
});

// تسجيل الخروج
document.getElementById('logoutBtn')?.addEventListener('click', logout);

// AI تحليل
document.getElementById('aiParseBtn')?.addEventListener('click', () => {
    const text = document.getElementById('aiInput').value;
    if (text.trim()) {
        parseTransaction(text);
    } else {
        alert('الرجاء إدخال نص المعاملة');
    }
});

// AI تأكيد
document.getElementById('aiCommitBtn')?.addEventListener('click', () => {
    if (window.currentParsed) {
        commitTransaction(window.currentParsed);
    }
});

// إضافة عميل
document.getElementById('customerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('customerName').value;
    const phone = document.getElementById('customerPhone').value;
    const address = document.getElementById('customerAddress').value;
    if (name.trim()) {
        addCustomer(name, phone, address);
        e.target.reset();
    } else {
        alert('الرجاء إدخال اسم العميل');
    }
});

// إضافة منتج
document.getElementById('productForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('productName').value;
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const cost = parseFloat(document.getElementById('productCost').value) || 0;
    const stock = parseFloat(document.getElementById('productStock').value) || 0;
    if (name.trim()) {
        addProduct(name, 'قطعة', price, cost, stock);
        e.target.reset();
    } else {
        alert('الرجاء إدخال اسم المنتج');
    }
});

// التقارير
document.querySelectorAll('.report-tab')?.forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadReport(tab.dataset.report);
    });
});

// ============================================
// التهيئة
// ============================================

// التحقق من وجود توكن في localStorage
const savedToken = localStorage.getItem('token');
const savedUser = localStorage.getItem('user');
if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);
    showApp();
    loadDashboard();
    loadCustomers();
    loadProducts();
    loadInvoices();
    loadPurchases();
} else {
    showLogin();
}
