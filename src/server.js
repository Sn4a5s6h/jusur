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

const {
    hashPassword,
    verifyPassword,
    createToken,
    verifyToken
} = require("../auth/auth");

// ============================================
// MIDDLEWARE - NEW
// ============================================
const { initializeDatabase } = require("./db/init");
const { validate, schemas } = require("./middleware/validate");
const { authorize, authorizeRole } = require("./middleware/rbac");
const { authLimiter, apiLimiter, sensitiveLimiter } = require("./middleware/rateLimit");
const { cleanupUploads, cleanupInvoices } = require("./services/cleanup");
const { sendInvoiceEmail, sendPaymentConfirmation } = require("./services/email");

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
| DATABASE INITIALIZATION - NEW
|--------------------------------------------------------------------------
*/

initializeDatabase();


/*
|--------------------------------------------------------------------------
| SECURITY
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
    cors({
        origin: true,
        credentials: true
    })
);


/*
|--------------------------------------------------------------------------
| BODY PARSER
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| RATE LIMITING - NEW
|--------------------------------------------------------------------------
*/

app.use("/api", apiLimiter);


/*
|--------------------------------------------------------------------------
| STATIC FILES
|--------------------------------------------------------------------------
*/

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

    const text =
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


function safeJson(value) {

    try {

        return JSON.stringify(value);

    }
    catch {

        return "{}";

    }
}


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

function authenticate(req, res, next) {

    try {

        const header =
            req.headers.authorization;

        if (
            !header ||
            !header.startsWith("Bearer ")
        ) {

            return res
                .status(401)
                .json({

                    success: false,

                    error:
                        "يجب تسجيل الدخول أولاً"

                });

        }


        const token =
            header.substring(7).trim();


        if (!token) {

            return res
                .status(401)
                .json({

                    success: false,

                    error:
                        "رمز الدخول مفقود"

                });

        }


        const decoded =
            verifyToken(token);


        if (!decoded) {

            return res
                .status(401)
                .json({

                    success: false,

                    error:
                        "جلسة الدخول غير صالحة أو منتهية"

                });

        }


        req.user =
            decoded;


        next();

    }
    catch (error) {

        console.error(
            "AUTH ERROR:",
            error
        );

        return res
            .status(401)
            .json({

                success: false,

                error:
                    "غير مصرح بالدخول"

            });

    }

}


/*
|--------------------------------------------------------------------------
| PUBLIC API
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
                "4.0.0",

            status:
                "running",

            accounting_engine:
                "active",

            ai_engine:
                "active",

            authentication:
                "active",

            database:
                "SQLite"

        });

    }
);


/*
|--------------------------------------------------------------------------
| AUTH ROUTES
|--------------------------------------------------------------------------
*/

app.post(
    "/api/auth/login",
    authLimiter,
    validate(schemas.login),
    async (req, res) => {

        try {

            const username =
                cleanString(
                    req.body.username
                );

            const password =
                cleanString(
                    req.body.password
                );

            const user =
                db.prepare(`
                    SELECT *
                    FROM users
                    WHERE username = ?
                    AND status = 'active'
                    LIMIT 1
                `).get(
                    username
                );

            if (!user) {

                return res
                    .status(401)
                    .json({

                        success: false,

                        error:
                            "اسم المستخدم أو كلمة المرور غير صحيحة"

                    });

            }

            const valid =
                await Promise.resolve(
                    verifyPassword(
                        password,
                        user.password_hash
                    )
                );

            if (!valid) {

                return res
                    .status(401)
                    .json({

                        success: false,

                        error:
                            "اسم المستخدم أو كلمة المرور غير صحيحة"

                    });

            }

            const token =
                createToken({

                    id:
                        user.id,

                    username:
                        user.username,

                    role:
                        user.role

                });

            try {

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

                    "login",

                    "user",

                    Number(user.id),

                    safeJson({

                        username:
                            user.username

                    })

                );

            }
            catch (auditError) {

                console.error(
                    "LOGIN AUDIT ERROR:",
                    auditError
                );

            }

            res.json({

                success: true,

                message:
                    "تم تسجيل الدخول بنجاح",

                token,

                user: {

                    id:
                        user.id,

                    username:
                        user.username,

                    name:
                        user.name ||
                        user.username,

                    role:
                        user.role

                }

            });

        }
        catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            res
                .status(500)
                .json({

                    success: false,

                    error:
                        "حدث خطأ أثناء تسجيل الدخول"

                });

        }

    }
);


/*
|--------------------------------------------------------------------------
| AUTH REGISTER - NEW
|--------------------------------------------------------------------------
*/

app.post(
    "/api/auth/register",
    authLimiter,
    validate(schemas.register),
    async (req, res) => {
        try {
            const { username, password, name, role } = req.body;

            const existing = db.prepare(`
                SELECT id FROM users WHERE username = ?
            `).get(username);

            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: "اسم المستخدم موجود مسبقاً"
                });
            }

            const hashedPassword = await Promise.resolve(hashPassword(password));

            const result = db.prepare(`
                INSERT INTO users (username, password_hash, name, role, status)
                VALUES (?, ?, ?, ?, 'active')
            `).run(username, hashedPassword, name || username, role || 'user');

            try {
                db.prepare(`
                    INSERT INTO audit_logs (action, entity_type, entity_id, details)
                    VALUES (?, ?, ?, ?)
                `).run(
                    "register",
                    "user",
                    Number(result.lastInsertRowid),
                    safeJson({ username, role: role || 'user' })
                );
            } catch (auditError) {
                console.error("REGISTER AUDIT ERROR:", auditError);
            }

            res.json({
                success: true,
                message: "تم إنشاء المستخدم بنجاح",
                user: {
                    id: result.lastInsertRowid,
                    username,
                    name: name || username,
                    role: role || 'user'
                }
            });
        } catch (error) {
            console.error("REGISTER ERROR:", error);
            res.status(500).json({
                success: false,
                error: error.message || "حدث خطأ أثناء إنشاء المستخدم"
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| AUTH ME
|--------------------------------------------------------------------------
*/

app.get(
    "/api/auth/me",
    authenticate,
    (req, res) => {

        try {

            const user =
                db.prepare(`
                    SELECT
                        id,
                        username,
                        name,
                        role,
                        status,
                        created_at
                    FROM users
                    WHERE id = ?
                    LIMIT 1
                `).get(
                    Number(
                        req.user.id
                    )
                );

            if (!user) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        error:
                            "المستخدم غير موجود"

                    });

            }

            res.json({

                success: true,

                user

            });

        }
        catch (error) {

            console.error(
                "ME ERROR:",
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


app.post(
    "/api/auth/logout",
    authenticate,
    (req, res) => {

        try {

            try {

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

                    "logout",

                    "user",

                    Number(
                        req.user.id
                    ),

                    safeJson({

                        username:
                            req.user.username

                    })

                );

            }
            catch (auditError) {

                console.error(
                    "LOGOUT AUDIT ERROR:",
                    auditError
                );

            }

            res.json({

                success: true,

                message:
                    "تم تسجيل الخروج"

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
| PROTECTED API MIDDLEWARE
|--------------------------------------------------------------------------
*/

app.use(
    "/api",
    (req, res, next) => {

        if (
            req.path === "/health"
        ) {
            return next();
        }

        if (
            req.path.startsWith("/auth/")
        ) {
            return next();
        }

        return authenticate(req, res, next);
    }
);


/*
|--------------------------------------------------------------------------
| NORMALIZE FUNCTIONS
|--------------------------------------------------------------------------
*/

function normalizeItems(items) {

    if (
        !Array.isArray(items)
    ) {

        return [];

    }

    return items
        .map(
            item => {

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
                        ) ||
                        "قطعة"

                };

            }
        )
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

    const transaction = {

        intent:
            cleanString(
                parsed.intent
            ) ||
            "unknown",

        customer:
            cleanString(
                parsed.customer
            ),

        customer_phone:
            cleanString(
                parsed.customer_phone
            ),

        supplier:
            cleanString(
                parsed.supplier
            ),

        supplier_phone:
            cleanString(
                parsed.supplier_phone
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

        amount:
            toNumber(
                parsed.amount
            ),

        paid:
            toNumber(
                parsed.paid
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

        description:
            cleanString(
                parsed.description
            ),

        payment_method:
            cleanString(
                parsed.payment_method
            ) ||
            "cash",

        ready:
            Boolean(
                parsed.ready
            ),

        needs_confirmation:
            parsed.needs_confirmation !==
            false,

        original_text:
            cleanString(
                parsed.original_text
            )

    };

    const subtotal =
        transaction.items.reduce(
            (
                sum,
                item
            ) => {

                return (
                    sum +
                    (
                        Number(item.qty) *
                        Number(item.price)
                    )
                );

            },
            0
        );

    transaction.subtotal = subtotal;

    transaction.total =
        subtotal -
        transaction.discount +
        transaction.tax;

    if (
        transaction.type === "cash"
    ) {

        transaction.due_days = null;
        transaction.due_date = null;

    }

    return transaction;

}


function validateTransaction(transaction) {

    const errors = [];

    const supportedIntents = [

        "sales_invoice",
        "purchase_invoice",
        "payment",
        "receipt",
        "expense",
        "income",
        "stock_adjustment"

    ];

    if (
        !supportedIntents.includes(
            transaction.intent
        )
    ) {

        errors.push(
            "نوع العملية غير مدعوم"
        );

    }

    if (
        transaction.intent ===
        "sales_invoice"
    ) {

        if (
            !transaction.customer
        ) {

            errors.push(
                "اسم العميل مطلوب"
            );

        }

        if (
            !transaction.items.length
        ) {

            errors.push(
                "يجب إضافة صنف واحد على الأقل"
            );

        }

    }

    if (
        transaction.intent ===
        "purchase_invoice"
    ) {

        if (
            !transaction.supplier
        ) {

            errors.push(
                "اسم المورد مطلوب"
            );

        }

        if (
            !transaction.items.length
        ) {

            errors.push(
                "يجب إضافة صنف واحد على الأقل"
            );

        }

    }

    for (
        const item
        of transaction.items
    ) {

        if (
            !item.name
        ) {

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

    if (
        [
            "payment",
            "receipt",
            "expense",
            "income"
        ].includes(
            transaction.intent
        )
    ) {

        if (
            !Number.isFinite(
                transaction.amount
            ) ||
            transaction.amount <= 0
        ) {

            errors.push(
                "المبلغ مطلوب ويجب أن يكون أكبر من صفر"
            );

        }

    }

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

    if (
        transaction.intent ===
        "sales_invoice"
    ) {

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

    }

    return errors;

}


function calculateDueDate(transaction) {

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


/*
|--------------------------------------------------------------------------
| SYSTEM
|--------------------------------------------------------------------------
*/

app.get(
    "/api/system",
    (req, res) => {

        try {

            res.json({

                success: true,

                system:
                    "Jusoor Accounting",

                version:
                    "4.0.0",

                node:
                    process.version,

                environment:
                    process.env.NODE_ENV ||
                    "production",

                user:
                    req.user || null,

                features: {

                    authentication: true,

                    users: true,

                    companies: true,

                    financial_years: true,

                    ai: true,

                    invoices: true,

                    customers: true,

                    suppliers: true,

                    products: true,

                    inventory: true,

                    payments: true,

                    receipts: true,

                    expenses: true,

                    journal: true,

                    trial_balance: true,

                    profit_report: true,

                    customer_statement: true,

                    supplier_statement: true,

                    pdf: true,

                    whatsapp: true,

                    bank_import: true,

                    audit: true,

                    settings: true

                }

            });

        }
        catch (error) {

            console.error(
                "SYSTEM ERROR:",
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
| AI ROUTES
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

            normalized.original_text =
                normalized.original_text ||
                text;

            const errors =
                validateTransaction(
                    normalized
                );

            normalized.validation_errors =
                errors;

            normalized.ready =
                errors.length === 0;

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

app.post(
    "/api/transactions/preview",
    (req, res) => {

        try {

            if (!req.body.parsed) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        error: "بيانات المعاملة مطلوبة"
                    });

            }

            const transaction =
                normalizeTransaction(
                    req.body.parsed
                );

            const errors =
                validateTransaction(
                    transaction
                );

            transaction.validation_errors =
                errors;

            transaction.ready =
                errors.length === 0;

            transaction.needs_confirmation =
                true;

            res.json({

                success:
                    errors.length === 0,

                ready:
                    transaction.ready,

                errors,

                transaction

            });

        }
        catch (error) {

            console.error(
                "TRANSACTION PREVIEW ERROR:",
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
                            "بيانات المعاملة مطلوبة"

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

            if (errors.length > 0) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "المعاملة غير مكتملة",

                        errors

                    });

            }

            if (
                parsed.intent !==
                "sales_invoice"
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "هذه الواجهة مخصصة لفواتير المبيعات"

                    });

            }

            const dueDate =
                calculateDueDate(
                    parsed
                );

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

            let payment = null;

            const paidAmount =
                Number(
                    parsed.paid || 0
                );

            if (
                paidAmount > 0
            ) {

                if (
                    paidAmount >
                    Number(invoice.total)
                ) {

                    throw new Error(
                        "المبلغ المدفوع أكبر من إجمالي الفاتورة"
                    );

                }

                payment =
                    recordPayment({

                        invoiceId:
                            Number(
                                invoice.id
                            ),

                        amount:
                            paidAmount,

                        method:
                            parsed.payment_method ||
                            "cash",

                        reference:
                            null

                    });

            }

            let pdfUrl = null;

            try {

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

                pdfUrl =
                    `/invoices/${invoice.inv_no}.pdf`;

            }
            catch (pdfError) {

                console.error(
                    "PDF ERROR:",
                    pdfError
                );

            }

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

                    user_id:
                        req.user
                            ? req.user.id
                            : null,

                    username:
                        req.user
                            ? req.user.username
                            : null,

                    original_text:
                        parsed.original_text,

                    invoice:
                        invoice.inv_no,

                    type:
                        parsed.type,

                    paid:
                        paidAmount

                })

            );

            // إرسال الفاتورة عبر البريد إذا كان العميل لديه بريد
            if (parsed.customer_phone && parsed.customer_phone.includes('@')) {
                try {
                    await sendInvoiceEmail(
                        parsed.customer_phone,
                        invoice.inv_no,
                        pdfUrl,
                        parsed.customer
                    );
                } catch (emailError) {
                    console.error("EMAIL SEND ERROR:", emailError);
                }
            }

            res.json({

                success: true,

                message:
                    "تم حفظ المعاملة بنجاح",

                invoice: {

                    ...invoice,

                    due_date:
                        dueDate,

                    pdf_url:
                        pdfUrl

                },

                payment

            });

        }
        catch (error) {

            console.error(
                "COMMIT TRANSACTION ERROR:",
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
| INVOICE ROUTES
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
                    LIMIT 1
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

            console.error(
                "GET INVOICE ERROR:",
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
                    SELECT
                        i.*,
                        c.name AS customer_name
                    FROM invoices i
                    LEFT JOIN customers c
                        ON c.id = i.customer_id
                    ORDER BY i.id DESC
                    LIMIT ?
                `).all(
                    limit
                );

            res.json({

                success: true,

                invoices

            });

        }
        catch (error) {

            console.error(
                "INVOICES ERROR:",
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
| INVOICE CANCEL
|--------------------------------------------------------------------------
*/

app.post(
    "/api/invoices/:id/cancel",
    (req, res) => {

        try {

            const invoiceId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(invoiceId) ||
                invoiceId <= 0
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
                    LIMIT 1
                `).get(
                    invoiceId
                );

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
                        "الفاتورة ملغاة مسبقاً",

                    invoice

                });

            }

            let items = [];

            try {

                items =
                    JSON.parse(
                        invoice.items_json ||
                        "[]"
                    );

            }
            catch {

                items = [];

            }

            const cancelInvoice =
                db.transaction(() => {

                    for (
                        const item
                        of items
                    ) {

                        const productName =
                            cleanString(
                                item.name
                            );

                        const quantity =
                            toNumber(
                                item.qty
                            );

                        if (
                            !productName ||
                            quantity <= 0
                        ) {

                            continue;

                        }

                        const product =
                            db.prepare(`
                                SELECT *
                                FROM products
                                WHERE name = ?
                                LIMIT 1
                            `).get(
                                productName
                            );

                        if (product) {

                            db.prepare(`
                                UPDATE products
                                SET stock =
                                    stock + ?
                                WHERE id = ?
                            `).run(

                                quantity,

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

                                quantity,

                                "return",

                                "invoice_cancel",

                                invoiceId

                            );

                        }

                    }

                    db.prepare(`
                        UPDATE invoices
                        SET
                            status = 'cancelled'
                        WHERE id = ?
                    `).run(
                        invoiceId
                    );

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

                        invoiceId,

                        safeJson({

                            invoice_id:
                                invoiceId,

                            invoice_no:
                                invoice.inv_no,

                            user_id:
                                req.user
                                    ? req.user.id
                                    : null,

                            username:
                                req.user
                                    ? req.user.username
                                    : null,

                            reason:
                                cleanString(
                                    req.body.reason
                                ) ||
                                "إلغاء الفاتورة",

                            restored_items:
                                items

                        })

                    );

                });

            cancelInvoice();

            const updatedInvoice =
                db.prepare(`
                    SELECT *
                    FROM invoices
                    WHERE id = ?
                    LIMIT 1
                `).get(
                    invoiceId
                );

            res.json({

                success: true,

                message:
                    "تم إلغاء الفاتورة واسترجاع المخزون بنجاح",

                invoice:
                    updatedInvoice

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
| INVOICE EMAIL - NEW
|--------------------------------------------------------------------------
*/

app.post(
    "/api/invoices/:id/email",
    authenticate,
    authorize('view_invoices'),
    async (req, res) => {
        try {
            const id = Number(req.params.id);
            
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    error: "رقم الفاتورة غير صحيح"
                });
            }

            const invoice = db.prepare(`
                SELECT i.*, c.name as customer_name, c.phone as customer_phone
                FROM invoices i
                LEFT JOIN customers c ON c.id = i.customer_id
                WHERE i.id = ?
            `).get(id);

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: "الفاتورة غير موجودة"
                });
            }

            const email = req.body.email || invoice.customer_phone;
            
            if (!email || !email.includes('@')) {
                return res.status(400).json({
                    success: false,
                    error: "البريد الإلكتروني مطلوب"
                });
            }

            const pdfPath = invoice.pdf_path || path.join(INVOICES, `${invoice.inv_no}.pdf`);
            
            if (!fs.existsSync(pdfPath)) {
                return res.status(404).json({
                    success: false,
                    error: "ملف PDF غير موجود"
                });
            }

            const sent = await sendInvoiceEmail(
                email,
                invoice.inv_no,
                pdfPath,
                invoice.customer_name
            );

            if (!sent) {
                return res.status(500).json({
                    success: false,
                    error: "حدث خطأ أثناء إرسال البريد"
                });
            }

            res.json({
                success: true,
                message: `تم إرسال الفاتورة ${invoice.inv_no} إلى ${email}`
            });
        } catch (error) {
            console.error("INVOICE EMAIL ERROR:", error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| PAYMENT ROUTES - FIXED (async)
|--------------------------------------------------------------------------
*/

app.post(
    "/api/payments",
    authenticate,
    validate(schemas.payment),
    async (req, res) => { // ✅ تم إضافة async هنا

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
                ) ||
                invoiceId <= 0
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "رقم الفاتورة غير صحيح"

                    });

            }

            if (
                !Number.isFinite(
                    amount
                ) ||
                amount <= 0
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "مبلغ القبض يجب أن يكون أكبر من صفر"

                    });

            }

            const invoice =
                db.prepare(`
                    SELECT *
                    FROM invoices
                    WHERE id = ?
                    LIMIT 1
                `).get(
                    invoiceId
                );

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

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "لا يمكن تسجيل قبض على فاتورة ملغاة"

                    });

            }

            const remaining =
                Math.max(

                    Number(
                        invoice.total || 0
                    ) -
                    Number(
                        invoice.paid || 0
                    ),

                    0

                );

            if (
                amount >
                remaining
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "مبلغ القبض أكبر من الرصيد المتبقي",

                        remaining

                    });

            }

            const updatedInvoice =
                recordPayment({

                    invoiceId,

                    amount,

                    method,

                    reference

                });

            try {

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

                    "payment",

                    "invoice",

                    invoiceId,

                    safeJson({

                        amount,

                        method,

                        reference,

                        user_id:
                            req.user
                                ? req.user.id
                                : null,

                        username:
                            req.user
                                ? req.user.username
                                : null

                    })

                );

            }
            catch (auditError) {

                console.error(
                    "PAYMENT AUDIT ERROR:",
                    auditError
                );

            }

            // ✅ إرسال تأكيد الدفع عبر البريد - الآن يعمل بشكل صحيح
            try {
                const customer = db.prepare(`
                    SELECT phone FROM customers WHERE id = ?
                `).get(invoice.customer_id);
                
                if (customer && customer.phone && customer.phone.includes('@')) {
                    await sendPaymentConfirmation(
                        customer.phone,
                        invoice.inv_no,
                        amount,
                        method
                    );
                }
            } catch (emailError) {
                console.error("PAYMENT EMAIL ERROR:", emailError);
            }

            res.json({

                success: true,

                message:
                    "تم تسجيل القبض بنجاح",

                payment: {

                    amount,

                    method,

                    reference

                },

                invoice:
                    updatedInvoice

            });

        }
        catch (error) {

            console.error(
                "PAYMENT ERROR:",
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
| CUSTOMER ROUTES
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

            console.error(
                "CUSTOMER STATEMENT ERROR:",
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
                                        i.total - i.paid
                                    )
                                FROM invoices i
                                WHERE
                                    i.customer_id = c.id
                                AND
                                    i.status != 'cancelled'
                            ),
                            0
                        ) AS balance

                    FROM customers c

                    ORDER BY c.name ASC
                `).all();

            res.json({

                success: true,

                customers

            });

        }
        catch (error) {

            console.error(
                "CUSTOMERS ERROR:",
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


app.post(
    "/api/customers",
    authenticate,
    validate(schemas.customer),
    (req, res) => {

        try {

            const name =
                cleanString(
                    req.body.name
                );

            const phone =
                cleanString(
                    req.body.phone
                );

            const address =
                cleanString(
                    req.body.address
                );

            const notes =
                cleanString(
                    req.body.notes
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

            const existing =
                db.prepare(`
                    SELECT id
                    FROM customers
                    WHERE name = ?
                    LIMIT 1
                `).get(name);

            if (existing) {

                return res
                    .status(409)
                    .json({

                        success: false,

                        error:
                            "العميل موجود مسبقاً",

                        customer_id:
                            existing.id

                    });

            }

            const result =
                db.prepare(`
                    INSERT INTO customers
                    (
                        name,
                        phone,
                        address,
                        notes
                    )
                    VALUES (?, ?, ?, ?)
                `).run(

                    name,
                    phone,
                    address,
                    notes

                );

            const customer =
                db.prepare(`
                    SELECT *
                    FROM customers
                    WHERE id = ?
                `).get(
                    Number(
                        result.lastInsertRowid
                    )
                );

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

                "create",

                "customer",

                Number(
                    result.lastInsertRowid
                ),

                safeJson({

                    name,

                    phone,

                    user_id:
                        req.user
                            ? req.user.id
                            : null

                })

            );

            res.json({

                success: true,

                message:
                    "تم إنشاء العميل بنجاح",

                customer

            });

        }
        catch (error) {

            console.error(
                "CREATE CUSTOMER ERROR:",
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


app.get(
    "/api/customers/:id/summary",
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(id) ||
                id <= 0
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
                    LIMIT 1
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

            const summary =
                db.prepare(`
                    SELECT

                        COUNT(*) AS invoice_count,

                        COALESCE(
                            SUM(total),
                            0
                        ) AS total_sales,

                        COALESCE(
                            SUM(paid),
                            0
                        ) AS total_paid,

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

            const payments =
                db.prepare(`
                    SELECT
                        p.*
                    FROM payments p

                    JOIN invoices i
                        ON i.id = p.invoice_id

                    WHERE
                        i.customer_id = ?

                    ORDER BY
                        p.id DESC

                    LIMIT 500
                `).all(id);

            const invoices =
                db.prepare(`
                    SELECT
                        *
                    FROM invoices

                    WHERE
                        customer_id = ?

                    ORDER BY
                        id DESC

                    LIMIT 500
                `).all(id);

            res.json({

                success: true,

                customer,

                summary,

                invoices,

                payments

            });

        }
        catch (error) {

            console.error(
                "CUSTOMER SUMMARY ERROR:",
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


app.put(
    "/api/customers/:id",
    authenticate,
    validate(schemas.customer),
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                throw new Error(
                    "معرف العميل غير صحيح"
                );

            }

            const customer =
                db.prepare(`
                    SELECT *
                    FROM customers
                    WHERE id = ?
                `).get(id);

            if (!customer) {

                throw new Error(
                    "العميل غير موجود"
                );

            }

            const name =
                cleanString(
                    req.body.name
                ) ||
                customer.name;

            const phone =
                cleanString(
                    req.body.phone
                );

            const address =
                cleanString(
                    req.body.address
                );

            const notes =
                cleanString(
                    req.body.notes
                );

            db.prepare(`
                UPDATE customers

                SET
                    name = ?,
                    phone = ?,
                    address = ?,
                    notes = ?

                WHERE id = ?
            `).run(

                name,
                phone,
                address,
                notes,
                id

            );

            const updated =
                db.prepare(`
                    SELECT *
                    FROM customers
                    WHERE id = ?
                `).get(id);

            res.json({

                success: true,

                message:
                    "تم تحديث بيانات العميل",

                customer:
                    updated

            });

        }
        catch (error) {

            console.error(
                "UPDATE CUSTOMER ERROR:",
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
| SUPPLIER ROUTES
|--------------------------------------------------------------------------
*/

app.get(
    "/api/suppliers",
    (req, res) => {

        try {

            const suppliers =
                db.prepare(`
                    SELECT
                        s.*,

                        COALESCE(
                            (
                                SELECT
                                    SUM(
                                        i.total - i.paid
                                    )
                                FROM purchase_invoices i
                                WHERE
                                    i.supplier_id = s.id
                                AND
                                    i.status != 'cancelled'
                            ),
                            0
                        ) AS balance

                    FROM suppliers s

                    ORDER BY s.name ASC
                `).all();

            res.json({

                success: true,

                suppliers

            });

        }
        catch (error) {

            try {

                const suppliers =
                    db.prepare(`
                        SELECT *
                        FROM suppliers
                        ORDER BY name ASC
                    `).all();

                res.json({

                    success: true,

                    suppliers

                });

            }
            catch {

                res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            error.message

                    });

            }

        }

    }
);


app.post(
    "/api/suppliers",
    authenticate,
    validate(schemas.supplier),
    (req, res) => {

        try {

            const name =
                cleanString(
                    req.body.name
                );

            const phone =
                cleanString(
                    req.body.phone
                );

            const address =
                cleanString(
                    req.body.address
                );

            const notes =
                cleanString(
                    req.body.notes
                );

            if (!name) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "اسم المورد مطلوب"

                    });

            }

            const result =
                db.prepare(`
                    INSERT INTO suppliers
                    (
                        name,
                        phone,
                        address,
                        notes
                    )
                    VALUES (?, ?, ?, ?)
                `).run(

                    name,
                    phone,
                    address,
                    notes

                );

            const supplier =
                db.prepare(`
                    SELECT *
                    FROM suppliers
                    WHERE id = ?
                `).get(
                    Number(
                        result.lastInsertRowid
                    )
                );

            res.json({

                success: true,

                message:
                    "تم إنشاء المورد بنجاح",

                supplier

            });

        }
        catch (error) {

            console.error(
                "CREATE SUPPLIER ERROR:",
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
| PURCHASE INVOICES - NEW
|--------------------------------------------------------------------------
*/

app.post(
    "/api/purchases",
    authenticate,
    authorize('create_purchase'),
    validate(schemas.purchase),
    async (req, res) => {
        try {
            const { supplier, items, type, due_date, discount, tax } = req.body;

            let supplierId = null;
            let supplierRecord = db.prepare(`
                SELECT id FROM suppliers WHERE name = ?
            `).get(supplier);

            if (!supplierRecord) {
                const result = db.prepare(`
                    INSERT INTO suppliers (name) VALUES (?)
                `).run(supplier);
                supplierId = result.lastInsertRowid;
            } else {
                supplierId = supplierRecord.id;
            }

            let subtotal = 0;
            const itemsWithPrice = items.map(item => {
                const itemPrice = Number(item.price) || 0;
                const itemQty = Number(item.qty) || 0;
                subtotal += (itemQty * itemPrice);
                return {
                    ...item,
                    price: itemPrice,
                    qty: itemQty
                };
            });

            const total = subtotal - (Number(discount) || 0) + (Number(tax) || 0);

            const invNo = `P-${Date.now()}`;
            const result = db.prepare(`
                INSERT INTO purchase_invoices (
                    inv_no, supplier_id, type, status,
                    total, discount, tax, items_json,
                    due_date, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                invNo,
                supplierId,
                type || 'cash',
                'active',
                total,
                Number(discount) || 0,
                Number(tax) || 0,
                JSON.stringify(itemsWithPrice),
                due_date || null,
                req.user.id
            );

            itemsWithPrice.forEach(item => {
                const product = db.prepare(`
                    SELECT id, stock FROM products WHERE name = ?
                `).get(item.name);

                if (product) {
                    db.prepare(`
                        UPDATE products
                        SET stock = stock + ?, cost_price = ?
                        WHERE id = ?
                    `).run(item.qty, item.price, product.id);
                } else {
                    const newProduct = db.prepare(`
                        INSERT INTO products (name, unit, sale_price, cost_price, stock)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        item.name,
                        item.unit || 'قطعة',
                        item.price * 1.2,
                        item.price,
                        item.qty
                    );
                }
            });

            try {
                db.prepare(`
                    INSERT INTO audit_logs (action, entity_type, entity_id, details)
                    VALUES (?, ?, ?, ?)
                `).run(
                    "purchase",
                    "purchase_invoice",
                    Number(result.lastInsertRowid),
                    safeJson({
                        inv_no: invNo,
                        supplier,
                        total,
                        user_id: req.user.id,
                        username: req.user.username
                    })
                );
            } catch (auditError) {
                console.error("PURCHASE AUDIT ERROR:", auditError);
            }

            res.json({
                success: true,
                message: "تم إنشاء فاتورة الشراء بنجاح",
                invoice: {
                    id: result.lastInsertRowid,
                    inv_no: invNo,
                    total,
                    items: itemsWithPrice
                }
            });
        } catch (error) {
            console.error("PURCHASE ERROR:", error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

app.get(
    "/api/purchases",
    authenticate,
    (req, res) => {
        try {
            const invoices = db.prepare(`
                SELECT
                    p.*,
                    s.name AS supplier_name,
                    u.name AS created_by_name
                FROM purchase_invoices p
                LEFT JOIN suppliers s ON s.id = p.supplier_id
                LEFT JOIN users u ON u.id = p.created_by
                ORDER BY p.id DESC
                LIMIT 100
            `).all();

            res.json({
                success: true,
                invoices
            });
        } catch (error) {
            console.error("PURCHASES LIST ERROR:", error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

app.get(
    "/api/purchases/:id",
    authenticate,
    (req, res) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    error: "معرف الفاتورة غير صحيح"
                });
            }

            const invoice = db.prepare(`
                SELECT
                    p.*,
                    s.name AS supplier_name,
                    u.name AS created_by_name
                FROM purchase_invoices p
                LEFT JOIN suppliers s ON s.id = p.supplier_id
                LEFT JOIN users u ON u.id = p.created_by
                WHERE p.id = ?
            `).get(id);

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: "الفاتورة غير موجودة"
                });
            }

            let items = [];
            try {
                items = JSON.parse(invoice.items_json || '[]');
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
        } catch (error) {
            console.error("PURCHASE DETAIL ERROR:", error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| PRODUCT ROUTES
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
                    ORDER BY name ASC
                `).all();

            res.json({

                success: true,

                products

            });

        }
        catch (error) {

            console.error(
                "PRODUCTS ERROR:",
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


app.post(
    "/api/products",
    authenticate,
    authorize('create_product'),
    validate(schemas.product),
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

            if (stock < 0) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "المخزون لا يمكن أن يكون سالباً"

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

                    name,
                    unit,
                    salePrice,
                    costPrice,
                    stock

                );

            const product =
                db.prepare(`
                    SELECT *
                    FROM products
                    WHERE id = ?
                `).get(
                    Number(
                        result.lastInsertRowid
                    )
                );

            if (stock > 0) {

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
                        result.lastInsertRowid
                    ),

                    stock,

                    "opening",

                    "product",

                    Number(
                        result.lastInsertRowid
                    )

                );

            }

            res.json({

                success: true,

                message:
                    "تم إنشاء الصنف بنجاح",

                product

            });

        }
        catch (error) {

            console.error(
                "CREATE PRODUCT ERROR:",
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


app.post(
    "/api/products/:id/stock",
    authenticate,
    authorize('create_product'),
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
                !Number.isInteger(id) ||
                id <= 0
            ) {

                throw new Error(
                    "معرف الصنف غير صحيح"
                );

            }

            if (
                !Number.isFinite(quantity) ||
                quantity === 0
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

            const newStock =
                Number(product.stock) +
                quantity;

            if (newStock < 0) {

                throw new Error(
                    "لا يمكن أن يصبح المخزون سالباً"
                );

            }

            db.transaction(() => {

                db.prepare(`
                    UPDATE products

                    SET stock =
                        stock + ?

                    WHERE id = ?
                `).run(

                    quantity,
                    id

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

                    id,

                    quantity,

                    quantity > 0
                        ? "purchase"
                        : "adjustment",

                    "manual",

                    null

                );

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

                    "stock_adjustment",

                    "product",

                    id,

                    safeJson({

                        product:
                            product.name,

                        quantity,

                        old_stock:
                            Number(
                                product.stock
                            ),

                        new_stock:
                            newStock,

                        user_id:
                            req.user
                                ? req.user.id
                                : null

                    })

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

                message:
                    "تم تحديث المخزون",

                product:
                    updated

            });

        }
        catch (error) {

            console.error(
                "STOCK ADJUSTMENT ERROR:",
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
| REPORTS - NEW
|--------------------------------------------------------------------------
*/

app.get(
    "/api/reports/sales",
    authenticate,
    authorize('view_reports'),
    (req, res) => {
        try {
            const { start_date, end_date, period } = req.query;

            let dateFormat = '%Y-%m-%d';
            let groupBy = 'day';

            if (period === 'month') {
                dateFormat = '%Y-%m';
                groupBy = 'month';
            } else if (period === 'year') {
                dateFormat = '%Y';
                groupBy = 'year';
            }

            let query = `
                SELECT
                    strftime('${dateFormat}', created_at) as date,
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total,
                    COALESCE(SUM(paid), 0) as paid,
                    COALESCE(SUM(total - paid), 0) as balance
                FROM invoices
                WHERE status != 'cancelled'
            `;

            const params = [];
            if (start_date) {
                query += ` AND DATE(created_at) >= ?`;
                params.push(start_date);
            }
            if (end_date) {
                query += ` AND DATE(created_at) <= ?`;
                params.push(end_date);
            }

            query += ` GROUP BY date ORDER BY date DESC LIMIT 100`;

            const sales = db.prepare(query).all(...params);

            let totalsQuery = `
                SELECT
                    COALESCE(SUM(total), 0) as total,
                    COALESCE(SUM(paid), 0) as paid,
                    COALESCE(SUM(total - paid), 0) as balance,
                    COUNT(*) as count
                FROM invoices
                WHERE status != 'cancelled'
            `;

            const totals = db.prepare(totalsQuery).get();

            res.json({
                success: true,
                sales,
                totals,
                period: groupBy,
                start_date: start_date || null,
                end_date: end_date || null
            });
        } catch (error) {
            console.error("SALES REPORT ERROR:", error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

app.get(
    "/api/reports/customer-balances",
    authenticate,
    authorize('view_reports'),
    (req, res) => {
        try {
            const customers = db.prepare(`
                SELECT
                    c.id,
                    c.name,
                    c.phone,
                    COUNT(i.id) as invoice_count,
                    COALESCE(SUM(i.total), 0) as total_sales,
                    COALESCE(SUM(i.paid), 0) as total_paid,
                    COALESCE(SUM(i.total - i.paid), 0) as balance
                FROM customers c
                LEFT JOIN invoices i ON i.customer_id = c.id AND i.status != 'cancelled'
                GROUP BY c.id
                HAVING balance > 0 OR total_sales > 0
                ORDER BY balance DESC
            `).all();

            const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);

            res.json({
                success: true,
                customers,
                totalBalance,
                count: customers.length
            });
        } catch (error) {
            console.error("CUSTOMER BALANCES ERROR:", error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

app.get(
    "/api/reports/top-products",
    authenticate,
    authorize('view_reports'),
    (req, res) => {
        try {
            const limit = Math.min(Number(req.query.limit) || 10, 50);

            const invoices = db.prepare(`
                SELECT items_json
                FROM invoices
                WHERE status != 'cancelled'
                AND items_json IS NOT NULL
                ORDER BY id DESC
                LIMIT 1000
            `).all();

            const productSales = {};

            invoices.forEach(inv => {
                try {
                    const items = JSON.parse(inv.items_json || '[]');
                    items.forEach(item => {
                        const name = item.name || 'غير معروف';
                        const qty = Number(item.qty) || 0;
                        const price = Number(item.price) || 0;

                        if (!productSales[name]) {
                            productSales[name] = { name, quantity: 0, revenue: 0 };
                        }
                        productSales[name].quantity += qty;
                        productSales[name].revenue += (qty * price);
                    });
                } catch {
                    // تجاهل
                }
            });

            const sorted = Object.values(productSales)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, limit);

            res.json({
                success: true,
                products: sorted,
                total_products: Object.keys(productSales).length
            });
        } catch (error) {
            console.error("TOP PRODUCTS ERROR:", error);
            res.status(500).json({
                success: false,
                error: error.message
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
                    SELECT
                        COUNT(*) AS n
                    FROM customers
                `)
                .get()
                .n;

            const products =
                db.prepare(`
                    SELECT
                        COUNT(*) AS n
                    FROM products
                `)
                .get()
                .n;

            const invoices =
                db.prepare(`
                    SELECT
                        COUNT(*) AS n

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
                    Number(
                        receivables
                    ),

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

                    (
                        result,
                        row
                    ) => {

                        result.debit +=
                            Number(
                                row.debit
                            );

                        result.credit +=
                            Number(
                                row.credit
                            );

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

            res.json({

                success: true,

                revenue:
                    Number(sales),

                cost_of_goods_sold:
                    0,

                gross_profit:
                    Number(sales),

                note:
                    "محرك تكلفة المخزون FIFO / Average Cost سيتم تفعيله في المرحلة التالية"

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

        try {

            if (!req.file) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "ملف كشف البنك مطلوب"

                    });

            }

            res.json({

                success: true,

                message:
                    "تم استلام كشف البنك",

                file: {

                    original_name:
                        req.file.originalname,

                    path:
                        req.file.path,

                    size:
                        req.file.size

                },

                next_step:
                    "bank_reconciliation"

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
| WHATSAPP ROUTES
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
                `)
                .all();

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
                `)
                .run(

                    name,

                    phone,

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
                    "تم إنشاء حساب WhatsApp"

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


app.post(
    "/api/whatsapp/messages",
    async (req, res) => {

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

            const account =
                db.prepare(`
                    SELECT *
                    FROM whatsapp_accounts
                    WHERE id = ?
                `)
                .get(
                    accountId
                );

            if (!account) {

                throw new Error(
                    "حساب WhatsApp غير موجود"
                );

            }

            const result =
                await Promise.resolve(
                    parseTransaction(
                        body
                    )
                );

            const normalized =
                normalizeTransaction(
                    result
                );

            normalized.original_text =
                normalized.original_text ||
                body;

            const validationErrors =
                validateTransaction(
                    normalized
                );

            normalized.validation_errors =
                validationErrors;

            normalized.ready =
                validationErrors.length === 0;

            const messageResult =
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
                `)
                .run(

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

                messageId:
                    Number(
                        messageResult
                            .lastInsertRowid
                    ),

                parsed:
                    normalized

            });

        }
        catch (error) {

            console.error(
                "WHATSAPP MESSAGE ERROR:",
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
| AUDIT
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
                `)
                .get(
                    key
                );

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
    authenticate,
    authorizeRole(['admin']),
    validate(schemas.settings),
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
                    excluded.value,
                    updated_at =
                    CURRENT_TIMESTAMP
            `)
            .run(

                key,

                String(
                    safeValue
                )

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
| CLEANUP - NEW
|--------------------------------------------------------------------------
*/

// تنظيف الملفات كل ساعة
setInterval(() => {
    cleanupUploads(UPLOADS);
}, 3600000);

// تنظيف الفواتير القديمة كل يوم
setInterval(() => {
    cleanupInvoices(INVOICES);
}, 24 * 3600000);


/*
|--------------------------------------------------------------------------
| 404 - API NOT FOUND
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

        if (
            res.headersSent
        ) {

            return next(
                error
            );

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
| SPA FALLBACK
|--------------------------------------------------------------------------
*/

app.use(
    (req, res, next) => {

        if (
            req.path.startsWith(
                "/api"
            )
        ) {

            return next();

        }

        if (
            req.path.startsWith(
                "/invoices"
            )
        ) {

            return next();

        }

        res.sendFile(
            path.join(
                PUBLIC_DIR,
                "index.html"
            )
        );

    }
);


/*
|--------------------------------------------------------------------------
| START SERVER
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
            "🗄️ Database: SQLite"
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            "========================================"
        );

    }
);
