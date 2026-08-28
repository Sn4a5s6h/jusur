"use strict";

const Database = require("better-sqlite3");
const path = require("path");

/*
|--------------------------------------------------------------------------
| JUSOOR ACCOUNTING - DATABASE
|--------------------------------------------------------------------------
| Compatible with:
| - src/server.js
| - src/accounting.js
| - src/auth/auth.js
| - Existing SQLite databases
|
| IMPORTANT:
| This file does NOT delete existing data.
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| DATABASE PATH
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

try {
    db.pragma("journal_mode = WAL");
} catch (error) {
    console.warn(
        "DB WAL WARNING:",
        error.message
    );
}

db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function quoteIdentifier(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}


function tableExists(tableName) {

    const row = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        LIMIT 1
    `).get(tableName);

    return Boolean(row);
}


function columnExists(
    tableName,
    columnName
) {

    if (!tableExists(tableName)) {
        return false;
    }

    const table =
        quoteIdentifier(tableName);

    const columns =
        db.prepare(
            `PRAGMA table_info(${table})`
        ).all();

    return columns.some(
        column =>
            column.name === columnName
    );
}


function addColumn(
    tableName,
    columnName,
    definition
) {

    if (!tableExists(tableName)) {
        return false;
    }

    if (
        columnExists(
            tableName,
            columnName
        )
    ) {
        return false;
    }

    const table =
        quoteIdentifier(tableName);

    const column =
        quoteIdentifier(columnName);

    db.exec(`
        ALTER TABLE ${table}
        ADD COLUMN ${column} ${definition}
    `);

    return true;
}


function safeAddColumn(
    table,
    column,
    definition
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
| BASE TABLES
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| COMPANIES
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| FINANCIAL YEARS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| USERS
|--------------------------------------------------------------------------
|
| server.js requires:
|
| id
| username
| password_hash
| name
| role
| status
| created_at
|
| Older versions used:
| full_name
| active
|
| Both are preserved.
|--------------------------------------------------------------------------
*/

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

    last_login_at TEXT,

    FOREIGN KEY(company_id)
        REFERENCES companies(id)

);
`);


/*
|--------------------------------------------------------------------------
| SESSIONS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| CUSTOMERS
|--------------------------------------------------------------------------
*/

db.exec(`
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

    notes TEXT,

    active INTEGER DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);
`);


/*
|--------------------------------------------------------------------------
| SUPPLIERS
|--------------------------------------------------------------------------
*/

db.exec(`
CREATE TABLE IF NOT EXISTS suppliers (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL UNIQUE,

    phone TEXT,

    email TEXT,

    address TEXT,

    tax_number TEXT,

    notes TEXT,

    account_id INTEGER,

    opening_balance REAL DEFAULT 0,

    balance_type TEXT DEFAULT 'credit',

    active INTEGER DEFAULT 1,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);
`);


/*
|--------------------------------------------------------------------------
| PRODUCTS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| ACCOUNTS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| INVOICES
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| PAYMENTS
|--------------------------------------------------------------------------
*/

db.exec(`
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

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(customer_id)
        REFERENCES customers(id),

    FOREIGN KEY(invoice_id)
        REFERENCES invoices(id)

);
`);


/*
|--------------------------------------------------------------------------
| JOURNAL ENTRIES
|--------------------------------------------------------------------------
*/

db.exec(`
CREATE TABLE IF NOT EXISTS journal_entries (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    reference_type TEXT,

    reference_id INTEGER,

    description TEXT,

    entry_date TEXT DEFAULT CURRENT_TIMESTAMP,

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
`);


/*
|--------------------------------------------------------------------------
| JOURNAL LINES
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| STOCK MOVEMENTS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| PURCHASES
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| PURCHASE ITEMS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| EXPENSES
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| RECEIPTS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| SUPPLIER PAYMENTS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| CASH TRANSACTIONS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| INVENTORY OPENING
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| BANK TRANSACTIONS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| AI TRANSACTIONS
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| SEQUENCES
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| AUDIT LOGS
|--------------------------------------------------------------------------
*/

db.exec(`
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
| WHATSAPP ACCOUNTS
|--------------------------------------------------------------------------
*/

db.exec(`
CREATE TABLE IF NOT EXISTS whatsapp_accounts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT,

    phone TEXT,

    status TEXT DEFAULT 'disconnected',

    provider TEXT DEFAULT 'gateway',

    session_data TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP

);
`);


/*
|--------------------------------------------------------------------------
| WHATSAPP MESSAGES
|--------------------------------------------------------------------------
*/

db.exec(`
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
`);


/*
|--------------------------------------------------------------------------
| SETTINGS
|--------------------------------------------------------------------------
*/

db.exec(`
CREATE TABLE IF NOT EXISTS settings (

    key TEXT PRIMARY KEY,

    value TEXT

);
`);


/*
|--------------------------------------------------------------------------
| COMPATIBILITY MIGRATIONS
|--------------------------------------------------------------------------
|
| These migrations are the important part.
|
| They repair databases created by previous versions.
| No DROP TABLE.
| No DELETE.
| No data reset.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| USERS - CRITICAL FIX
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "users",
    "name",
    "TEXT"
);

safeAddColumn(
    "users",
    "full_name",
    "TEXT"
);

safeAddColumn(
    "users",
    "status",
    "TEXT DEFAULT 'active'"
);

safeAddColumn(
    "users",
    "active",
    "INTEGER DEFAULT 1"
);

safeAddColumn(
    "users",
    "role",
    "TEXT DEFAULT 'user'"
);

safeAddColumn(
    "users",
    "company_id",
    "INTEGER"
);

safeAddColumn(
    "users",
    "created_at",
    "TEXT"
);

safeAddColumn(
    "users",
    "last_login_at",
    "TEXT"
);


/*
|--------------------------------------------------------------------------
| USERS - DATA NORMALIZATION
|--------------------------------------------------------------------------
|
| If old database has full_name but no name,
| copy full_name -> name.
|
| If old database has active but no status,
| convert:
|
| active = 1 => active
| active = 0 => inactive
|--------------------------------------------------------------------------
*/

try {

    if (
        columnExists("users", "name") &&
        columnExists("users", "full_name")
    ) {

        db.prepare(`
            UPDATE users
            SET name = full_name
            WHERE
                (
                    name IS NULL
                    OR TRIM(name) = ''
                )
                AND full_name IS NOT NULL
        `).run();

    }

}
catch (error) {

    console.error(
        "USER NAME MIGRATION ERROR:",
        error.message
    );

}


try {

    if (
        columnExists("users", "status") &&
        columnExists("users", "active")
    ) {

        db.prepare(`
            UPDATE users
            SET status =
                CASE
                    WHEN active = 0
                        THEN 'inactive'
                    ELSE 'active'
                END
            WHERE
                status IS NULL
                OR TRIM(status) = ''
        `).run();

    }

}
catch (error) {

    console.error(
        "USER STATUS MIGRATION ERROR:",
        error.message
    );

}


/*
|--------------------------------------------------------------------------
| CUSTOMER MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "customers",
    "opening_balance",
    "REAL DEFAULT 0"
);

safeAddColumn(
    "customers",
    "balance_type",
    "TEXT DEFAULT 'debit'"
);

safeAddColumn(
    "customers",
    "address",
    "TEXT"
);

safeAddColumn(
    "customers",
    "email",
    "TEXT"
);

safeAddColumn(
    "customers",
    "tax_number",
    "TEXT"
);

safeAddColumn(
    "customers",
    "notes",
    "TEXT"
);

safeAddColumn(
    "customers",
    "active",
    "INTEGER DEFAULT 1"
);


/*
|--------------------------------------------------------------------------
| SUPPLIER MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "suppliers",
    "phone",
    "TEXT"
);

safeAddColumn(
    "suppliers",
    "email",
    "TEXT"
);

safeAddColumn(
    "suppliers",
    "address",
    "TEXT"
);

safeAddColumn(
    "suppliers",
    "tax_number",
    "TEXT"
);

safeAddColumn(
    "suppliers",
    "notes",
    "TEXT"
);

safeAddColumn(
    "suppliers",
    "account_id",
    "INTEGER"
);

safeAddColumn(
    "suppliers",
    "opening_balance",
    "REAL DEFAULT 0"
);

safeAddColumn(
    "suppliers",
    "balance_type",
    "TEXT DEFAULT 'credit'"
);

safeAddColumn(
    "suppliers",
    "active",
    "INTEGER DEFAULT 1"
);


/*
|--------------------------------------------------------------------------
| PRODUCT MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "products",
    "minimum_stock",
    "REAL DEFAULT 0"
);

safeAddColumn(
    "products",
    "barcode",
    "TEXT"
);

safeAddColumn(
    "products",
    "sku",
    "TEXT"
);

safeAddColumn(
    "products",
    "category",
    "TEXT"
);

safeAddColumn(
    "products",
    "supplier_id",
    "INTEGER"
);

safeAddColumn(
    "products",
    "active",
    "INTEGER DEFAULT 1"
);


/*
|--------------------------------------------------------------------------
| INVOICE MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "invoices",
    "customer_phone",
    "TEXT"
);

safeAddColumn(
    "invoices",
    "notes",
    "TEXT"
);

safeAddColumn(
    "invoices",
    "pdf_path",
    "TEXT"
);

safeAddColumn(
    "invoices",
    "user_id",
    "INTEGER"
);

safeAddColumn(
    "invoices",
    "company_id",
    "INTEGER"
);

safeAddColumn(
    "invoices",
    "financial_year_id",
    "INTEGER"
);

safeAddColumn(
    "invoices",
    "status",
    "TEXT DEFAULT 'draft'"
);

safeAddColumn(
    "invoices",
    "items_json",
    "TEXT DEFAULT '[]'"
);


/*
|--------------------------------------------------------------------------
| PAYMENT MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "payments",
    "reference",
    "TEXT"
);

safeAddColumn(
    "payments",
    "description",
    "TEXT"
);

safeAddColumn(
    "payments",
    "payment_date",
    "TEXT DEFAULT CURRENT_TIMESTAMP"
);

safeAddColumn(
    "payments",
    "user_id",
    "INTEGER"
);

safeAddColumn(
    "payments",
    "company_id",
    "INTEGER"
);

safeAddColumn(
    "payments",
    "financial_year_id",
    "INTEGER"
);

safeAddColumn(
    "payments",
    "created_at",
    "TEXT DEFAULT CURRENT_TIMESTAMP"
);


/*
|--------------------------------------------------------------------------
| JOURNAL MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "journal_entries",
    "reference_type",
    "TEXT"
);

safeAddColumn(
    "journal_entries",
    "reference_id",
    "INTEGER"
);

safeAddColumn(
    "journal_entries",
    "description",
    "TEXT"
);

safeAddColumn(
    "journal_entries",
    "entry_date",
    "TEXT DEFAULT CURRENT_TIMESTAMP"
);

safeAddColumn(
    "journal_entries",
    "user_id",
    "INTEGER"
);

safeAddColumn(
    "journal_entries",
    "company_id",
    "INTEGER"
);

safeAddColumn(
    "journal_entries",
    "financial_year_id",
    "INTEGER"
);

safeAddColumn(
    "journal_entries",
    "created_at",
    "TEXT DEFAULT CURRENT_TIMESTAMP"
);


/*
|--------------------------------------------------------------------------
| STOCK MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "stock_movements",
    "unit_cost",
    "REAL DEFAULT 0"
);


/*
|--------------------------------------------------------------------------
| AUDIT MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "audit_logs",
    "user_id",
    "INTEGER"
);

safeAddColumn(
    "audit_logs",
    "company_id",
    "INTEGER"
);

safeAddColumn(
    "audit_logs",
    "financial_year_id",
    "INTEGER"
);

safeAddColumn(
    "audit_logs",
    "ip_address",
    "TEXT"
);


/*
|--------------------------------------------------------------------------
| PURCHASE MIGRATIONS
|--------------------------------------------------------------------------
*/

safeAddColumn(
    "purchases",
    "supplier_name",
    "TEXT"
);

safeAddColumn(
    "purchases",
   
