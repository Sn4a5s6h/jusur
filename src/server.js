require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const db = require("./db");

const {
    parseTransaction
} = require("./ai/engine");

const {
    createInvoice,
    recordPayment,
    customerStatement
} = require("./accounting");

const {
    generateInvoicePDF
} = require("./pdf");


/*
|--------------------------------------------------------------------------
| APP
|--------------------------------------------------------------------------
*/

const app = express();

const PORT = Number(process.env.PORT) || 3001;

const ROOT = path.join(__dirname, "..");

const PUBLIC_DIR = path.join(ROOT, "public");

const UPLOADS = path.join(ROOT, "uploads");

const INVOICES = path.join(ROOT, "invoices");


/*
|--------------------------------------------------------------------------
| DIRECTORIES
|--------------------------------------------------------------------------
*/

fs.mkdirSync(UPLOADS, {
    recursive: true
});

fs.mkdirSync(INVOICES, {
    recursive: true
});


/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/

app.use(cors());

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

app.use(
    express.static(PUBLIC_DIR)
);

app.use(
    "/invoices",
    express.static(INVOICES)
);


const upload = multer({
    dest: UPLOADS,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/


function cleanString(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const result =
        String(value).trim();

    return result || null;
}


function toNumber(value, fallback = 0) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    if (typeof value === "number") {

        return Number.isFinite(value)
            ? value
            : fallback;

    }

    const arabicMap = {
        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9"
    };

    let text =
        String(value)
            .replace(/[٠-٩]/g, c => arabicMap[c])
            .replace(/٬/g, "")
            .replace(/,/g, "")
            .replace(/٫/g, ".")
            .trim();

    const number =
        Number(text);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function normalizeItems(items) {

    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map(item => {

            if (!item) {
                return null;
            }

            return {

                name:
                    cleanString(item.name),

                qty:
                    toNumber(item.qty),

                price:
                    toNumber(item.price),

                unit:
                    cleanString(item.unit) ||
                    "قطعة"

            };

        })
        .filter(Boolean);

}


function normalizeTransaction(parsed) {

    if (!parsed || typeof parsed !== "object") {

        throw new Error(
            "بيانات المعاملة غير صحيحة"
        );

    }

    const normalized = {

        intent:
            cleanString(parsed.intent) ||
            "unknown",

        customer:
            cleanString(parsed.customer),

        customer_phone:
            cleanString(parsed.customer_phone),

        type:
            parsed.type === "credit"
                ? "credit"
                : "cash",

        due_days:
            parsed.due_days === null ||
            parsed.due_days === undefined
                ? null
                : toNumber(
                    parsed.due_days,
                    null
                ),

        due_date:
            cleanString(parsed.due_date),

        items:
            normalizeItems(parsed.items),

        discount:
            toNumber(parsed.discount),

        tax:
            toNumber(parsed.tax),

        total:
            toNumber(parsed.total),

        ready:
            Boolean(parsed.ready),

        needs_confirmation:
            parsed.needs_confirmation !== false,

        original_text:
            cleanString(parsed.original_text)

    };

    /*
    إعادة حساب الإجمالي من الأصناف
    وعدم الثقة في total المرسل من الواجهة.
    */

    const subtotal =
        normalized.items.reduce(
            (sum, item) =>
                sum +
                (
                    item.qty *
                    item.price
                ),
            0
        );

    normalized.total =
        subtotal -
        normalized.discount +
        normalized.tax;

    /*
    إذا كانت الفاتورة نقدية فلا نحتاج
    تاريخ استحقاق.
    */

    if (
        normalized.type === "cash"
    ) {

        normalized.due_days = null;
        normalized.due_date = null;

    }

    return normalized;
}


function validateTransaction(transaction) {

    const errors = [];

    if (
        transaction.intent !==
        "sales_invoice"
    ) {

        errors.push(
            "نوع العملية غير مدعوم"
        );

    }

    if (!transaction.customer) {

        errors.push(
            "اسم العميل مطلوب"
        );

    }

    if (
        !transaction.items ||
        transaction.items.length === 0
    ) {

        errors.push(
            "يجب إضافة صنف واحد على الأقل"
        );

    }

    for (
        const item
        of transaction.items
    ) {

        if (!item.name) {

            errors.push(
                "اسم الصنف مطلوب"
            );

        }

        if (
            !Number.isFinite(item.qty) ||
            item.qty <= 0
        ) {

            errors.push(
                `الكمية غير صحيحة للصنف: ${item.name || "غير معروف"}`
            );

        }

        if (
            !Number.isFinite(item.price) ||
            item.price < 0
        ) {

            errors.push(
                `السعر غير صحيح للصنف: ${item.name || "غير معروف"}`
            );

        }

    }

    if (
        !Number.isFinite(transaction.discount) ||
        transaction.discount < 0
    ) {

        errors.push(
            "الخصم غير صحيح"
        );

    }

    if (
        !Number.isFinite(transaction.tax) ||
        transaction.tax < 0
    ) {

        errors.push(
            "الضريبة غير صحيحة"
        );

    }

    if (
        !Number.isFinite(transaction.total) ||
        transaction.total < 0
    ) {

        errors.push(
            "إجمالي الفاتورة غير صحيح"
        );

    }

    if (
        transaction.type === "credit" &&
        transaction.due_days !== null &&
        (
            !Number.isFinite(
                transaction.due_days
            ) ||
            transaction.due_days < 0
        )
    ) {

        errors.push(
            "مدة الاستحقاق غير صحيحة"
        );

    }

    return errors;
}


function calculateDueDate(
    transaction
) {

    if (
        transaction.type !==
        "credit"
    ) {

        return null;
    }

    if (
        transaction.due_date
    ) {

        return transaction.due_date;
    }

    if (
        transaction.due_days === null
    ) {

        return null;
    }

    const date =
        new Date();

    date.setDate(
        date.getDate() +
        Number(
            transaction.due_days
        )
    );

    return date
        .toISOString()
        .slice(0, 10);
}


function safeJson(value) {

    try {

        return JSON.stringify(
            value
        );

    } catch {

        return "{}";

    }

}


/*
|--------------------------------------------------------------------------
| HEALTH
|--------------------------------------------------------------------------
*/

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            name:
                "Jusoor Accounting",

            version:
                "3.0.0",

            status:
                "running",

            accounting_engine:
                "active",

            ai_engine:
                "active",

            database:
                "SQLite"

        });

    }
);


/*
|--------------------------------------------------------------------------
| SYSTEM INFO
|--------------------------------------------------------------------------
*/

app.get(
    "/api/system",
    (req, res) => {

        res.json({

            success: true,

            system:
                "Jusoor Accounting",

            version:
                "3.0.0",

            node:
                process.version,

            environment:
                process.env.NODE_ENV ||
                "production",

            features: {

                ai:
                    true,

                invoices:
                    true,

                customers:
                    true,

                products:
                    true,

                inventory:
                    true,

                payments:
                    true,

                journal:
                    true,

                customer_statement:
                    true,

                pdf:
                    true,

                whatsapp:
                    true,

                bank_import:
                    true

            }

        });

    }
);


/*
|--------------------------------------------------------------------------
| AI PARSE
|--------------------------------------------------------------------------
*/

app.post(
    "/api/ai/parse",
    async (req, res) => {

        try {

            const text =
                cleanString(
                    req.body.text
                );

            if (!text) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "النص مطلوب"

                    });

            }

            /*
            محرك AI يمكن أن يكون sync
            أو async.
            */

            const parsed =
                await Promise.resolve(
                    parseTransaction(text)
                );

            const normalized =
                normalizeTransaction(
                    parsed
                );

            const validationErrors =
                validateTransaction(
                    normalized
                );

            normalized.validation_errors =
                validationErrors;

            normalized.ready =
                validationErrors.length === 0;

            normalized.needs_confirmation =
                true;

            res.json({

                success: true,

                parsed:
                    normalized

            });

        }

        catch (error) {

            console.error(
                "AI PARSE ERROR:",
                error
            );

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| TRANSACTION PREVIEW
|--------------------------------------------------------------------------
|
| يستخدم للتحقق قبل إنشاء الفاتورة.
|
*/

app.post(
    "/api/transactions/preview",
    (req, res) => {

        try {

            const transaction =
                normalizeTransaction(
                    req.body.parsed
                );

            const errors =
                validateTransaction(
                    transaction
                );

            res.json({

                success:
                    errors.length === 0,

                ready:
                    errors.length === 0,

                errors,

                transaction

            });

        }

        catch (error) {

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| COMMIT TRANSACTION
|--------------------------------------------------------------------------
*/

app.post(
    "/api/transactions/commit",
    async (req, res) => {

        try {

            if (!req.body.parsed) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "بيانات العملية مطلوبة"

                    });

            }

            const parsed =
                normalizeTransaction(
                    req.body.parsed
                );

            const errors =
                validateTransaction(
                    parsed
                );

            if (errors.length) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "المعاملة غير مكتملة",

                        errors

                    });

            }

            /*
            لا نقبل تنفيذ المعاملة
            إذا لم تكن جاهزة.
            */

            if (!parsed.ready) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "المعاملة غير مكتملة"

                    });

            }

            const dueDate =
                calculateDueDate(
                    parsed
                );

            /*
            إنشاء الفاتورة
            */

            const invoice =
                createInvoice({

                    customer:
                        parsed.customer,

                    customer_phone:
                        parsed.customer_phone,

                    items:
                        parsed.items,

                    type:
                        parsed.type,

                    due_date:
                        dueDate,

                    discount:
                        parsed.discount,

                    tax:
                        parsed.tax

                });

            /*
            إنشاء PDF
            */

            const items =
                JSON.parse(
                    invoice.items_json
                );

            const pdfPath =
                await generateInvoicePDF(

                    invoice,

                    items,

                    INVOICES

                );

            /*
            تحديث مسار PDF
            */

            db.prepare(`
                UPDATE invoices
                SET pdf_path = ?
                WHERE id = ?
            `).run(

                String(pdfPath),

                Number(invoice.id)

            );

            /*
            سجل التدقيق
            */

            db.prepare(`
                INSERT INTO audit_logs
                (
                    action,
                    entity_type,
                    entity_id,
                    details
                )
                VALUES (?, ?, ?, ?)
            `).run(

                "commit",

                "invoice",

                Number(invoice.id),

                safeJson({

                    source:
                        "ai",

                    original_text:
                        parsed.original_text,

                    invoice:
                        invoice.inv_no

                })

            );

            const publicPath =
                `/invoices/${invoice.inv_no}.pdf`;

            res.json({

                success: true,

                message:
                    "تم إنشاء الفاتورة والقيد وتحديث المخزون بنجاح",

                invoice: {

                    ...invoice,

                    pdf_url:
                        publicPath,

                    due_date:
                        dueDate

                }

            });

        }

        catch (error) {

            console.error(
                "COMMIT ERROR:",
                error
            );

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| GET INVOICE BY ID
|--------------------------------------------------------------------------
*/

app.get(
    "/api/invoices/:id",
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            if (!Number.isInteger(id)) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "رقم الفاتورة غير صحيح"

                    });

            }

            const invoice =
                db.prepare(`
                    SELECT *
                    FROM invoices
                    WHERE id = ?
                `).get(id);

            if (!invoice) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        error:
                            "الفاتورة غير موجودة"

                    });

            }

            let items = [];

            try {

                items =
                    JSON.parse(
                        invoice.items_json
                    );

            } catch {

                items = [];

            }

            res.json({

                success: true,

                invoice: {

                    ...invoice,

                    items

                }

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| CANCEL INVOICE
|--------------------------------------------------------------------------
*/

app.post(
    "/api/invoices/:id/cancel",
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            if (!Number.isInteger(id)) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "رقم الفاتورة غير صحيح"

                    });

            }

            const invoice =
                db.prepare(`
                    SELECT *
                    FROM invoices
                    WHERE id = ?
                `).get(id);

            if (!invoice) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        error:
                            "الفاتورة غير موجودة"

                    });

            }

            if (
                invoice.status ===
                "cancelled"
            ) {

                return res.json({

                    success: true,

                    message:
                        "الفاتورة ملغاة مسبقاً"

                });

            }

            const transaction =
                db.transaction(() => {

                    /*
                    استرجاع المخزون
                    */

                    let items = [];

                    try {

                        items =
                            JSON.parse(
                                invoice.items_json
                            );

                    } catch {

                        items = [];

                    }

                    for (
                        const item
                        of items
                    ) {

                        const product =
                            db.prepare(`
                                SELECT *
                                FROM products
                                WHERE name = ?
                            `).get(
                                item.name
                            );

                        if (product) {

                            db.prepare(`
                                UPDATE products
                                SET stock = stock + ?
                                WHERE id = ?
                            `).run(

                                toNumber(
                                    item.qty
                                ),

                                Number(
                                    product.id
                                )

                            );

                            db.prepare(`
                                INSERT INTO stock_movements
                                (
                                    product_id,
                                    quantity,
                                    movement_type,
                                    reference_type,
                                    reference_id
                                )
                                VALUES (?, ?, ?, ?, ?)
                            `).run(

                                Number(
                                    product.id
                                ),

                                toNumber(
                                    item.qty
                                ),

                                "return",

                                "invoice_cancel",

                                id

                            );

                        }

                    }

                    db.prepare(`
                        UPDATE invoices
                        SET status = 'cancelled'
                        WHERE id = ?
                    `).run(id);

                    db.prepare(`
                        INSERT INTO audit_logs
                        (
                            action,
                            entity_type,
                            entity_id,
                            details
                        )
                        VALUES (?, ?, ?, ?)
                    `).run(

                        "cancel",

                        "invoice",

                        id,

                        safeJson({
                            inv_no:
                                invoice.inv_no
                        })

                    );

                });

            transaction();

            res.json({

                success: true,

                message:
                    "تم إلغاء الفاتورة واسترجاع المخزون"

            });

        }

        catch (error) {

            console.error(
                "CANCEL INVOICE ERROR:",
                error
            );

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| PAYMENTS
|--------------------------------------------------------------------------
*/

app.post(
    "/api/payments",
    (req, res) => {

        try {

            const invoiceId =
                Number(
                    req.body.invoiceId
                );

            const amount =
                toNumber(
                    req.body.amount
                );

            const method =
                cleanString(
                    req.body.method
                ) ||
                "cash";

            const reference =
                cleanString(
                    req.body.reference
                );

            if (
                !Number.isInteger(
                    invoiceId
                )
            ) {

                throw new Error(
                    "رقم الفاتورة غير صحيح"
                );

            }

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                throw new Error(
                    "مبلغ السداد غير صحيح"
                );

            }

            const invoice =
                recordPayment({

                    invoiceId,

                    amount,

                    method,

                    reference

                });

            res.json({

                success: true,

                message:
                    "تم تسجيل السداد بنجاح",

                invoice

            });

        }

        catch (error) {

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| CUSTOMER STATEMENT
|--------------------------------------------------------------------------
*/

app.get(
    "/api/customer/:name",
    (req, res) => {

        try {

            const name =
                cleanString(
                    req.params.name
                );

            if (!name) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "اسم العميل مطلوب"

                    });

            }

            const result =
                customerStatement(
                    name
                );

            res.json({

                success: true,

                ...result

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| CUSTOMERS
|--------------------------------------------------------------------------
*/

app.get(
    "/api/customers",
    (req, res) => {

        try {

            const customers =
                db.prepare(`
                    SELECT
                        c.*,
                        COALESCE(
                            (
                                SELECT
                                    SUM(
                                        i.total -
                                        i.paid
                                    )
                                FROM invoices i
                                WHERE
                                    i.customer_id =
                                    c.id
                                AND
                                    i.status !=
                                    'cancelled'
                            ),
                            0
                        ) AS balance
                    FROM customers c
                    ORDER BY c.name
                `).all();

            res.json({

                success: true,

                customers

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| CUSTOMER SUMMARY
|--------------------------------------------------------------------------
*/

app.get(
    "/api/customers/:id/summary",
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const customer =
                db.prepare(`
                    SELECT *
                    FROM customers
                    WHERE id = ?
                `).get(id);

            if (!customer) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        error:
                            "العميل غير موجود"

                    });

            }

            const invoices =
                db.prepare(`
                    SELECT
                        COUNT(*) AS count,
                        COALESCE(
                            SUM(total),
                            0
                        ) AS sales,
                        COALESCE(
                            SUM(paid),
                            0
                        ) AS paid,
                        COALESCE(
                            SUM(total - paid),
                            0
                        ) AS balance
                    FROM invoices
                    WHERE
                        customer_id = ?
                    AND
                        status != 'cancelled'
                `).get(id);

            res.json({

                success: true,

                customer,

                summary: invoices

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| PRODUCTS
|--------------------------------------------------------------------------
*/

app.get(
    "/api/products",
    (req, res) => {

        try {

            const products =
                db.prepare(`
                    SELECT *
                    FROM products
                    ORDER BY name
                `).all();

            res.json({

                success: true,

                products

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| CREATE PRODUCT
|--------------------------------------------------------------------------
*/

app.post(
    "/api/products",
    (req, res) => {

        try {

            const name =
                cleanString(
                    req.body.name
                );

            const unit =
                cleanString(
                    req.body.unit
                ) ||
                "قطعة";

            const salePrice =
                toNumber(
                    req.body.sale_price
                );

            const costPrice =
                toNumber(
                    req.body.cost_price
                );

            const stock =
                toNumber(
                    req.body.stock
                );

            if (!name) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "اسم الصنف مطلوب"

                    });

            }

            const result =
                db.prepare(`
                    INSERT INTO products
                    (
                        name,
                        unit,
                        sale_price,
                        cost_price,
                        stock
                    )
                    VALUES (?, ?, ?, ?, ?)
                `).run(

                    String(name),

                    String(unit),

                    Number(salePrice),

                    Number(costPrice),

                    Number(stock)

                );

            res.json({

                success: true,

                id:
                    Number(
                        result.lastInsertRowid
                    ),

                message:
                    "تم إنشاء الصنف"

            });

        }

        catch (error) {

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| UPDATE PRODUCT STOCK
|--------------------------------------------------------------------------
*/

app.post(
    "/api/products/:id/stock",
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const quantity =
                toNumber(
                    req.body.quantity
                );

            if (
                !Number.isInteger(id)
            ) {

                throw new Error(
                    "معرف الصنف غير صحيح"
                );

            }

            if (
                !Number.isFinite(
                    quantity
                )
            ) {

                throw new Error(
                    "الكمية غير صحيحة"
                );

            }

            const product =
                db.prepare(`
                    SELECT *
                    FROM products
                    WHERE id = ?
                `).get(id);

            if (!product) {

                throw new Error(
                    "الصنف غير موجود"
                );

            }

            db.transaction(() => {

                db.prepare(`
                    UPDATE products
                    SET stock = stock + ?
                    WHERE id = ?
                `).run(

                    Number(quantity),

                    id

                );

                db.prepare(`
                    INSERT INTO stock_movements
                    (
                        product_id,
                        quantity,
                        movement_type,
                        reference_type
                    )
                    VALUES (?, ?, ?, ?)
                `).run(

                    id,

                    Number(quantity),

                    quantity >= 0
                        ? "purchase"
                        : "adjustment",

                    "manual"

                );

            })();

            const updated =
                db.prepare(`
                    SELECT *
                    FROM products
                    WHERE id = ?
                `).get(id);

            res.json({

                success: true,

                product:
                    updated

            });

        }

        catch (error) {

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| INVOICES LIST
|--------------------------------------------------------------------------
*/

app.get(
    "/api/invoices",
    (req, res) => {

        try {

            const limit =
                Math.min(
                    Math.max(
                        Number(
                            req.query.limit
                        ) || 100,
                        1
                    ),
                    500
                );

            const invoices =
                db.prepare(`
                    SELECT *
                    FROM invoices
                    ORDER BY id DESC
                    LIMIT ?
                `).all(
                    Number(limit)
                );

            res.json({

                success: true,

                invoices

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| DASHBOARD
|--------------------------------------------------------------------------
*/

app.get(
    "/api/dashboard",
    (req, res) => {

        try {

            const sales =
                db.prepare(`
                    SELECT
                        COALESCE(
                            SUM(total),
                            0
                        ) AS total
                    FROM invoices
                    WHERE
                        status !=
                        'draft'
                    AND
                        status !=
                        'cancelled'
                `)
                .get()
                .total;

            const receivables =
                db.prepare(`
                    SELECT
                        COALESCE(
                            SUM(
                                total - paid
                            ),
                            0
                        ) AS total
                    FROM invoices
                    WHERE
                        type =
                        'credit'
                    AND
                        status !=
                        'paid'
                    AND
                        status !=
                        'cancelled'
                `)
                .get()
                .total;

            const customers =
                db.prepare(`
                    SELECT COUNT(*) AS n
                    FROM customers
                `)
                .get()
                .n;

            const products =
                db.prepare(`
                    SELECT COUNT(*) AS n
                    FROM products
                `)
                .get()
                .n;

            const invoices =
                db.prepare(`
                    SELECT COUNT(*) AS n
                    FROM invoices
                    WHERE
                        status !=
                        'cancelled'
                `)
                .get()
                .n;

            const payments =
                db.prepare(`
                    SELECT
                        COALESCE(
                            SUM(amount),
                            0
                        ) AS total
                    FROM payments
                `)
                .get()
                .total;

            const inventory =
                db.prepare(`
                    SELECT
                        COALESCE(
                            SUM(
                                stock *
                                cost_price
                            ),
                            0
                        ) AS total
                    FROM products
                `)
                .get()
                .total;

            res.json({

                success: true,

                sales:
                    Number(sales),

                receivables:
                    Number(receivables),

                customers:
                    Number(customers),

                products:
                    Number(products),

                invoices:
                    Number(invoices),

                payments:
                    Number(payments),

                inventory_value:
                    Number(inventory)

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| JOURNAL
|--------------------------------------------------------------------------
*/

app.get(
    "/api/journal",
    (req, res) => {

        try {

            const entries =
                db.prepare(`
                    SELECT
                        je.id,
                        je.reference_type,
                        je.reference_id,
                        je.description,
                        je.entry_date,
                        jl.id AS line_id,
                        jl.account_code,
                        jl.account_name,
                        jl.debit,
                        jl.credit
                    FROM journal_entries je
                    JOIN journal_lines jl
                        ON jl.journal_id =
                           je.id
                    ORDER BY
                        je.id DESC,
                        jl.id ASC
                    LIMIT 1000
                `)
                .all();

            res.json({

                success: true,

                entries

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| TRIAL BALANCE
|--------------------------------------------------------------------------
*/

app.get(
    "/api/reports/trial-balance",
    (req, res) => {

        try {

            const rows =
                db.prepare(`
                    SELECT
                        account_code,
                        account_name,
                        COALESCE(
                            SUM(debit),
                            0
                        ) AS debit,
                        COALESCE(
                            SUM(credit),
                            0
                        ) AS credit
                    FROM journal_lines
                    GROUP BY
                        account_code,
                        account_name
                    ORDER BY
                        account_code
                `)
                .all();

            const totals =
                rows.reduce(
                    (result, row) => {

                        result.debit +=
                            Number(row.debit);

                        result.credit +=
                            Number(row.credit);

                        return result;

                    },
                    {
                        debit: 0,
                        credit: 0
                    }
                );

            res.json({

                success: true,

                accounts:
                    rows,

                totals,

                balanced:
                    Math.abs(
                        totals.debit -
                        totals.credit
                    ) < 0.001

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| PROFIT SUMMARY
|--------------------------------------------------------------------------
*/

app.get(
    "/api/reports/profit",
    (req, res) => {

        try {

            const sales =
                db.prepare(`
                    SELECT
                        COALESCE(
                            SUM(total),
                            0
                        ) AS total
                    FROM invoices
                    WHERE
                        status !=
                        'cancelled'
                `)
                .get()
                .total;

            /*
            في هذه المرحلة نحسب
            الإيرادات المسجلة.
            تكلفة المبيعات تحتاج
            إلى تطوير محرك تكلفة مخزون
            FIFO / Average Cost.
            */

            res.json({

                success: true,

                revenue:
                    Number(sales),

                cost_of_goods_sold:
                    0,

                gross_profit:
                    Number(sales),

                note:
                    "سيتم احتساب تكلفة المبيعات بعد تفعيل محرك تكلفة المخزون"

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| BANK UPLOAD
|--------------------------------------------------------------------------
*/

app.post(
    "/api/upload-bank",
    upload.single("file"),
    (req, res) => {

        if (!req.file) {

            return res
                .status(400)
                .json({

                    success: false,

                    error:
                        "ملف كشف البنك مطلوب"

                });

        }

        const uploadedFile =
            req.file.path;

        /*
        نحتفظ بالملف مؤقتاً.
        مرحلة المطابقة ستقرأ CSV
        وتضيف العمليات إلى bank_transactions.
        */

        res.json({

            success: true,

            message:
                "تم استلام كشف البنك",

            file: {

                original_name:
                    req.file.originalname,

                path:
                    uploadedFile,

                size:
                    req.file.size

            },

            next_step:
                "bank_reconciliation"

        });

    }
);


/*
|--------------------------------------------------------------------------
| WHATSAPP ACCOUNTS
|--------------------------------------------------------------------------
*/

app.get(
    "/api/whatsapp/accounts",
    (req, res) => {

        try {

            const accounts =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        phone,
                        status,
                        provider,
                        created_at
                    FROM whatsapp_accounts
                    ORDER BY id DESC
                `).all();

            res.json({

                success: true,

                accounts

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| ADD WHATSAPP ACCOUNT
|--------------------------------------------------------------------------
*/

app.post(
    "/api/whatsapp/accounts",
    (req, res) => {

        try {

            const name =
                cleanString(
                    req.body.name
                ) ||
                "WhatsApp";

            const phone =
                cleanString(
                    req.body.phone
                );

            const result =
                db.prepare(`
                    INSERT INTO whatsapp_accounts
                    (
                        name,
                        phone,
                        status,
                        provider
                    )
                    VALUES (?, ?, ?, ?)
                `).run(

                    String(name),

                    phone
                        ? String(phone)
                        : null,

                    "disconnected",

                    "gateway"

                );

            res.json({

                success: true,

                accountId:
                    Number(
                        result.lastInsertRowid
                    ),

                status:
                    "disconnected",

                message:
                    "تم إنشاء حساب WhatsApp، والخطوة التالية تشغيل Gateway وQR"

            });

        }

        catch (error) {

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| WHATSAPP MESSAGE INBOX
|--------------------------------------------------------------------------
*/

app.post(
    "/api/whatsapp/messages",
    (req, res) => {

        try {

            const accountId =
                Number(
                    req.body.account_id
                );

            const phone =
                cleanString(
                    req.body.phone
                );

            const body =
                cleanString(
                    req.body.body
                );

            if (
                !Number.isInteger(
                    accountId
                )
            ) {

                throw new Error(
                    "حساب WhatsApp غير صحيح"
                );

            }

            if (!body) {

                throw new Error(
                    "نص الرسالة مطلوب"
                );

            }

            /*
            تحليل الرسالة بالمحرك.
            */

            const parsed =
                awaitPromise(
                    parseTransaction(
                        body
                    )
                );

            /*
            سيتم التعامل مع async
            بواسطة awaitPromise.
            */

            Promise.resolve(parsed)
                .then(result => {

                    const normalized =
                        normalizeTransaction(
                            result
                        );

                    db.prepare(`
                        INSERT INTO whatsapp_messages
                        (
                            account_id,
                            direction,
                            phone,
                            body,
                            parsed_json
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `).run(

                        accountId,

                        "inbound",

                        phone,

                        body,

                        safeJson(
                            normalized
                        )

                    );

                    res.json({

                        success: true,

                        parsed:
                            normalized

                    });

                })
                .catch(error => {

                    res
                        .status(400)
                        .json({

                            success: false,

                            error:
                                error.message

                        });

                });

        }

        catch (error) {

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| AUDIT LOGS
|--------------------------------------------------------------------------
*/

app.get(
    "/api/audit",
    (req, res) => {

        try {

            const logs =
                db.prepare(`
                    SELECT *
                    FROM audit_logs
                    ORDER BY id DESC
                    LIMIT 500
                `)
                .all();

            res.json({

                success: true,

                logs

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| SETTINGS
|--------------------------------------------------------------------------
*/

app.get(
    "/api/settings/:key",
    (req, res) => {

        try {

            const key =
                cleanString(
                    req.params.key
                );

            const setting =
                db.prepare(`
                    SELECT *
                    FROM settings
                    WHERE key = ?
                `).get(key);

            res.json({

                success: true,

                setting:
                    setting || null

            });

        }

        catch (error) {

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


app.post(
    "/api/settings",
    (req, res) => {

        try {

            const key =
                cleanString(
                    req.body.key
                );

            const value =
                req.body.value;

            if (!key) {

                throw new Error(
                    "مفتاح الإعداد مطلوب"
                );

            }

            const safeValue =
                typeof value === "string"
                    ? value
                    : safeJson(value);

            db.prepare(`
                INSERT INTO settings
                (
                    key,
                    value
                )
                VALUES (?, ?)
                ON CONFLICT(key)
                DO UPDATE SET
                    value =
                    excluded.value
            `).run(

                String(key),

                String(safeValue)

            );

            res.json({

                success: true,

                message:
                    "تم حفظ الإعداد"

            });

        }

        catch (error) {

            res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| 404 API
|--------------------------------------------------------------------------
*/

app.use(
    "/api",
    (req, res) => {

        res
            .status(404)
            .json({

                success: false,

                error:
                    "API endpoint not found",

                path:
                    req.originalUrl

            });

    }
);


/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(
    (error, req, res, next) => {

        console.error(
            "GLOBAL ERROR:",
            error
        );

        if (res.headersSent) {

            return next(error);

        }

        res
            .status(500)
            .json({

                success: false,

                error:
                    "حدث خطأ داخلي في النظام"

            });

    }
);


/*
|--------------------------------------------------------------------------
| FRONTEND FALLBACK
|--------------------------------------------------------------------------
*/

/* 404 API */

app.use(
    "/api",
    (req, res) => {

        res
            .status(404)
            .json({

                success: false,

                error:
                    "API endpoint not found"

            });

    }
);


/* FRONTEND FALLBACK */

app.use(
    (req, res, next) => {

        // إذا كان الطلب لملف أو مسار API
        // لا نعيد index.html
        if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/invoices")
        ) {
            return next();
        }

        res.sendFile(
            path.join(
                ROOT,
                "public",
                "index.html"
            )
        );

    }
);


/* SERVER */

app.listen(
    PORT,
    () => {

        console.log(
            `🌉 Jusoor Accounting running on port ${PORT}`
        );

        console.log(
            `🚀 Server started on port ${PORT}`
        );

    }
);

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "🌉 JUSOOR ACCOUNTING"
        );

        console.log(
            "🚀 Accounting Engine: ACTIVE"
        );

        console.log(
            "🤖 AI Engine: ACTIVE"
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            "========================================"
        );

    }
);


/*
|--------------------------------------------------------------------------
| SMALL ASYNC HELPER
|--------------------------------------------------------------------------
*/

function awaitPromise(value) {

    return Promise.resolve(value);

}
