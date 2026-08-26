const Database = require("better-sqlite3");

const db = new Database(
    process.env.DB_PATH || "jusoor.db"
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    phone TEXT,
    account_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    unit TEXT DEFAULT 'قطعة',
    sale_price REAL DEFAULT 0,
    cost_price REAL DEFAULT 0,
    stock REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    inv_no TEXT NOT NULL UNIQUE,

    customer_id INTEGER,
    customer_name TEXT NOT NULL,

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

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(customer_id)
        REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS payments (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    customer_id INTEGER,
    invoice_id INTEGER,

    amount REAL NOT NULL,

    method TEXT DEFAULT 'cash',

    reference TEXT,

    payment_date TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(customer_id)
        REFERENCES customers(id),

    FOREIGN KEY(invoice_id)
        REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS journal_entries (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    reference_type TEXT,

    reference_id INTEGER,

    description TEXT,

    entry_date TEXT DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS stock_movements (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    product_id INTEGER,

    quantity REAL NOT NULL,

    movement_type TEXT NOT NULL,

    reference_type TEXT,

    reference_id INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(product_id)
        REFERENCES products(id)
);

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

CREATE TABLE IF NOT EXISTS audit_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    action TEXT NOT NULL,

    entity_type TEXT,

    entity_id INTEGER,

    details TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_accounts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT,

    phone TEXT,

    status TEXT DEFAULT 'disconnected',

    provider TEXT DEFAULT 'gateway',

    session_data TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS settings (

    key TEXT PRIMARY KEY,

    value TEXT
);

`);

module.exports = db;
