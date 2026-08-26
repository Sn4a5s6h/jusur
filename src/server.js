require("dotenv").config();

const express =
    require("express");

const cors =
    require("cors");

const multer =
    require("multer");

const fs =
    require("fs");

const path =
    require("path");


const db =
    require("./db");


const {
    parseTransaction
} =
    require("./ai/engine");


const {
    createInvoice,
    recordPayment,
    customerStatement
} =
    require("./accounting");


const {
    generateInvoicePDF
} =
    require("./pdf");


const app =
    express();


const PORT =
    process.env.PORT || 3001;


const ROOT =
    path.join(
        __dirname,
        ".."
    );


const UPLOADS =
    path.join(
        ROOT,
        "uploads"
    );


const INVOICES =
    path.join(
        ROOT,
        "invoices"
    );


fs.mkdirSync(
    UPLOADS,
    {
        recursive: true
    }
);


fs.mkdirSync(
    INVOICES,
    {
        recursive: true
    }
);


app.use(cors());


app.use(
    express.json({
        limit: "5mb"
    })
);


app.use(
    express.urlencoded({
        extended: true
    })
);


app.use(
    express.static(
        path.join(
            ROOT,
            "public"
        )
    )
);


app.use(
    "/invoices",
    express.static(
        INVOICES
    )
);


const upload =
    multer({
        dest: UPLOADS
    });


/* HEALTH */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            name:
                "Jusoor Accounting",

            version:
                "2.0.0",

            status:
                "running"

        });

    }
);


/* AI PARSE */

app.post(
    "/api/ai/parse",
    (req, res) => {

        try {

            const text =
                req.body.text;


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
                parseTransaction(text);


            res.json({

                success: true,

                parsed

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


/* COMMIT TRANSACTION */

app.post(
    "/api/transactions/commit",
    async (req, res) => {

        try {

            const parsed =
                req.body.parsed;


            if (!parsed) {

                return res
                    .status(400)
                    .json({

                        error:
                            "بيانات العملية مطلوبة"

                    });

            }


            if (
                parsed.intent !==
                "sales_invoice"
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "نوع العملية غير مدعوم حاليًا"

                    });

            }


            if (!parsed.ready) {

                return res
                    .status(400)
                    .json({

                        error:
                            "المعاملة غير مكتملة"

                    });

            }


            let dueDate =
                parsed.due_date ||
                null;


            if (
                !dueDate &&
                parsed.due_days
            ) {

                const date =
                    new Date();


                date.setDate(

                    date.getDate() +
                    Number(
                        parsed.due_days
                    )

                );


                dueDate =
                    date
                        .toISOString()
                        .slice(0, 10);

            }


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
                pdfPath,
                invoice.id
            );


            const publicPath =
                `/invoices/${invoice.inv_no}.pdf`;


            res.json({

                success: true,

                message:
                    "تم إنشاء الفاتورة بنجاح",

                invoice: {

                    ...invoice,

                    pdf_url:
                        publicPath

                }

            });

        }

        catch (error) {

            console.error(error);

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


/* PAYMENTS */

app.post(
    "/api/payments",
    (req, res) => {

        try {

            const invoice =
                recordPayment(
                    req.body
                );


            res.json({

                success: true,

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


/* CUSTOMER STATEMENT */

app.get(
    "/api/customer/:name",
    (req, res) => {

        try {

            const result =
                customerStatement(
                    req.params.name
                );


            res.json(result);

        }

        catch (error) {

            res
                .status(500)
                .json({

                    error:
                        error.message

                });

        }

    }
);


/* INVOICES */

app.get(
    "/api/invoices",
    (req, res) => {

        const invoices =
            db.prepare(`
                SELECT *
                FROM invoices
                ORDER BY id DESC
                LIMIT 500
            `).all();


        res.json({

            success: true,

            invoices

        });

    }
);


/* CUSTOMERS */

app.get(
    "/api/customers",
    (req, res) => {

        const customers =
            db.prepare(`
                SELECT *
                FROM customers
                ORDER BY name
            `).all();


        res.json({

            success: true,

            customers

        });

    }
);


/* PRODUCTS */

app.get(
    "/api/products",
    (req, res) => {

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
);


app.post(
    "/api/products",
    (req, res) => {

        try {

            const {

                name,

                unit = "قطعة",

                sale_price = 0,

                cost_price = 0,

                stock = 0

            } =
                req.body;


            if (!name) {

                return res
                    .status(400)
                    .json({

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
                `)
                .run(

                    name,

                    unit,

                    sale_price,

                    cost_price,

                    stock

                );


            res.json({

                success: true,

                id:
                    result.lastInsertRowid

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


/* DASHBOARD */

app.get(
    "/api/dashboard",
    (req, res) => {

        const sales =
            db.prepare(`
                SELECT
                    COALESCE(
                        SUM(total),
                        0
                    ) AS total
                FROM invoices
                WHERE status != 'draft'
            `)
            .get()
            .total;


        const receivables =
            db.prepare(`
                SELECT
                    COALESCE(
                        SUM(total - paid),
                        0
                    ) AS total
                FROM invoices
                WHERE type = 'credit'
                AND status != 'paid'
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
            `)
            .get()
            .n;


        res.json({

            success: true,

            sales,

            receivables,

            customers,

            products,

            invoices

        });

    }
);


/* BANK CSV */

app.post(
    "/api/upload-bank",
    upload.single("file"),
    (req, res) => {

        if (!req.file) {

            return res
                .status(400)
                .json({

                    error:
                        "ملف كشف البنك مطلوب"

                });

        }


        /*
          هذه مرحلة الاستقبال فقط.
          المطابقة النهائية يجب ألا تعتمد
          على المبلغ وحده.
        */


        fs.unlink(
            req.file.path,
            () => {}
        );


        res.json({

            success: true,

            message:
                "تم استلام كشف البنك. سيتم ربط محرك المطابقة الذكية بالمبلغ والمرجع والعميل والتاريخ."

        });

    }
);


/* WHATSAPP ACCOUNTS */

app.get(
    "/api/whatsapp/accounts",
    (req, res) => {

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
);


app.post(
    "/api/whatsapp/accounts",
    (req, res) => {

        const {

            name,

            phone

        } =
            req.body;


        const result =
            db.prepare(`
                INSERT INTO whatsapp_accounts
                (name, phone)
                VALUES (?, ?)
            `)
            .run(
                name || "WhatsApp",

                phone || null
            );


        res.json({

            success: true,

            accountId:
                result.lastInsertRowid,

            status:
                "disconnected"

        });

    }
);


/*
  IMPORTANT:
  لا نضع هنا QR أو جلسة WhatsApp
  بشكل تجريبي داخل المحرك المحاسبي.
  سنضيف WhatsApp Gateway كطبقة مستقلة.
*/


/* JOURNAL */

app.get(
    "/api/journal",
    (req, res) => {

        const entries =
            db.prepare(`
                SELECT
                    je.id,
                    je.reference_type,
                    je.reference_id,
                    je.description,
                    je.entry_date,
                    jl.account_code,
                    jl.account_name,
                    jl.debit,
                    jl.credit
                FROM journal_entries je
                JOIN journal_lines jl
                    ON jl.journal_id = je.id
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
);


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
    (req, res) => {

        res.sendFile(
            path.join(
                ROOT,
                "public",
                "index.html"
            )
        );

    }
);


app.listen(
    PORT,
    () => {

        console.log(
            `🌉 Jusoor Accounting running on port ${PORT}`
        );

    }
);
