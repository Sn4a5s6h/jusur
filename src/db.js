"use strict";

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

// ============================================
// DATABASE PATH
// ============================================
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "jusoor.db");

// التأكد من وجود المجلد
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// ============================================
// SQLITE SETTINGS
// ============================================
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// ============================================
// HELPER FUNCTIONS
// ============================================
function columnExists(tableName, columnName) {
    try {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        return columns.some(col => col.name === columnName);
    } catch {
        return false;
    }
}

function safeAddColumn(table, column, definition) {
    try {
        if (!columnExists(table, column)) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            console.log(`✅ تم إضافة عمود ${column} إلى جدول ${table}`);
        }
    } catch (error) {
        console.log(`⚠️ لا يمكن إضافة عمود ${column} إلى ${table}:`, error.message);
    }
}

// ============================================
// CREATE TABLES
// ============================================
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        full_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        active INTEGER NOT NULL DEFAULT 1,
        company_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        legal_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        tax_number TEXT,
        currency TEXT DEFAULT 'YER',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        address TEXT,
        email TEXT,
        tax_number TEXT,
        notes TEXT,
        opening_balance REAL DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        email TEXT,
        address TEXT,
        tax_number TEXT,
        notes TEXT,
        opening_balance REAL DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        unit TEXT DEFAULT 'قطعة',
        sale_price REAL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        stock REAL DEFAULT 0,
        minimum_stock REAL DEFAULT 0,
        barcode TEXT,
        category TEXT,
        supplier_id INTEGER,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inv_no TEXT NOT NULL UNIQUE,
        customer_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        type TEXT NOT NULL DEFAULT 'cash',
        due_date TEXT,
        subtotal REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        paid REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        items_json TEXT NOT NULL DEFAULT '[]',
        pdf_path TEXT,
        notes TEXT,
        user_id INTEGER,
        company_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        invoice_id INTEGER,
        amount REAL NOT NULL,
        method TEXT DEFAULT 'cash',
        reference TEXT,
        description TEXT,
        payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        company_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        details TEXT,
        user_id INTEGER,
        company_id INTEGER,
        ip_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        quantity REAL NOT NULL,
        movement_type TEXT NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,
        unit_cost REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT NOT NULL UNIQUE,
        supplier_id INTEGER,
        supplier_name TEXT,
        type TEXT NOT NULL DEFAULT 'cash',
        due_date TEXT,
        subtotal REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        paid REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        items_json TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        user_id INTEGER,
        company_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_type TEXT,
        reference_id INTEGER,
        description TEXT,
        entry_date TEXT DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        company_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS journal_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journal_id INTEGER NOT NULL,
        account_code TEXT NOT NULL,
        account_name TEXT NOT NULL,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0
    );
`);

// ============================================
// ADD MISSING COLUMNS
// ============================================
safeAddColumn("users", "status", "TEXT DEFAULT 'active'");
safeAddColumn("users", "name", "TEXT");
safeAddColumn("users", "full_name", "TEXT");
safeAddColumn("users", "active", "INTEGER DEFAULT 1");
safeAddColumn("users", "company_id", "INTEGER");

// ============================================
// CREATE DEFAULT COMPANY
// ============================================
try {
    const company = db.prepare(`SELECT id FROM companies LIMIT 1`).get();
    if (!company) {
        const result = db.prepare(`
            INSERT INTO companies (name, legal_name, currency, active)
            VALUES (?, ?, ?, ?)
        `).run("الشركة الافتراضية", "الشركة الافتراضية", "YER", 1);
        console.log("✅ تم إنشاء الشركة الافتراضية");
    }
} catch (error) {
    console.error("COMPANY ERROR:", error.message);
}

// ============================================
// CREATE DEFAULT ADMIN USER
// ============================================
try {
    const admin = db.prepare(`SELECT id FROM users WHERE username = 'admin'`).get();
    if (!admin) {
        const hashedPassword = bcrypt.hashSync("admin123", 12);
        const company = db.prepare(`SELECT id FROM companies LIMIT 1`).get();

        db.prepare(`
            INSERT INTO users (
                username,
                password_hash,
                name,
                full_name,
                role,
                status,
                active,
                company_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            "admin",
            hashedPassword,
            "مدير النظام",
            "مدير النظام",
            "admin",
            "active",
            1,
            company ? company.id : null
        );

        console.log("✅ تم إنشاء مستخدم افتراضي: admin / admin123");
    }
} catch (error) {
    console.error("ADMIN ERROR:", error.message);
}

// ============================================
// EXPORT
// ============================================
module.exports = db;
