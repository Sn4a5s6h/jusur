CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'YER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fiscal_period_dates
        CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    company_id UUID NOT NULL
        REFERENCES companies(id),

    code TEXT NOT NULL,

    name TEXT NOT NULL,

    account_type TEXT NOT NULL,

    parent_id UUID REFERENCES accounts(id),

    normal_balance TEXT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    company_id UUID NOT NULL
        REFERENCES companies(id),

    fiscal_period_id UUID
        REFERENCES fiscal_periods(id),

    entry_no BIGSERIAL,

    entry_date DATE NOT NULL,

    description TEXT,

    reference_type TEXT,

    reference_id UUID,

    status TEXT NOT NULL DEFAULT 'posted',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    journal_id UUID NOT NULL
        REFERENCES journal_entries(id)
        ON DELETE CASCADE,

    account_id UUID NOT NULL
        REFERENCES accounts(id),

    description TEXT,

    debit NUMERIC(20,4) NOT NULL DEFAULT 0,

    credit NUMERIC(20,4) NOT NULL DEFAULT 0,

    CHECK (debit >= 0),

    CHECK (credit >= 0),

    CHECK (
        NOT (debit > 0 AND credit > 0)
    )
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    company_id UUID NOT NULL
        REFERENCES companies(id),

    name TEXT NOT NULL,

    phone TEXT,

    account_id UUID
        REFERENCES accounts(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    company_id UUID NOT NULL
        REFERENCES companies(id),

    name TEXT NOT NULL,

    phone TEXT,

    account_id UUID
        REFERENCES accounts(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    company_id UUID NOT NULL
        REFERENCES companies(id),

    name TEXT NOT NULL,

    sku TEXT,

    unit TEXT NOT NULL DEFAULT 'قطعة',

    sale_price NUMERIC(20,4) NOT NULL DEFAULT 0,

    cost_price NUMERIC(20,4) NOT NULL DEFAULT 0,

    stock_quantity NUMERIC(20,4) NOT NULL DEFAULT 0,

    inventory_account_id UUID
        REFERENCES accounts(id),

    sales_account_id UUID
        REFERENCES accounts(id),

    cogs_account_id UUID
        REFERENCES accounts(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS invoices (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    company_id UUID NOT NULL
        REFERENCES companies(id),

    invoice_no BIGSERIAL,

    customer_id UUID
        REFERENCES customers(id),

    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,

    due_date DATE,

    payment_type TEXT NOT NULL DEFAULT 'cash',

    subtotal NUMERIC(20,4) NOT NULL DEFAULT 0,

    discount NUMERIC(20,4) NOT NULL DEFAULT 0,

    tax NUMERIC(20,4) NOT NULL DEFAULT 0,

    total NUMERIC(20,4) NOT NULL DEFAULT 0,

    paid NUMERIC(20,4) NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'posted',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    invoice_id UUID NOT NULL
        REFERENCES invoices(id)
        ON DELETE CASCADE,

    product_id UUID
        REFERENCES products(id),

    description TEXT NOT NULL,

    quantity NUMERIC(20,4) NOT NULL,

    unit_price NUMERIC(20,4) NOT NULL,

    cost_price NUMERIC(20,4) NOT NULL DEFAULT 0,

    total NUMERIC(20,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    company_id UUID NOT NULL
        REFERENCES companies(id),

    customer_id UUID
        REFERENCES customers(id),

    invoice_id UUID
        REFERENCES invoices(id),

    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

    amount NUMERIC(20,4) NOT NULL,

    method TEXT NOT NULL DEFAULT 'cash',

    reference TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    company_id UUID NOT NULL
        REFERENCES companies(id),

    product_id UUID NOT NULL
        REFERENCES products(id),

    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,

    quantity NUMERIC(20,4) NOT NULL,

    unit_cost NUMERIC(20,4) NOT NULL DEFAULT 0,

    movement_type TEXT NOT NULL,

    reference_type TEXT,

    reference_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
