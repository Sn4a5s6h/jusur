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
| APPLICATION
|--------------------------------------------------------------------------
*/

const app = express();

const PORT =
    Number(process.env.PORT) || 3001;

const ROOT =
    path.join(__dirname, "..");

const PUBLIC_DIR =
    path.join(ROOT, "public");

const UPLOADS =
    path.join(ROOT, "uploads");

const INVOICES =
    path.join(ROOT, "invoices");


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

app.disable("x-powered-by");

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


/*
|--------------------------------------------------------------------------
| FILE UPLOAD
|--------------------------------------------------------------------------
*/

const upload =
    multer({
        dest: UPLOADS,

        limits: {
            fileSize:
                10 * 1024 * 1024
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


function toNumber(
    value,
    fallback = 0
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    if (
        typeof value === "number"
    ) {

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
            .replace(
                /[٠-٩]/g,
                c => arabicMap[c]
            )
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
                    cleanString(
                        item.name
                    ),

                qty:
                    toNumber(
                        item.qty
                    ),

                price:
                    toNumber(
                        item.price
                    ),

                unit:
                    cleanString(
                        item.unit
                    ) || "قطعة"

            };

        })
        .filter(Boolean);

}


function normalizeTransaction(parsed) {

    if (
        !parsed ||
        typeof parsed !== "object"
    ) {

        throw new Error(
            "بيانات المعاملة غير صحيحة"
        );

    }

    const normalized = {

        intent:
            cleanString(
                parsed.intent
            ) || "unknown",

        customer:
            cleanString(
                parsed.customer
            ),

        customer_phone:
            cleanString(
                parsed.customer_phone
            ),

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
            cleanString(
                parsed.due_date
            ),

        items:
            normalizeItems(
                parsed.items
            ),

        discount:
            toNumber(
                parsed.discount
            ),

        tax:
            toNumber(
                parsed.tax
            ),

        total:
            toNumber(
                parsed.total
            ),

        ready:
            Boolean(
                parsed.ready
            ),

        needs_confirmation:
            parsed.needs_confirmation !== false,

        original_text:
            cleanString(
                parsed.original_text
            )

    };


    /*
    |--------------------------------------------------------------------------
    | RECALCULATE TOTAL
    |--------------------------------------------------------------------------
    */

    const subtotal =
        normalized.items.reduce(
            (
                sum,
                item
            ) => {

                return (
                    sum +
                    (
                        item.qty *
                        item.price
                    )
                );

            },
            0
        );


    normalized.subtotal =
        subtotal;


    normalized.total =
        subtotal -
        normalized.discount +
        normalized.tax;


    /*
    |--------------------------------------------------------------------------
    | CASH SALE
    |--------------------------------------------------------------------------
    */

    if (
        normalized.type === "cash"
    ) {

        normalized.due_days =
            null;

        normalized.due_date =
            null;

    }


    return normalized;

}


function validateTransaction(
    transaction
) {

    const errors = [];


    /*
    |--------------------------------------------------------------------------
    | INTENT
    |--------------------------------------------------------------------------
    */

    if (
        transaction.intent !==
        "sales_invoice"
    ) {

        errors.push(
            "نوع العملية غير مدعوم"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | CUSTOMER
    |--------------------------------------------------------------------------
    */

    if (
        !transaction.customer
    ) {

        errors.push(
            "اسم العميل مطلوب"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | ITEMS
    |--------------------------------------------------------------------------
    */

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
            !Number.isFinite(
                item.qty
            ) ||
            item.qty <= 0
        ) {

            errors.push(
                `الكمية غير صحيحة للصنف: ${
                    item.name ||
                    "غير معروف"
                }`
            );

        }


        if (
            !Number.isFinite(
                item.price
            ) ||
            item.price < 0
        ) {

            errors.push(
                `السعر غير صحيح للصنف: ${
                    item.name ||
                    "غير معروف"
                }`
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | DISCOUNT
    |--------------------------------------------------------------------------
    */

    if (
        !Number.isFinite(
            transaction.discount
        ) ||
        transaction.discount < 0
    ) {

        errors.push(
            "الخصم غير صحيح"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | TAX
    |--------------------------------------------------------------------------
    */

    if (
        !Number.isFinite(
            transaction.tax
        ) ||
        transaction.tax < 0
    ) {

        errors.push(
            "الضريبة غير صحيحة"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | TOTAL
    |--------------------------------------------------------------------------
    */

    if (
        !Number.isFinite(
            transaction.total
        ) ||
        transaction.total < 0
    ) {

        errors.push(
            "إجمالي الفاتورة غير صحيح"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | CREDIT TERMS
    |--------------------------------------------------------------------------
    */

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

    }
    catch {

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
                "3.1.0",

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
| SYSTEM INFORMATION
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
                "3.1.0",

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

                trial_balance:
                    true,

                profit_report:
                    true,

                customer_statement:
                    true,

                pdf:
                    true,

                whatsapp:
                    true,

                bank_import:
                    true,

                audit:
                    true,

                settings:
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


            const parsed =
                await Promise.resolve(
                    parseTransaction(
                        text
                    )
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


            normalized.original_text =
                normalized.original_text ||
                text;


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

            if (
                !req.body.parsed
            ) {

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
            |--------------------------------------------------------------------------
            | CREATE INVOICE
            |--------------------------------------------------------------------------
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
            |--------------------------------------------------------------------------
            | PDF
            |--------------------------------------------------------------------------
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


            db.prepare(`
                UPDATE invoices
                SET pdf_path = ?
                WHERE id = ?
            `).run(

                String(pdfPath),

                Number(
                    invoice.id
                )

            );


            /*
            |--------------------------------------------------------------------------
            | AUDIT
            |--------------------------------------------------------------------------
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

                Number(
                    invoice.id
                ),

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
| GET INVOICE
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


            if (
                !Number.isInteger(id)
            ) {

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

            }
            catch {

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


            if (
                !Number.isInteger(id)
            ) {

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

                    let items = [];


                    try {

                        items =
                            JSON.parse(
                                invoice.items_json
                            );

                    }
                    catch {

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
                !Number.isFinite(
                    amount
                ) ||
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


            if (
                !Number.isInteger(id)
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "معرف العميل غير صحيح"

                    });

            }


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


            const
