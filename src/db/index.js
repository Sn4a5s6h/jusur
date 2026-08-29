const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

/*
|--------------------------------------------------------------------------
| DATABASE CONFIGURATION
|--------------------------------------------------------------------------
*/

const configuredPath =
    process.env.DB_PATH || "jusoor.db";

const dbPath =
    path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(process.cwd(), configuredPath);

const dbDirectory =
    path.dirname(dbPath);

fs.mkdirSync(dbDirectory, {
    recursive: true
});


/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function columnExists(
    table,
    column
) {
    const columns =
        db.prepare(
            `PRAGMA table_info(${table})`
        ).all();

    return columns.some(
        item => item.name === column
    );
}


function addColumnIfMissing(
    table,
    column,
    definition
) {
    if (
        !columnExists(
            table,
            column
        )
    ) {
        db.exec(`
            ALTER TABLE ${table}
            ADD COLUMN ${column} ${definition}
        `);
    }
}


/*
|--------------------------------------------------------------------------
| CORE DATABASE
|--------------------------------------------------------------------------
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

    tax_number TEXT,

    commercial_register TEXT,

    phone TEXT,

    email TEXT,

    address TEXT,

    city TEXT,

    country TEXT DEFAULT 'Yemen',

    currency TEXT DEFAULT 'YER',

    logo_path TEXT,

    status TEXT NOT NULL DEFAULT 'active',

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP

);


/*
|--------------------------------------------------------------------------
| FISCAL YEARS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS fiscal_years (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    company_id INTEGER NOT NULL,

    name TEXT NOT NULL,

    start_date TEXT NOT NULL,

    end_date TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'open',

    is_current INTEGER NOT NULL DEFAULT 0,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    closed_at TEXT,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    UNIQUE(
        company_id,
        name
    )

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

    email TEXT,

    phone TEXT,

    role TEXT NOT NULL DEFAULT 'user',

    status TEXT NOT NULL DEFAULT 'active',

    last_login TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP

);


/*
|--------------------------------------------------------------------------
| USER COMPANY ACCESS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS user_companies (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    company_id INTEGER NOT NULL,

    role TEXT DEFAULT 'user',

    is_default INTEGER NOT NULL DEFAULT 0,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    UNIQUE(
        user_id,
        company_id
    )

);


/*
|--------------------------------------------------------------------------
| USER PERMISSIONS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS permissions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    code TEXT NOT NULL UNIQUE,

    name TEXT NOT NULL,

    description TEXT

);


/*
|--------------------------------------------------------------------------
| ROLE PERMISSIONS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS role_permissions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    role TEXT NOT NULL,

    permission_id INTEGER NOT NULL,

    FOREIGN KEY(permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    UNIQUE(
        role,
        permission_id
    )

);


/*
|--------------------------------------------------------------------------
| USER SESSIONS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS user_sessions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    token_id TEXT NOT NULL UNIQUE,

    company_id INTEGER,

    fiscal_year_id INTEGER,

    ip_address TEXT,

    user_agent TEXT,

    expires_at TEXT,

    revoked INTEGER NOT NULL DEFAULT 0,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL

);


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

    company_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL

);


/*
|--------------------------------------------------------------------------
| SUPPLIERS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS suppliers (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    phone TEXT,

    email TEXT,

    address TEXT,

    tax_number TEXT,

    account_id INTEGER,

    company_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    UNIQUE(
        company_id,
        name
    )

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

    supplier_id INTEGER,

    company_id INTEGER,

    barcode TEXT,

    min_stock REAL DEFAULT 0,

    max_stock REAL,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(supplier_id)
        REFERENCES suppliers(id)
        ON DELETE SET NULL,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL

);


/*
|--------------------------------------------------------------------------
| CURRENCIES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS currencies (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    code TEXT NOT NULL UNIQUE,

    name TEXT NOT NULL,

    symbol TEXT,

    exchange_rate REAL DEFAULT 1,

    is_base INTEGER NOT NULL DEFAULT 0,

    is_active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP

);


/*
|--------------------------------------------------------------------------
| ACCOUNTS / CHART OF ACCOUNTS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS accounts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    company_id INTEGER,

    code TEXT NOT NULL,

    name TEXT NOT NULL,

    account_type TEXT NOT NULL DEFAULT 'asset',

    parent_id INTEGER,

    level INTEGER DEFAULT 1,

    is_active INTEGER NOT NULL DEFAULT 1,

    currency_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY(parent_id)
        REFERENCES accounts(id)
        ON DELETE SET NULL,

    FOREIGN KEY(currency_id)
        REFERENCES currencies(id)
        ON DELETE SET NULL,

    UNIQUE(
        company_id,
        code
    )

);


/*
|--------------------------------------------------------------------------
| INVOICES - MODIFIED WITH COMPANY FIELDS
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

    items_json TEXT NOT NULL,

    pdf_path TEXT,

    notes TEXT,

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    -- ✅ NEW COMPANY FIELDS
    company_name TEXT,

    company_address TEXT,

    company_phone TEXT,

    company_currency TEXT DEFAULT 'YER',

    FOREIGN KEY(customer_id)
        REFERENCES customers(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

);


/*
|--------------------------------------------------------------------------
| PAYMENTS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS payments (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    customer_id INTEGER,

    supplier_id INTEGER,

    invoice_id INTEGER,

    amount REAL NOT NULL,

    method TEXT DEFAULT 'cash',

    reference TEXT,

    payment_type TEXT DEFAULT 'receipt',

    payment_date TEXT DEFAULT CURRENT_TIMESTAMP,

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    FOREIGN KEY(customer_id)
        REFERENCES customers(id),

    FOREIGN KEY(supplier_id)
        REFERENCES suppliers(id),

    FOREIGN KEY(invoice_id)
        REFERENCES invoices(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

);


/*
|--------------------------------------------------------------------------
| PURCHASE INVOICES
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS purchase_invoices (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    invoice_no TEXT NOT NULL,

    supplier_id INTEGER,

    type TEXT NOT NULL DEFAULT 'cash',

    due_date TEXT,

    subtotal REAL NOT NULL DEFAULT 0,

    discount REAL NOT NULL DEFAULT 0,

    tax REAL NOT NULL DEFAULT 0,

    total REAL NOT NULL DEFAULT 0,

    paid REAL NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'draft',

    items_json TEXT NOT NULL,

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(supplier_id)
        REFERENCES suppliers(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

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

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

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

    account_id INTEGER,

    FOREIGN KEY(journal_id)
        REFERENCES journal_entries(id)
        ON DELETE CASCADE,

    FOREIGN KEY(account_id)
        REFERENCES accounts(id)
        ON DELETE SET NULL

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

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(product_id)
        REFERENCES products(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

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

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(matched_invoice_id)
        REFERENCES invoices(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

);


/*
|--------------------------------------------------------------------------
| AUDIT LOGS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS audit_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    action TEXT NOT NULL,

    entity_type TEXT,

    entity_id INTEGER,

    details TEXT,

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    ip_address TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

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

    company_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL

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

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(account_id)
        REFERENCES whatsapp_accounts(id),

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

);


/*
|--------------------------------------------------------------------------
| SETTINGS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS settings (

    key TEXT PRIMARY KEY,

    value TEXT,

    company_id INTEGER,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE

);


/*
|--------------------------------------------------------------------------
| AI TRANSACTIONS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS ai_transactions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    input_text TEXT NOT NULL,

    parsed_json TEXT,

    transaction_type TEXT,

    status TEXT DEFAULT 'pending',

    error_message TEXT,

    company_id INTEGER,

    fiscal_year_id INTEGER,

    user_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL,

    FOREIGN KEY(fiscal_year_id)
        REFERENCES fiscal_years(id)
        ON DELETE SET NULL,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

);


/*
|--------------------------------------------------------------------------
| NOTIFICATIONS
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS notifications (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER,

    company_id INTEGER,

    type TEXT DEFAULT 'info',

    title TEXT NOT NULL,

    message TEXT,

    reference_type TEXT,

    reference_id INTEGER,

    is_read INTEGER NOT NULL DEFAULT 0,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE

);

`);


/*
|--------------------------------------------------------------------------
| SAFE MIGRATIONS FOR EXISTING DATABASE
|--------------------------------------------------------------------------
*/

const migrations = [

    [
        "customers",
        "company_id",
        "INTEGER"
    ],

    [
        "products",
        "supplier_id",
        "INTEGER"
    ],

    [
        "products",
        "company_id",
        "INTEGER"
    ],

    [
        "products",
        "barcode",
        "TEXT"
    ],

    [
        "products",
        "min_stock",
        "REAL DEFAULT 0"
    ],

    [
        "products",
        "max_stock",
        "REAL"
    ],

    [
        "products",
        "updated_at",
        "TEXT"
    ],

    [
        "invoices",
        "company_id",
        "INTEGER"
    ],

    [
        "invoices",
        "fiscal_year_id",
        "INTEGER"
    ],

    [
        "invoices",
        "user_id",
        "INTEGER"
    ],

    // ✅ NEW: إضافة أعمدة الشركة للفواتير
    [
        "invoices",
        "customer_phone",
        "TEXT"
    ],

    [
        "invoices",
        "notes",
        "TEXT"
    ],

    [
        "invoices",
        "company_name",
        "TEXT"
    ],

    [
        "invoices",
        "company_address",
        "TEXT"
    ],

    [
        "invoices",
        "company_phone",
        "TEXT"
    ],

    [
        "invoices",
        "company_currency",
        "TEXT DEFAULT 'YER'"
    ],

    // ✅ NEW: إضافة عمود العملة للحسابات
    [
        "accounts",
        "currency_id",
        "INTEGER"
    ],

    [
        "payments",
        "supplier_id",
        "INTEGER"
    ],

    [
        "payments",
        "payment_type",
        "TEXT DEFAULT 'receipt'"
    ],

    [
        "payments",
        "company_id",
        "INTEGER"
    ],

    [
        "payments",
        "fiscal_year_id",
        "INTEGER"
    ],

    [
        "payments",
        "user_id",
        "INTEGER"
    ],

    [
        "journal_entries",
        "company_id",
        "INTEGER"
    ],

    [
        "journal_entries",
        "fiscal_year_id",
        "INTEGER"
    ],

    [
        "journal_entries",
        "user_id",
        "INTEGER"
    ],

    [
        "journal_lines",
        "account_id",
        "INTEGER"
    ],

    [
        "stock_movements",
        "company_id",
        "INTEGER"
    ],

    [
        "stock_movements",
        "fiscal_year_id",
        "INTEGER"
    ],

    [
        "stock_movements",
        "user_id",
        "INTEGER"
    ],

    [
        "bank_transactions",
        "company_id",
        "INTEGER"
    ],

    [
        "bank_transactions",
        "fiscal_year_id",
        "INTEGER"
    ],

    [
        "bank_transactions",
        "user_id",
        "INTEGER"
    ],

    [
        "audit_logs",
        "company_id",
        "INTEGER"
    ],

    [
        "audit_logs",
        "fiscal_year_id",
        "INTEGER"
    ],

    [
        "audit_logs",
        "user_id",
        "INTEGER"
    ],

    [
        "audit_logs",
        "ip_address",
        "TEXT"
    ],

    [
        "whatsapp_accounts",
        "company_id",
        "INTEGER"
    ],

    [
        "whatsapp_messages",
        "company_id",
        "INTEGER"
    ],

    [
        "whatsapp_messages",
        "fiscal_year_id",
        "INTEGER"
    ],

    [
        "whatsapp_messages",
        "user_id",
        "INTEGER"
    ]

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

        addColumnIfMissing(
            table,
            column,
            definition
        );

    }
    catch (error) {

        console.warn(
            `DB migration skipped: ${table}.${column}`,
            error.message
        );

    }

}


/*
|--------------------------------------------------------------------------
| INDEXES
|--------------------------------------------------------------------------
*/

db.exec(`

CREATE INDEX IF NOT EXISTS
idx_customers_company
ON customers(company_id);

CREATE INDEX IF NOT EXISTS
idx_products_company
ON products(company_id);

CREATE INDEX IF NOT EXISTS
idx_products_supplier
ON products(supplier_id);

CREATE INDEX IF NOT EXISTS
idx_invoices_company
ON invoices(company_id);

CREATE INDEX IF NOT EXISTS
idx_invoices_fiscal_year
ON invoices(fiscal_year_id);

CREATE INDEX IF NOT EXISTS
idx_invoices_customer
ON invoices(customer_id);

CREATE INDEX IF NOT EXISTS
idx_payments_company
ON payments(company_id);

CREATE INDEX IF NOT EXISTS
idx_payments_invoice
ON payments(invoice_id);

CREATE INDEX IF NOT EXISTS
idx_journal_company
ON journal_entries(company_id);

CREATE INDEX IF NOT EXISTS
idx_journal_fiscal_year
ON journal_entries(fiscal_year_id);

CREATE INDEX IF NOT EXISTS
idx_stock_company
ON stock_movements(company_id);

CREATE INDEX IF NOT EXISTS
idx_audit_company
ON audit_logs(company_id);

CREATE INDEX IF NOT EXISTS
idx_audit_user
ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS
idx_whatsapp_company
ON whatsapp_messages(company_id);

CREATE INDEX IF NOT EXISTS
idx_sessions_user
ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS
idx_sessions_token
ON user_sessions(token_id);

CREATE INDEX IF NOT EXISTS
idx_fiscal_company
ON fiscal_years(company_id);

CREATE INDEX IF NOT EXISTS
idx_user_companies_user
ON user_companies(user_id);

CREATE INDEX IF NOT EXISTS
idx_user_companies_company
ON user_companies(company_id);

`);


/*
|--------------------------------------------------------------------------
| DEFAULT PERMISSIONS
|--------------------------------------------------------------------------
*/

const defaultPermissions = [

    [
        "dashboard.view",
        "عرض لوحة التحكم",
        "الوصول إلى لوحة التحكم"
    ],

    [
        "sales.view",
        "عرض المبيعات",
        "عرض فواتير المبيعات"
    ],

    [
        "sales.create",
        "إنشاء المبيعات",
        "إنشاء فواتير المبيعات"
    ],

    [
        "sales.cancel",
        "إلغاء المبيعات",
        "إلغاء فواتير المبيعات"
    ],

    [
        "purchases.view",
        "عرض المشتريات",
        "عرض فواتير المشتريات"
    ],

    [
        "purchases.create",
        "إنشاء المشتريات",
        "إنشاء فواتير المشتريات"
    ],

    [
        "customers.view",
        "عرض العملاء",
        "عرض العملاء وكشوف الحساب"
    ],

    [
        "customers.create",
        "إضافة العملاء",
        "إضافة العملاء"
    ],

    [
        "suppliers.view",
        "عرض الموردين",
        "عرض الموردين"
    ],

    [
        "suppliers.create",
        "إضافة الموردين",
        "إضافة الموردين"
    ],

    [
        "products.view",
        "عرض الأصناف",
        "عرض الأصناف والمخزون"
    ],

    [
        "products.create",
        "إضافة الأصناف",
        "إضافة أصناف جديدة"
    ],

    [
        "inventory.adjust",
        "تسوية المخزون",
        "تعديل كميات المخزون"
    ],

    [
        "payments.create",
        "تسجيل السداد",
        "تسجيل القبض والصرف"
    ],

    [
        "journal.view",
        "عرض القيود",
        "عرض القيود اليومية"
    ],

    [
        "reports.view",
        "عرض التقارير",
        "الوصول إلى التقارير المالية"
    ],

    [
        "bank.view",
        "عرض البنك",
        "عرض عمليات البنك"
    ],

    [
        "bank.import",
        "استيراد البنك",
        "استيراد كشوف البنك"
    ],

    [
        "whatsapp.view",
        "عرض WhatsApp",
        "إدارة رسائل WhatsApp"
    ],

    [
        "whatsapp.manage",
        "إدارة WhatsApp",
        "إدارة حسابات WhatsApp"
    ],

    [
        "ai.use",
        "استخدام الذكاء الاصطناعي",
        "تحليل المعاملات بالذكاء الاصطناعي"
    ],

    [
        "audit.view",
        "سجل التدقيق",
        "عرض سجل العمليات"
    ],

    [
        "settings.manage",
        "الإعدادات",
        "إدارة إعدادات النظام"
    ],

    [
        "users.manage",
        "إدارة المستخدمين",
        "إضافة وإدارة المستخدمين"
    ],

    [
        "companies.manage",
        "إدارة الشركات",
        "إضافة وتعديل الشركات"
    ],

    [
        "fiscal_year.manage",
        "إدارة السنوات المالية",
        "فتح وإغلاق السنوات المالية"
    ]

];


const insertPermission =
    db.prepare(`

        INSERT OR IGNORE INTO permissions
        (
            code,
            name,
            description
        )
        VALUES (?, ?, ?)

    `);


const insertPermissions =
    db.transaction(() => {

        for (
            const permission
            of defaultPermissions
        ) {

            insertPermission.run(
                permission[0],
                permission[1],
                permission[2]
            );

        }

    });


insertPermissions();


/*
|--------------------------------------------------------------------------
| DEFAULT ROLE PERMISSIONS
|--------------------------------------------------------------------------
*/

const roles = [

    "admin",
    "manager",
    "accountant",
    "sales",
    "user"

];


const adminPermissions =
    db.prepare(`
        SELECT id
        FROM permissions
    `).all();


const insertRolePermission =
    db.prepare(`

        INSERT OR IGNORE INTO role_permissions
        (
            role,
            permission_id
        )
        VALUES (?, ?)

    `);


const insertRolePermissions =
    db.transaction(() => {

        for (
            const role
            of roles
        ) {

            for (
                const permission
                of adminPermissions
            ) {

                if (
                    role === "admin"
                ) {

                    insertRolePermission.run(
                        role,
                        permission.id
                    );

                    continue;

                }

                if (
                    role === "manager"
                ) {

                    const code =
                        db.prepare(`
                            SELECT code
                            FROM permissions
                            WHERE id = ?
                        `).get(
                            permission.id
                        );

                    if (
                        code &&
                        ![
                            "users.manage",
                            "companies.manage"
                        ].includes(
                            code.code
                        )
                    ) {

                        insertRolePermission.run(
                            role,
                            permission.id
                        );

                    }

                    continue;

                }

                if (
                    role === "accountant"
                ) {

                    const code =
                        db.prepare(`
                            SELECT code
                            FROM permissions
                            WHERE id = ?
                        `).get(
                            permission.id
                        );

                    if (
                        code &&
                        [
                            "dashboard.view",
                            "sales.view",
                            "sales.create",
                            "purchases.view",
                            "purchases.create",
                            "customers.view",
                            "customers.create",
                            "suppliers.view",
                            "suppliers.create",
                            "products.view",
                            "products.create",
                            "inventory.adjust",
                            "payments.create",
                            "journal.view",
                            "reports.view",
                            "bank.view",
                            "bank.import",
                            "ai.use"
                        ].includes(
                            code.code
                        )
                    ) {

                        insertRolePermission.run(
                            role,
                            permission.id
                        );

                    }

                    continue;

                }

                if (
                    role === "sales"
                ) {

                    const code =
                        db.prepare(`
                            SELECT code
                            FROM permissions
                            WHERE id = ?
                        `).get(
                            permission.id
                        );

                    if (
                        code &&
                        [
                            "dashboard.view",
                            "sales.view",
                            "sales.create",
                            "customers.view",
                            "customers.create",
                            "products.view",
                            "payments.create",
                            "ai.use"
                        ].includes(
                            code.code
                        )
                    ) {

                        insertRolePermission.run(
                            role,
                            permission.id
                        );

                    }

                    continue;

                }

                if (
                    role === "user"
                ) {

                    const code =
                        db.prepare(`
                            SELECT code
                            FROM permissions
                            WHERE id = ?
                        `).get(
                            permission.id
                        );

                    if (
                        code &&
                        [
                            "dashboard.view",
                            "sales.view",
                            "customers.view",
                            "products.view"
                        ].includes(
                            code.code
                        )
                    ) {

                        insertRolePermission.run(
                            role,
                            permission.id
                        );

                    }

                }

            }

        }

    });


insertRolePermissions();


/*
|--------------------------------------------------------------------------
| DEFAULT COMPANY
|--------------------------------------------------------------------------
*/

let company =
    db.prepare(`
        SELECT *
        FROM companies
        ORDER BY id
        LIMIT 1
    `).get();


if (!company) {

    const result =
        db.prepare(`

            INSERT INTO companies
            (
                name,
                legal_name,
                currency,
                country,
                status
            )
            VALUES (?, ?, ?, ?, ?)

        `).run(

            "محلات الغانم للتجارة العامة",

            "محلات الغانم للتجارة العامة",

            "YER",

            "Yemen",

            "active"

        );


    company =
        db.prepare(`
            SELECT *
            FROM companies
            WHERE id = ?
        `).get(
            Number(
                result.lastInsertRowid
            )
        );

}


/*
|--------------------------------------------------------------------------
| DEFAULT FISCAL YEAR
|--------------------------------------------------------------------------
*/

let fiscalYear =
    db.prepare(`
        SELECT *
        FROM fiscal_years
        WHERE company_id = ?
        ORDER BY is_current DESC, id DESC
        LIMIT 1
    `).get(
        company.id
    );


if (!fiscalYear) {

    const year =
        new Date()
            .getFullYear();

    const result =
        db.prepare(`

            INSERT INTO fiscal_years
            (
                company_id,
                name,
                start_date,
                end_date,
                status,
                is_current
            )
            VALUES (?, ?, ?, ?, ?, ?)

        `).run(

            company.id,

            String(year),

            `${year}-01-01`,

            `${year}-12-31`,

            "open",

            1

        );


    fiscalYear =
        db.prepare(`
            SELECT *
            FROM fiscal_years
            WHERE id = ?
        `).get(
            Number(
                result.lastInsertRowid
            )
        );

}


/*
|--------------------------------------------------------------------------
| DEFAULT CURRENCIES
|--------------------------------------------------------------------------
*/

try {
    const currencyCount = db.prepare(`
        SELECT COUNT(*) AS count FROM currencies
    `).get().count;
    
    if (currencyCount === 0) {
        const defaultCurrencies = [
            { code: 'YER', name: 'ريال يمني', symbol: '﷼', exchange_rate: 1, is_base: 1 },
            { code: 'USD', name: 'دولار أمريكي', symbol: '$', exchange_rate: 0.004, is_base: 0 },
            { code: 'SAR', name: 'ريال سعودي', symbol: '﷼', exchange_rate: 0.015, is_base: 0 },
            { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', exchange_rate: 0.015, is_base: 0 },
        ];
        
        const insertCurrency = db.prepare(`
            INSERT INTO currencies (code, name, symbol, exchange_rate, is_base, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const currency of defaultCurrencies) {
            insertCurrency.run(
                currency.code,
                currency.name,
                currency.symbol,
                currency.exchange_rate,
                currency.is_base,
                1
            );
        }
        console.log('✅ تم إنشاء العملات الافتراضية');
    }
} catch (error) {
    console.error('CURRENCY INIT ERROR:', error.message);
}


/*
|--------------------------------------------------------------------------
| DEFAULT CHART OF ACCOUNTS
|--------------------------------------------------------------------------
*/

const accountCount =
    db.prepare(`
        SELECT COUNT(*) AS count
        FROM accounts
        WHERE company_id = ?
    `).get(
        company.id
    ).count;


if (
    Number(accountCount) === 0
) {

    // جلب العملة الأساسية
    const baseCurrency = db.prepare(`
        SELECT id FROM currencies WHERE is_base = 1 LIMIT 1
    `).get();

    const defaultAccounts = [

        [
            "1000",
            "الأصول",
            "asset",
            null,
            1,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "1100",
            "الصندوق",
            "asset",
            "1000",
            2,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "1200",
            "البنك",
            "asset",
            "1000",
            2,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "1300",
            "العملاء",
            "asset",
            "1000",
            2,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "1400",
            "المخزون",
            "asset",
            "1000",
            2,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "2000",
            "الخصوم",
            "liability",
            null,
            1,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "2100",
            "الموردون",
            "liability",
            "2000",
            2,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "3000",
            "حقوق الملكية",
            "equity",
            null,
            1,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "4000",
            "المبيعات",
            "revenue",
            null,
            1,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "5000",
            "تكلفة المبيعات",
            "expense",
            null,
            1,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "5100",
            "المصروفات",
            "expense",
            null,
            1,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "5200",
            "المصروفات الإدارية",
            "expense",
            null,
            1,
            baseCurrency ? baseCurrency.id : null
        ],

        [
            "5300",
            "المصروفات التشغيلية",
            "expense",
            null,
            1,
            baseCurrency ? baseCurrency.id : null
        ]

    ];


    const insertAccount =
        db.prepare(`

            INSERT OR IGNORE INTO accounts
            (
                company_id,
                code,
                name,
                account_type,
                parent_id,
                level,
                currency_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)

        `);

    // خريطة لتخزين معرفات الحسابات حسب الكود
    const accountMap = {};

    const insertAccounts =
        db.transaction(() => {

            for (
                const account
                of defaultAccounts
            ) {

                const parentCode = account[3];
                let parentId = null;
                if (parentCode) {
                    parentId = accountMap[parentCode] || null;
                }

                const result = insertAccount.run(
                    company.id,
                    account[0],
                    account[1],
                    account[2],
                    parentId,
                    account[4],
                    account[5]
                );

                accountMap[account[0]] = result.lastInsertRowid;

            }

        });


    insertAccounts();

}


/*
|--------------------------------------------------------------------------
| SAVE COMPANY INFO TO SETTINGS
|--------------------------------------------------------------------------
*/

try {
    const companyInfo = {
        name: 'محلات الغانم للتجارة العامة',
        name_en: 'ALGANIM STORS FOR TRADING',
        address: 'صنعاء - شعوب - الصياح',
        phone: '777463289',
        description: 'لبيع جميع انواع البقوليات والبهارات والمكسرات جملة - تجزئة',
        currency: 'YER'
    };

    const existing = db.prepare(`
        SELECT value FROM settings WHERE key = 'company_info'
    `).get();

    if (!existing) {
        db.prepare(`
            INSERT INTO settings (key, value)
            VALUES (?, ?)
        `).run('company_info', JSON.stringify(companyInfo));
        console.log("✅ تم حفظ معلومات الشركة في الإعدادات");
    }
} catch (error) {
    console.error("COMPANY INFO ERROR:", error.message);
}


/*
|--------------------------------------------------------------------------
| UPDATED_AT NORMALIZATION
|--------------------------------------------------------------------------
*/

try {

    db.prepare(`
        UPDATE products
        SET updated_at =
            COALESCE(
                updated_at,
                created_at,
                CURRENT_TIMESTAMP
            )
        WHERE updated_at IS NULL
    `).run();

}
catch {
    // Safe migration
}


/*
|--------------------------------------------------------------------------
| DATABASE INFORMATION
|--------------------------------------------------------------------------
*/

function getDatabaseInfo() {

    return {

        path:
            dbPath,

        company:
            company || null,

        fiscal_year:
            fiscalYear || null,

        tables:
            db.prepare(`
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                ORDER BY name
            `).all()

    };

}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

db.getDatabaseInfo =
    getDatabaseInfo;

db.getCurrentCompany =
    () => {

        return db.prepare(`
            SELECT *
            FROM companies
            WHERE id = ?
        `).get(
            company.id
        );

    };


db.getCurrentFiscalYear =
    () => {

        return db.prepare(`
            SELECT *
            FROM fiscal_years
            WHERE company_id = ?
            AND is_current = 1
            ORDER BY id DESC
            LIMIT 1
        `).get(
            company.id
        );

    };


module.exports = db;
