"use strict";

const Database = require("better-sqlite3");
const path = require("path");

/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

const DB_PATH =
    process.env.DB_PATH ||
    path.join(process.cwd(), "jusoor.db");

const db = new Database(DB_PATH);

/*
|--------------------------------------------------------------------------
| SQLITE SETTINGS
|--------------------------------------------------------------------------
*/

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function tableExists(tableName) {
    const row = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        AND name = ?
    `).get(tableName);

    return Boolean(row);
}


function columnExists(tableName, columnName) {

    if (!tableExists(tableName)) {
        return false;
    }

    const columns =
        db.prepare(
            `PRAGMA table_info(${tableName})`
        ).all();

    return columns.some(
        column => column.name === columnName
    );
}


function addColumn(
    tableName,
    columnName,
    definition
) {

    if (
        tableExists(tableName) &&
        !columnExists(
            tableName,
            columnName
        )
    ) {

        db.exec(`
            ALTER TABLE ${tableName}
            ADD COLUMN ${columnName} ${definition}
        `);

    }

}


/*
|--------------------------------------------------------------------------
| CORE TABLES
|--------------------------------------------------------------------------
|
| هذه الجداول الجديدة لا تؤثر على البيانات القديمة.
|
*/


db.exec(`
/*
|--------------------------------------------------------------------------
| COMPANIES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS companies (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    legal_name TEXT,

    phone TEXT,

    email TEXT,

    address TEXT,

    tax_number TEXT,

    commercial_register TEXT,

    currency TEXT DEFAULT 'YER',

    logo_path TEXT,

    active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP

);


/*
|--------------------------------------------------------------------------
| FINANCIAL YEARS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS financial_years (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    company_id INTEGER NOT NULL,

    name TEXT NOT NULL,

    start_date TEXT NOT NULL,

    end_date TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'open',

    is_current INTEGER NOT NULL DEFAULT 0,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    closed_at TEXT,

    UNIQUE(company_id, name),

    FOREIGN KEY(company_id)
        REFERENCES companies(id)

);


/*
|--------------------------------------------------------------------------
| USERS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS users (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    full_name TEXT,

    role TEXT NOT NULL DEFAULT 'user',

    active INTEGER NOT NULL DEFAULT 1,

    company_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    last_login_at TEXT,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)

);


/*
|--------------------------------------------------------------------------
| SESSIONS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS sessions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    company_id INTEGER,

    financial_year_id INTEGER,

    expires_at TEXT NOT NULL,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| SUPPLIERS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS suppliers (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL UNIQUE,

    phone TEXT,

    email TEXT,

    address TEXT,

    tax_number TEXT,

    account_id INTEGER,

    opening_balance REAL DEFAULT 0,

    balance_type TEXT DEFAULT 'credit',

    active INTEGER DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);


/*
|--------------------------------------------------------------------------
| ACCOUNTS / CHART OF ACCOUNTS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS accounts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    code TEXT NOT NULL UNIQUE,

    name TEXT NOT NULL,

    account_type TEXT NOT NULL,

    parent_code TEXT,

    level INTEGER DEFAULT 1,

    is_system INTEGER DEFAULT 0,

    active INTEGER DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);


/*
|--------------------------------------------------------------------------
| PURCHASES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS purchases (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    purchase_no TEXT NOT NULL UNIQUE,

    supplier_id INTEGER,

    supplier_name TEXT,

    type TEXT NOT NULL DEFAULT 'cash',

    purchase_date TEXT DEFAULT CURRENT_TIMESTAMP,

    due_date TEXT,

    subtotal REAL NOT NULL DEFAULT 0,

    discount REAL NOT NULL DEFAULT 0,

    tax REAL NOT NULL DEFAULT 0,

    total REAL NOT NULL DEFAULT 0,

    paid REAL NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'posted',

    items_json TEXT NOT NULL DEFAULT '[]',

    notes TEXT,

    user_id INTEGER,

    company_id INTEGER,

    financial_year_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(supplier_id)
        REFERENCES suppliers(id),

    FOREIGN KEY(user_id)
        REFERENCES users(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| PURCHASE ITEMS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS purchase_items (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    purchase_id INTEGER NOT NULL,

    product_id INTEGER,

    product_name TEXT NOT NULL,

    quantity REAL NOT NULL DEFAULT 0,

    unit TEXT DEFAULT 'قطعة',

    unit_cost REAL NOT NULL DEFAULT 0,

    total REAL NOT NULL DEFAULT 0,

    FOREIGN KEY(purchase_id)
        REFERENCES purchases(id)
        ON DELETE CASCADE,

    FOREIGN KEY(product_id)
        REFERENCES products(id)

);


/*
|--------------------------------------------------------------------------
| EXPENSES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS expenses (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    expense_no TEXT NOT NULL UNIQUE,

    category TEXT NOT NULL,

    description TEXT,

    amount REAL NOT NULL DEFAULT 0,

    payment_method TEXT DEFAULT 'cash',

    expense_date TEXT DEFAULT CURRENT_TIMESTAMP,

    account_code TEXT,

    user_id INTEGER,

    company_id INTEGER,

    financial_year_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
        REFERENCES users(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| RECEIPTS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS receipts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    receipt_no TEXT NOT NULL UNIQUE,

    customer_id INTEGER,

    customer_name TEXT,

    amount REAL NOT NULL DEFAULT 0,

    method TEXT DEFAULT 'cash',

    reference TEXT,

    description TEXT,

    receipt_date TEXT DEFAULT CURRENT_TIMESTAMP,

    user_id INTEGER,

    company_id INTEGER,

    financial_year_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(customer_id)
        REFERENCES customers(id),

    FOREIGN KEY(user_id)
        REFERENCES users(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| PAYABLE PAYMENTS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS supplier_payments (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    supplier_id INTEGER,

    purchase_id INTEGER,

    amount REAL NOT NULL,

    method TEXT DEFAULT 'cash',

    reference TEXT,

    payment_date TEXT DEFAULT CURRENT_TIMESTAMP,

    description TEXT,

    user_id INTEGER,

    company_id INTEGER,

    financial_year_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(supplier_id)
        REFERENCES suppliers(id),

    FOREIGN KEY(purchase_id)
        REFERENCES purchases(id),

    FOREIGN KEY(user_id)
        REFERENCES users(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| CASH TRANSACTIONS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS cash_transactions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    transaction_type TEXT NOT NULL,

    amount REAL NOT NULL,

    description TEXT,

    reference_type TEXT,

    reference_id INTEGER,

    transaction_date TEXT DEFAULT CURRENT_TIMESTAMP,

    user_id INTEGER,

    company_id INTEGER,

    financial_year_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
        REFERENCES users(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| INVENTORY OPENING BALANCES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS inventory_opening (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    product_id INTEGER NOT NULL,

    quantity REAL NOT NULL DEFAULT 0,

    unit_cost REAL NOT NULL DEFAULT 0,

    financial_year_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(product_id)
        REFERENCES products(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| AI TRANSACTIONS
|--------------------------------------------------------------------------
|
| حفظ كل العمليات التي أدخلها المستخدم للمساعد الذكي.
| لا يتم حذف النص الأصلي.
|
*/

CREATE TABLE IF NOT EXISTS ai_transactions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    original_text TEXT NOT NULL,

    intent TEXT,

    parsed_json TEXT,

    status TEXT DEFAULT 'pending',

    validation_errors TEXT,

    source TEXT DEFAULT 'web',

    user_id INTEGER,

    company_id INTEGER,

    financial_year_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    committed_at TEXT,

    FOREIGN KEY(user_id)
        REFERENCES users(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| DOCUMENT SEQUENCES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS sequences (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    company_id INTEGER,

    financial_year_id INTEGER,

    document_type TEXT NOT NULL,

    prefix TEXT,

    current_number INTEGER NOT NULL DEFAULT 0,

    UNIQUE(
        company_id,
        financial_year_id,
        document_type
    ),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| AUDIT LOG
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS audit_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    action TEXT NOT NULL,

    entity_type TEXT,

    entity_id INTEGER,

    details TEXT,

    user_id INTEGER,

    company_id INTEGER,

    financial_year_id INTEGER,

    ip_address TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
        REFERENCES users(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);
`);


/*
|--------------------------------------------------------------------------
| EXISTING TABLES
|--------------------------------------------------------------------------
|
| نحافظ على الجداول الموجودة في المشروع الحالي.
|
*/


db.exec(`
/*
|--------------------------------------------------------------------------
| CUSTOMERS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS customers (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL UNIQUE,

    phone TEXT,

    account_id INTEGER,

    opening_balance REAL DEFAULT 0,

    balance_type TEXT DEFAULT 'debit',

    address TEXT,

    email TEXT,

    tax_number TEXT,

    active INTEGER DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);


/*
|--------------------------------------------------------------------------
| PRODUCTS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS products (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL UNIQUE,

    unit TEXT DEFAULT 'قطعة',

    sale_price REAL DEFAULT 0,

    cost_price REAL DEFAULT 0,

    stock REAL DEFAULT 0,

    minimum_stock REAL DEFAULT 0,

    barcode TEXT,

    sku TEXT,

    category TEXT,

    supplier_id INTEGER,

    active INTEGER DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(supplier_id)
        REFERENCES suppliers(id)

);


/*
|--------------------------------------------------------------------------
| INVOICES
|--------------------------------------------------------------------------
*/

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

    financial_year_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(customer_id)
        REFERENCES customers(id)

);


/*
|--------------------------------------------------------------------------
| PAYMENTS
|--------------------------------------------------------------------------
*/

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

    financial_year_id INTEGER,

    FOREIGN KEY(customer_id)
        REFERENCES customers(id),

    FOREIGN KEY(invoice_id)
        REFERENCES invoices(id)

);


/*
|--------------------------------------------------------------------------
| JOURNAL ENTRIES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS journal_entries (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    reference_type TEXT,

    reference_id INTEGER,

    description TEXT,

    entry_date TEXT DEFAULT CURRENT_TIMESTAMP,

    user_id INTEGER,

    company_id INTEGER,

    financial_year_id INTEGER,

    FOREIGN KEY(user_id)
        REFERENCES users(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id),

    FOREIGN KEY(financial_year_id)
        REFERENCES financial_years(id)

);


/*
|--------------------------------------------------------------------------
| JOURNAL LINES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS journal_lines (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    journal_id INTEGER NOT NULL,

    account_code TEXT NOT NULL,

    account_name TEXT NOT NULL,

    debit REAL DEFAULT 0,

    credit REAL DEFAULT 0,

    FOREIGN KEY(journal_id)
        REFERENCES journal_entries(id)

);


/*
|--------------------------------------------------------------------------
| STOCK MOVEMENTS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS stock_movements (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    product_id INTEGER,

    quantity REAL NOT NULL,

    movement_type TEXT NOT NULL,

    reference_type TEXT,

    reference_id INTEGER,

    unit_cost REAL DEFAULT 0,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(product_id)
        REFERENCES products(id)

);


/*
|--------------------------------------------------------------------------
| BANK TRANSACTIONS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS bank_transactions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    amount REAL NOT NULL,

    description TEXT,

    transaction_date TEXT,

    reference TEXT,

    matched_invoice_id INTEGER,

    status TEXT DEFAULT 'unmatched',

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(matched_invoice_id)
        REFERENCES invoices(id)

);


/*
|--------------------------------------------------------------------------
| WHATSAPP ACCOUNTS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS whatsapp_accounts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT,

    phone TEXT,

    status TEXT DEFAULT 'disconnected',

    provider TEXT DEFAULT 'gateway',

    session_data TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);


/*
|--------------------------------------------------------------------------
| WHATSAPP MESSAGES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS whatsapp_messages (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    account_id INTEGER,

    direction TEXT,

    phone TEXT,

    body TEXT,

    parsed_json TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(account_id)
        REFERENCES whatsapp_accounts(id)

);


/*
|--------------------------------------------------------------------------
| SETTINGS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS settings (

    key TEXT PRIMARY KEY,

    value TEXT

);

`);


/*
|--------------------------------------------------------------------------
| SAFE MIGRATION
|--------------------------------------------------------------------------
|
| هذه الإضافات مهمة جداً لأنها تسمح بتشغيل النسخة الجديدة
| فوق قاعدة البيانات القديمة بدون حذف البيانات.
|
*/


const migrations = [

    ["customers", "opening_balance", "REAL DEFAULT 0"],
    ["customers", "balance_type", "TEXT DEFAULT 'debit'"],
    ["customers", "address", "TEXT"],
    ["customers", "email", "TEXT"],
    ["customers", "tax_number", "TEXT"],
    ["customers", "active", "INTEGER DEFAULT 1"],

    ["products", "minimum_stock", "REAL DEFAULT 0"],
    ["products", "barcode", "TEXT"],
    ["products", "sku", "TEXT"],
    ["products", "category", "TEXT"],
    ["products", "supplier_id", "INTEGER"],
    ["products", "active", "INTEGER DEFAULT 1"],

    ["invoices", "customer_phone", "TEXT"],
    ["invoices", "notes", "TEXT"],
    ["invoices", "user_id", "INTEGER"],
    ["invoices", "company_id", "INTEGER"],
    ["invoices", "financial_year_id", "INTEGER"],

    ["payments", "description", "TEXT"],
    ["payments", "user_id", "INTEGER"],
    ["payments", "company_id", "INTEGER"],
    ["payments", "financial_year_id", "INTEGER"],

    ["journal_entries", "user_id", "INTEGER"],
    ["journal_entries", "company_id", "INTEGER"],
    ["journal_entries", "financial_year_id", "INTEGER"],

    ["stock_movements", "unit_cost", "REAL DEFAULT 0"],

    ["audit_logs", "user_id", "INTEGER"],
    ["audit_logs", "company_id", "INTEGER"],
    ["audit_logs", "financial_year_id", "INTEGER"],
    ["audit_logs", "ip_address", "TEXT"]

];


for (
    const [
        table,
        column,
        definition
    ]
    of migrations
) {

    try {

        addColumn(
            table,
            column,
            definition
        );

    }
    catch (error) {

        console.error(
            `DB MIGRATION ERROR: ${table}.${column}`,
            error.message
        );

    }

}


/*
|--------------------------------------------------------------------------
| INDEXES
|--------------------------------------------------------------------------
|
| تسريع البحث والتقارير بدون التأثير على البيانات.
|
*/


db.exec(`
CREATE INDEX IF NOT EXISTS
idx_customers_name
ON customers(name);

CREATE INDEX IF NOT EXISTS
idx_products_name
ON products(name);

CREATE INDEX IF NOT EXISTS
idx_products_barcode
ON products(barcode);

CREATE INDEX IF NOT EXISTS
idx_invoices_customer
ON invoices(customer_id);

CREATE INDEX IF NOT EXISTS
idx_invoices_date
ON invoices(created_at);

CREATE INDEX IF NOT EXISTS
idx_invoices_status
ON invoices(status);

CREATE INDEX IF NOT EXISTS
idx_payments_customer
ON payments(customer_id);

CREATE INDEX IF NOT EXISTS
idx_payments_invoice
ON payments(invoice_id);

CREATE INDEX IF NOT EXISTS
idx_journal_entries_date
ON journal_entries(entry_date);

CREATE INDEX IF NOT EXISTS
idx_journal_lines_account
ON journal_lines(account_code);

CREATE INDEX IF NOT EXISTS
idx_stock_product
ON stock_movements(product_id);

CREATE INDEX IF NOT EXISTS
idx_audit_logs_date
ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS
idx_ai_transactions_date
ON ai_transactions(created_at);

CREATE INDEX IF NOT EXISTS
idx_sessions_token
ON sessions(token_hash);

CREATE INDEX IF NOT EXISTS
idx_sessions_user
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS
idx_purchases_supplier
ON purchases(supplier_id);

CREATE INDEX IF NOT EXISTS
idx_expenses_date
ON expenses(expense_date);

CREATE INDEX IF NOT EXISTS
idx_receipts_customer
ON receipts(customer_id);

`);


/*
|--------------------------------------------------------------------------
| DEFAULT ACCOUNTING CHART
|--------------------------------------------------------------------------
|
| الحسابات الأساسية للنظام.
|
*/


const defaultAccounts = [

    ["1000", "الأصول", "asset", null, 1],
    ["1100", "الصندوق", "asset", "1000", 2],
    ["1110", "البنك", "asset", "1000", 2],
    ["1200", "العملاء", "asset", "1000", 2],
    ["1300", "المخزون", "asset", "1000", 2],

    ["2000", "الخصوم", "liability", null, 1],
    ["2100", "الموردون", "liability", "2000", 2],

    ["3000", "حقوق الملكية", "equity", null, 1],
    ["3100", "رأس المال", "equity", "3000", 2],
    ["3200", "الأرباح المحتجزة", "equity", "3000", 2],

    ["4000", "الإيرادات", "revenue", null, 1],
    ["4100", "المبيعات", "revenue", "4000", 2],
    ["4200", "إيرادات أخرى", "revenue", "4000", 2],

    ["5000", "المصروفات", "expense", null, 1],
    ["5100", "تكلفة المبيعات", "expense", "5000", 2],
    ["5200", "المصروفات التشغيلية", "expense", "5000", 2],
    ["5300", "الرواتب والأجور", "expense", "5000", 2],
    ["5400", "الإيجارات", "expense", "5000", 2],
    ["5500", "الكهرباء والمياه", "expense", "5000", 2]

];


const insertAccount =
    db.prepare(`
        INSERT OR IGNORE INTO accounts
        (
            code,
            name,
            account_type,
            parent_code,
            level,
            is_system
        )
        VALUES (?, ?, ?, ?, ?, 1)
    `);


const insertAccounts =
    db.transaction(() => {

        for (
            const account
            of defaultAccounts
        ) {

            insertAccount.run(
                ...account
            );

        }

    });


insertAccounts();


/*
|--------------------------------------------------------------------------
| DEFAULT COMPANY
|--------------------------------------------------------------------------
|
| لا ننشئ مستخدمًا افتراضيًا هنا.
| سيتم إنشاء المستخدم الأول من نظام الإعداد/login.
|
*/


const companyCount =
    db.prepare(`
        SELECT COUNT(*) AS count
        FROM companies
    `).get().count;


if (
    Number(companyCount) === 0
) {

    const result =
        db.prepare(`
            INSERT INTO companies
            (
                name,
                legal_name,
                currency,
                active
            )
            VALUES (?, ?, ?, 1)
        `).run(
            "شركة جسور",
            "شركة جسور للخدمات والاستشارات والتنمية",
            "YER"
        );


    const companyId =
        Number(
            result.lastInsertRowid
        );


    const currentYear =
        new Date()
            .getFullYear();


    const startDate =
        `${currentYear}-01-01`;

    const endDate =
        `${currentYear}-12-31`;


    db.prepare(`
        INSERT INTO financial_years
        (
            company_id,
            name,
            start_date,
            end_date,
            status,
            is_current
        )
        VALUES (?, ?, ?, ?, 'open', 1)
    `).run(

        companyId,

        String(
            currentYear
        ),

        startDate,

        endDate

    );

}


/*
|--------------------------------------------------------------------------
| ENSURE CURRENT FINANCIAL YEAR
|--------------------------------------------------------------------------
*/

const company =
    db.prepare(`
        SELECT *
        FROM companies
        WHERE active = 1
        ORDER BY id
        LIMIT 1
    `).get();


if (company) {

    const year =
        db.prepare(`
            SELECT *
            FROM financial_years
            WHERE company_id = ?
            AND is_current = 1
            ORDER BY id DESC
            LIMIT 1
        `).get(
            company.id
        );


    if (!year) {

        const currentYear =
            new Date()
                .getFullYear();


        db.prepare(`
            INSERT OR IGNORE INTO financial_years
            (
                company_id,
                name,
                start_date,
                end_date,
                status,
                is_current
            )
            VALUES (?, ?, ?, ?, 'open', 1)
        `).run(

            company.id,

            String(
                currentYear
            ),

            `${currentYear}-01-01`,

            `${currentYear}-12-31`

        );

    }

}


/*
|--------------------------------------------------------------------------
| DEFAULT SETTINGS
|--------------------------------------------------------------------------
*/

const defaultSettings = [

    [
        "system_name",
        "Jusoor Accounting"
    ],

    [
        "system_name_ar",
        "نظام جسور المحاسبي"
    ],

    [
        "currency",
        "YER"
    ],

    [
        "currency_name",
        "ريال يمني"
    ],

    [
        "invoice_prefix",
        "INV"
    ],

    [
        "purchase_prefix",
        "PUR"
    ],

    [
        "receipt_prefix",
        "REC"
    ],

    [
        "expense_prefix",
        "EXP"
    ],

    [
        "supplier_payment_prefix",
        "PAY"
    ],

    [
        "date_format",
        "YYYY-MM-DD"
    ],

    [
        "ai_enabled",
        "true"
    ]

];


const insertSetting =
    db.prepare(`
        INSERT OR IGNORE INTO settings
        (
            key,
            value
        )
        VALUES (?, ?)
    `);


for (
    const [
        key,
        value
    ]
    of defaultSettings
) {

    insertSetting.run(
        key,
        value
    );

}


/*
|--------------------------------------------------------------------------
| DATABASE INFO
|--------------------------------------------------------------------------
*/

function getDatabaseInfo() {

    const tables =
        db.prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name
        `).all();


    return {

        path:
            DB_PATH,

        tables:
            tables.map(
                row => row.name
            )

    };

}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = db;

module.exports.getDatabaseInfo =
    getDatabaseInfo;
