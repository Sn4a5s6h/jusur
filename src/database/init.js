const db = require('./index');

function initializeDatabase() {
    console.log('🔄 جاري تهيئة قاعدة البيانات...');

    // جدول المستخدمين
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول العملاء
    db.prepare(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول الموردين
    db.prepare(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول المنتجات
    db.prepare(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            unit TEXT DEFAULT 'قطعة',
            sale_price REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            stock REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول فواتير المبيعات
    db.prepare(`
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inv_no TEXT UNIQUE NOT NULL,
            customer_id INTEGER,
            type TEXT DEFAULT 'cash',
            status TEXT DEFAULT 'active',
            total REAL DEFAULT 0,
            paid REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            items_json TEXT,
            due_date DATE,
            pdf_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    `).run();

    // جدول فواتير الشراء
    db.prepare(`
        CREATE TABLE IF NOT EXISTS purchase_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inv_no TEXT UNIQUE NOT NULL,
            supplier_id INTEGER,
            type TEXT DEFAULT 'cash',
            status TEXT DEFAULT 'active',
            total REAL DEFAULT 0,
            paid REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            items_json TEXT,
            due_date DATE,
            pdf_path TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `).run();

    // جدول المدفوعات
    db.prepare(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            method TEXT DEFAULT 'cash',
            reference TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )
    `).run();

    // جدول حركات المخزون
    db.prepare(`
        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            movement_type TEXT NOT NULL,
            reference_type TEXT,
            reference_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `).run();

    // جدول سجل التدقيق
    db.prepare(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول الإعدادات
    db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول حسابات WhatsApp
    db.prepare(`
        CREATE TABLE IF NOT EXISTS whatsapp_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            status TEXT DEFAULT 'disconnected',
            provider TEXT DEFAULT 'gateway',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول رسائل WhatsApp
    db.prepare(`
        CREATE TABLE IF NOT EXISTS whatsapp_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER,
            direction TEXT NOT NULL,
            phone TEXT NOT NULL,
            body TEXT NOT NULL,
            parsed_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(id)
        )
    `).run();

    // إنشاء مستخدم افتراضي
    const adminExists = db.prepare(`
        SELECT id FROM users WHERE username = 'admin'
    `).get();

    if (!adminExists) {
        // استخدام bcrypt لتشفير كلمة المرور
        const bcrypt = require('bcryptjs');
        const hashed = bcrypt.hashSync('admin123', 12);
        
        db.prepare(`
            INSERT INTO users (username, password_hash, name, role, status)
            VALUES (?, ?, ?, ?, ?)
        `).run('admin', hashed, 'مدير النظام', 'admin', 'active');
        
        console.log('✅ تم إنشاء مستخدم افتراضي: admin / admin123');
    }

    console.log('✅ تم تهيئة قاعدة البيانات بنجاح');
    return true;
}

module.exports = { initializeDatabase };
