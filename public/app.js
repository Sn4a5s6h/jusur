// app.js - الوظائف الأساسية للواجهة الأمامية

const API_BASE = '/api';
let currentUser = null;
let authToken = null;
let currentParsed = null;

// ============================================
// LOCAL STORAGE - التخزين المحلي
// ============================================

const STORAGE_KEYS = {
    TOKEN: 'jusoor_token',
    USER: 'jusoor_user',
    INVOICES: 'jusoor_invoices',
    CUSTOMERS: 'jusoor_customers',
    PRODUCTS: 'jusoor_products',
    SUPPLIERS: 'jusoor_suppliers',
    PURCHASES: 'jusoor_purchases',
    SETTINGS: 'jusoor_settings',
    REMEMBER_ME: 'jusoor_remember_me'
};

// حفظ البيانات في LocalStorage
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Save to localStorage error:', error);
        return false;
    }
}

// جلب البيانات من LocalStorage
function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Get from localStorage error:', error);
        return null;
    }
}

// حذف بيانات من LocalStorage
function removeFromLocalStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Remove from localStorage error:', error);
        return false;
    }
}

// مسح جميع بيانات التطبيق
function clearAllLocalData() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    console.log('🗑️ تم مسح جميع البيانات المحلية');
    showToast('تم مسح جميع البيانات المحلية', 'info');
}

// ============================================
// حفظ جلسة المستخدم (تذكرني)
// ============================================

function saveUserSession(user, token, remember = true) {
    if (remember) {
        saveToLocalStorage(STORAGE_KEYS.USER, user);
        saveToLocalStorage(STORAGE_KEYS.TOKEN, token);
        saveToLocalStorage(STORAGE_KEYS.REMEMBER_ME, true);
    }
}

function getUserSession() {
    const user = getFromLocalStorage(STORAGE_KEYS.USER);
    const token = getFromLocalStorage(STORAGE_KEYS.TOKEN);
    const remember = getFromLocalStorage(STORAGE_KEYS.REMEMBER_ME);
    return { user, token, remember };
}

function clearUserSession() {
    removeFromLocalStorage(STORAGE_KEYS.USER);
    removeFromLocalStorage(STORAGE_KEYS.TOKEN);
    removeFromLocalStorage(STORAGE_KEYS.REMEMBER_ME);
}

// ============================================
// حفظ المعاملات محلياً
// ============================================

function saveInvoicesLocally(invoices) {
    return saveToLocalStorage(STORAGE_KEYS.INVOICES, invoices);
}

function getInvoicesLocally() {
    return getFromLocalStorage(STORAGE_KEYS.INVOICES) || [];
}

function saveCustomersLocally(customers) {
    return saveToLocalStorage(STORAGE_KEYS.CUSTOMERS, customers);
}

function getCustomersLocally() {
    return getFromLocalStorage(STORAGE_KEYS.CUSTOMERS) || [];
}

function saveProductsLocally(products) {
    return saveToLocalStorage(STORAGE_KEYS.PRODUCTS, products);
}

function getProductsLocally() {
    return getFromLocalStorage(STORAGE_KEYS.PRODUCTS) || [];
}

function saveSuppliersLocally(suppliers) {
    return saveToLocalStorage(STORAGE_KEYS.SUPPLIERS, suppliers);
}

function getSuppliersLocally() {
    return getFromLocalStorage(STORAGE_KEYS.SUPPLIERS) || [];
}

function savePurchasesLocally(purchases) {
    return saveToLocalStorage(STORAGE_KEYS.PURCHASES, purchases);
}

function getPurchasesLocally() {
    return getFromLocalStorage(STORAGE_KEYS.PURCHASES) || [];
}

// ============================================
// دالة تسجيل الدخول (معدلة)
// ============================================

async function login(username, password, remember = true) {
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
            
            // ✅ حفظ الجلسة محلياً
            saveUserSession(currentUser, authToken, remember);
            
            showApp();
            await loadAllData();
            
            showToast('تم تسجيل الدخول بنجاح ✅', 'success');
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
    clearUserSession();
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
// تحميل جميع البيانات وتخزينها محلياً
// ============================================

async function loadAllData() {
    try {
        // تحميل وحفظ الفواتير
        const invoicesRes = await fetch(`${API_BASE}/invoices`, {
            headers: getHeaders()
        });
        const invoicesData = await invoicesRes.json();
        if (invoicesData.success) {
            saveInvoicesLocally(invoicesData.invoices);
        }

        // تحميل وحفظ العملاء
        const customersRes = await fetch(`${API_BASE}/customers`, {
            headers: getHeaders()
        });
        const customersData = await customersRes.json();
        if (customersData.success) {
            saveCustomersLocally(customersData.customers);
        }

        // تحميل وحفظ المنتجات
        const productsRes = await fetch(`${API_BASE}/products`, {
            headers: getHeaders()
        });
        const productsData = await productsRes.json();
        if (productsData.success) {
            saveProductsLocally(productsData.products);
        }

        // تحميل وحفظ الموردين
        const suppliersRes = await fetch(`${API_BASE}/suppliers`, {
            headers: getHeaders()
        });
        const suppliersData = await suppliersRes.json();
        if (suppliersData.success) {
            saveSuppliersLocally(suppliersData.suppliers);
        }

        // تحميل وحفظ فواتير الشراء
        const purchasesRes = await fetch(`${API_BASE}/purchases`, {
            headers: getHeaders()
        });
        const purchasesData = await purchasesRes.json();
        if (purchasesData.success) {
            savePurchasesLocally(purchasesData.invoices);
        }

        // تحديث لوحة التحكم
        await loadDashboard();

        console.log('✅ تم حفظ جميع البيانات محلياً');
    } catch (error) {
        console.error('Load all data error:', error);
        // استخدام البيانات المحلية في حالة فشل الخادم
        loadFromLocalBackup();
    }
}

// ============================================
// تحميل البيانات من النسخة الاحتياطية المحلية
// ============================================

function loadFromLocalBackup() {
    const invoices = getInvoicesLocally();
    const customers = getCustomersLocally();
    const products = getProductsLocally();
    const suppliers = getSuppliersLocally();
    const purchases = getPurchasesLocally();

    if (invoices.length > 0) {
        renderInvoices(invoices);
        console.log(`📄 تم تحميل ${invoices.length} فاتورة من النسخة المحلية`);
    }

    if (customers.length > 0) {
        renderCustomers(customers);
        console.log(`👤 تم تحميل ${customers.length} عميل من النسخة المحلية`);
    }

    if (products.length > 0) {
        renderProducts(products);
        console.log(`📦 تم تحميل ${products.length} منتج من النسخة المحلية`);
    }

    if (suppliers.length > 0) {
        renderSuppliers(suppliers);
        console.log(`🚚 تم تحميل ${suppliers.length} مورد من النسخة المحلية`);
    }

    if (purchases.length > 0) {
        renderPurchases(purchases);
        console.log(`📥 تم تحميل ${purchases.length} فاتورة شراء من النسخة المحلية`);
    }

    showToast('تم تحميل البيانات من النسخة الاحتياطية المحلية', 'info');
}

// ============================================
// دوال العرض للنسخة المحلية
// ============================================

function renderCustomers(customers) {
    const tbody = document.getElementById('customersList');
    if (!tbody) return;
    
    if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">لا يوجد عملاء</td></tr>';
        return;
    }
    
    tbody.innerHTML = customers.map(c => `
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

function renderProducts(products) {
    const tbody = document.getElementById('productsList');
    if (!tbody) return;
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">لا يوجد منتجات</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(p => `
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

function renderSuppliers(suppliers) {
    const tbody = document.getElementById('suppliersList');
    if (!tbody) return;
    
    if (!suppliers || suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">لا يوجد موردين</td></tr>';
        return;
    }
    
    tbody.innerHTML = suppliers.map(s => `
        <tr>
            <td><strong>${s.name}</strong></td>
            <td>${s.phone || '-'}</td>
            <td>${s.address || '-'}</td>
            <td>${s.balance || 0}</td>
        </tr>
    `).join('');
}

function renderInvoices(invoices) {
    const tbody = document.getElementById('invoicesList');
    if (!tbody) return;
    
    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">لا يوجد فواتير</td></tr>';
        return;
    }
    
    tbody.innerHTML = invoices.map(i => `
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

function renderPurchases(purchases) {
    const tbody = document.getElementById('purchasesList');
    if (!tbody) return;
    
    if (!purchases || purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">لا يوجد فواتير شراء</td></tr>';
        return;
    }
    
    tbody.innerHTML = purchases.map(i => `
        <tr>
            <td><strong>${i.inv_no}</strong></td>
            <td>${i.supplier_name || '-'}</td>
            <td>${i.total || 0}</td>
            <td>${i.status}</td>
            <td>${new Date(i.created_at).toLocaleDateString('ar')}</td>
        </tr>
    `).join('');
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
    
    // ✅ تحميل البيانات من النسخة المحلية أولاً (للسرعة)
    loadFromLocalBackup();
    
    // ✅ ثم محاولة تحديث البيانات من الخادم
    loadAllData().catch(() => {
        console.log('⚠️ استخدام البيانات المحلية فقط');
    });
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
    const remember = document.getElementById('rememberMe')?.checked || true;
    
    if (!username || !password) {
        showToast('الرجاء إدخال اسم المستخدم وكلمة المرور', 'warning');
        return;
    }
    
    login(username, password, remember);
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
        // استخدام البيانات المحلية
        updateDashboardFromLocal();
    }
}

function updateDashboardFromLocal() {
    const invoices = getInvoicesLocally();
    const customers = getCustomersLocally();
    const products = getProductsLocally();
    const payments = getFromLocalStorage(STORAGE_KEYS.PAYMENTS) || [];
    
    const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalReceivables = invoices.reduce((sum, inv) => sum + ((inv.total || 0) - (inv.paid || 0)), 0);
    
    document.getElementById('statSales').textContent = totalSales;
    document.getElementById('statReceivables').textContent = totalReceivables;
    document.getElementById('statCustomers').textContent = customers.length;
    document.getElementById('statProducts').textContent = products.length;
    document.getElementById('statInvoices').textContent = invoices.length;
    document.getElementById('statPayments').textContent = payments.length;
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

// ============================================
// حفظ المعاملة محلياً بعد الإضافة
// ============================================

async function commitTransaction(parsed) {
    try {
        const response = await fetch(`${API_BASE}/transactions/commit`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ parsed })
        });
        const data = await response.json();
        
        if (data.success) {
            // ✅ إضافة الفاتورة إلى التخزين المحلي
            const localInvoices = getInvoicesLocally();
            const newInvoice = {
                ...data.invoice,
                id: Date.now(),
                created_at: new Date().toISOString()
            };
            localInvoices.unshift(newInvoice);
            saveInvoicesLocally(localInvoices);

            // ✅ إضافة العميل إذا كان جديداً
            if (parsed.customer) {
                const localCustomers = getCustomersLocally();
                const existing = localCustomers.find(c => c.name === parsed.customer);
                if (!existing) {
                    localCustomers.unshift({
                        id: Date.now() + 1,
                        name: parsed.customer,
                        phone: parsed.customer_phone || null,
                        balance: 0
                    });
                    saveCustomersLocally(localCustomers);
                }
            }

            // ✅ تحديث المنتجات محلياً
            if (parsed.items) {
                const localProducts = getProductsLocally();
                parsed.items.forEach(item => {
                    const existing = localProducts.find(p => p.name === item.name);
                    if (existing) {
                        existing.stock = (existing.stock || 0) - (item.qty || 0);
                    } else {
                        localProducts.push({
                            id: Date.now() + 2,
                            name: item.name,
                            unit: item.unit || 'قطعة',
                            sale_price: item.price || 0,
                            stock: 0
                        });
                    }
                });
                saveProductsLocally(localProducts);
            }

            showToast('تم حفظ المعاملة بنجاح ✅', 'success');
            document.getElementById('aiResult').innerHTML = `
                <div style="background:#d4edda; padding:15px; border-radius:8px; color:#155724;">
                    ✅ تم حفظ المعاملة بنجاح (محلياً وعلى الخادم)<br>
                    رقم الفاتورة: ${data.invoice?.inv_no || 'N/A'}
                </div>
            `;
            document.getElementById('aiCommitBtn').style.display = 'none';
            
            // تحديث الواجهة
            loadInvoices();
            loadDashboard();
            loadCustomers();
            loadProducts();
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
            renderCustomers(data.customers);
            saveCustomersLocally(data.customers);
        }
    } catch (error) {
        console.error('Load customers error:', error);
        // استخدام البيانات المحلية
        const localCustomers = getCustomersLocally();
        if (localCustomers.length > 0) {
            renderCustomers(localCustomers);
        }
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
            // إضافة للنسخة المحلية
            const localCustomers = getCustomersLocally();
            localCustomers.unshift({
                ...data.customer,
                balance: 0
            });
            saveCustomersLocally(localCustomers);
            
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
            renderSuppliers(data.suppliers);
            saveSuppliersLocally(data.suppliers);
        }
    } catch (error) {
        console.error('Load suppliers error:', error);
        const localSuppliers = getSuppliersLocally();
        if (localSuppliers.length > 0) {
            renderSuppliers(localSuppliers);
        }
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
            const localSuppliers = getSuppliersLocally();
            localSuppliers.unshift(data.supplier);
            saveSuppliersLocally(localSuppliers);
            
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
            renderProducts(data.products);
            saveProductsLocally(data.products);
        }
    } catch (error) {
        console.error('Load products error:', error);
        const localProducts = getProductsLocally();
        if (localProducts.length > 0) {
            renderProducts(localProducts);
        }
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
            const localProducts = getProductsLocally();
            localProducts.unshift(data.product);
            saveProductsLocally(localProducts);
            
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
            // تحديث النسخة المحلية
            const localProducts = getProductsLocally();
            const product = localProducts.find(p => p.id === id);
            if (product) {
                product.stock = (product.stock || 0) + qty;
                saveProductsLocally(localProducts);
            }
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
            renderInvoices(data.invoices);
            saveInvoicesLocally(data.invoices);
        }
    } catch (error) {
        console.error('Load invoices error:', error);
        const localInvoices = getInvoicesLocally();
        if (localInvoices.length > 0) {
            renderInvoices(localInvoices);
        }
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
            // تحديث النسخة المحلية
            const localInvoices = getInvoicesLocally();
            const index = localInvoices.findIndex(inv => inv.id === id);
            if (index !== -1) {
                localInvoices[index].status = 'cancelled';
                saveInvoicesLocally(localInvoices);
            }
            
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
            // تحديث النسخة المحلية
            const localPurchases = getPurchasesLocally();
            localPurchases.unshift({
                ...data.invoice,
                id: Date.now()
            });
            savePurchasesLocally(localPurchases);
            
            // تحديث المنتجات محلياً
            const localProducts = getProductsLocally();
            items.forEach(item => {
                const product = localProducts.find(p => p.name === item.name);
                if (product) {
                    product.stock = (product.stock || 0) + (item.qty || 0);
                } else {
                    localProducts.push({
                        id: Date.now() + 3,
                        name: item.name,
                        unit: item.unit || 'قطعة',
                        sale_price: item.price * 1.2 || 0,
                        stock: item.qty || 0
                    });
                }
            });
            saveProductsLocally(localProducts);
            
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
            renderPurchases(data.invoices);
            savePurchasesLocally(data.invoices);
        }
    } catch (error) {
        console.error('Load purchases error:', error);
        const localPurchases = getPurchasesLocally();
        if (localPurchases.length > 0) {
            renderPurchases(localPurchases);
        }
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
            // حفظ الإعدادات محلياً
            const settings = getFromLocalStorage(STORAGE_KEYS.SETTINGS) || {};
            settings[key] = value;
            saveToLocalStorage(STORAGE_KEYS.SETTINGS, settings);
            
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
    try {
        const settings = getFromLocalStorage(STORAGE_KEYS.SETTINGS) || {};
        
        // تحميل الإعدادات المحلية
        const companyName = document.getElementById('setting_company_name');
        const companyPhone = document.getElementById('setting_company_phone');
        const smtpHost = document.getElementById('setting_smtp_host');
        const smtpPort = document.getElementById('setting_smtp_port');
        const smtpUser = document.getElementById('setting_smtp_user');
        
        if (companyName) companyName.value = settings.company_name || '';
        if (companyPhone) companyPhone.value = settings.company_phone || '';
        if (smtpHost) smtpHost.value = settings.smtp_host || '';
        if (smtpPort) smtpPort.value = settings.smtp_port || '';
        if (smtpUser) smtpUser.value = settings.smtp_user || '';
    } catch (error) {
        console.error('Load settings error:', error);
    }
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
            // تحديث النسخة المحلية
            const localInvoices = getInvoicesLocally();
            const invoice = localInvoices.find(inv => inv.id === invoiceId);
            if (invoice) {
                invoice.paid = (invoice.paid || 0) + amount;
                if (invoice.paid >= invoice.total) {
                    invoice.status = 'paid';
                } else {
                    invoice.status = 'partially_paid';
                }
                saveInvoicesLocally(localInvoices);
            }
            
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
// دوال تصدير واستيراد البيانات
// ============================================

// تصدير البيانات إلى ملف JSON
function exportData() {
    const data = {
        invoices: getInvoicesLocally(),
        customers: getCustomersLocally(),
        products: getProductsLocally(),
        suppliers: getSuppliersLocally(),
        purchases: getPurchasesLocally(),
        exportedAt: new Date().toISOString(),
        version: '4.0.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jusoor_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('تم تصدير البيانات بنجاح 📤', 'success');
}

// استيراد البيانات من ملف JSON
function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.invoices) saveInvoicesLocally(data.invoices);
            if (data.customers) saveCustomersLocally(data.customers);
            if (data.products) saveProductsLocally(data.products);
            if (data.suppliers) saveSuppliersLocally(data.suppliers);
            if (data.purchases) savePurchasesLocally(data.purchases);
            
            showToast('تم استيراد البيانات بنجاح 📥', 'success');
            location.reload();
        } catch (error) {
            console.error('Import error:', error);
            showToast('خطأ في استيراد البيانات', 'error');
        }
    };
    reader.readAsText(file);
}

// ============================================
// التهيئة
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // ✅ التحقق من الجلسة المحلية أولاً
    const { user, token, remember } = getUserSession();
    
    if (user && token && remember) {
        authToken = token;
        currentUser = user;
        showApp();
        
        // محاولة تحميل البيانات من الخادم، مع استخدام النسخة المحلية كاحتياطي
        loadAllData().catch(() => {
            loadFromLocalBackup();
        });
        
        // تحديث التاريخ
        const dateEl = document.getElementById('dashboardDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('ar', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    } else {
        showLogin();
    }
});

console.log('🌉 Jusoor Accounting v4.0 - تم التحميل بنجاح');
