const db = require("./db");


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function toNumber(value, fallback = 0) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;
}


function cleanString(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const text =
        String(value).trim();

    return text || null;
}


/*
|--------------------------------------------------------------------------
| INVOICE NUMBER
|--------------------------------------------------------------------------
*/

function nextInvoiceNo() {

    const row =
        db.prepare(`
            SELECT COUNT(*) AS n
            FROM invoices
        `).get();

    const number =
        Number(row.n || 0) + 1;

    return `INV-${String(number).padStart(6, "0")}`;
}


/*
|--------------------------------------------------------------------------
| CUSTOMER
|--------------------------------------------------------------------------
*/

function getOrCreateCustomer(
    name,
    phone = null
) {

    name = cleanString(name);

    phone = cleanString(phone);

    if (!name) {

        throw new Error(
            "اسم العميل مطلوب"
        );

    }


    let customer =
        db.prepare(`
            SELECT *
            FROM customers
            WHERE name = ?
        `).get(name);


    if (!customer) {

        const result =
            db.prepare(`
                INSERT INTO customers
                (
                    name,
                    phone
                )
                VALUES (?, ?)
            `)
            .run(
                name,
                phone
            );


        customer =
            db.prepare(`
                SELECT *
                FROM customers
                WHERE id = ?
            `)
            .get(
                result.lastInsertRowid
            );

    }

    else if (
        phone &&
        customer.phone !== phone
    ) {

        db.prepare(`
            UPDATE customers
            SET phone = ?
            WHERE id = ?
        `)
        .run(
            phone,
            customer.id
        );

        customer =
            db.prepare(`
                SELECT *
                FROM customers
                WHERE id = ?
            `)
            .get(
                customer.id
            );

    }


    return customer;
}


/*
|--------------------------------------------------------------------------
| PRODUCT
|--------------------------------------------------------------------------
*/

function getOrCreateProduct(item) {

    const name =
        cleanString(item.name);

    if (!name) {

        throw new Error(
            "اسم الصنف مطلوب"
        );

    }


    const unit =
        cleanString(item.unit) ||
        "قطعة";


    const price =
        toNumber(item.price);


    let product =
        db.prepare(`
            SELECT *
            FROM products
            WHERE name = ?
        `)
        .get(name);


    /*
    |--------------------------------------------------------------------------
    | CREATE PRODUCT
    |--------------------------------------------------------------------------
    */

    if (!product) {

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

                price,

                0,

                0

            );


        product =
            db.prepare(`
                SELECT *
                FROM products
                WHERE id = ?
            `)
            .get(
                result.lastInsertRowid
            );

    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE SELLING PRICE
    |--------------------------------------------------------------------------
    */

    if (
        price > 0 &&
        Number(product.sale_price) !== price
    ) {

        db.prepare(`
            UPDATE products
            SET sale_price = ?
            WHERE id = ?
        `)
        .run(
            price,
            product.id
        );

        product.sale_price =
            price;

    }


    return product;
}


/*
|--------------------------------------------------------------------------
| JOURNAL VALIDATION
|--------------------------------------------------------------------------
*/

function validateJournalLines(lines) {

    if (
        !Array.isArray(lines) ||
        lines.length === 0
    ) {

        throw new Error(
            "القيد المحاسبي فارغ"
        );

    }


    let debit = 0;
    let credit = 0;


    for (const line of lines) {

        const d =
            toNumber(line.debit);

        const c =
            toNumber(line.credit);


        if (
            d < 0 ||
            c < 0
        ) {

            throw new Error(
                "لا يمكن أن تكون قيم القيد سالبة"
            );

        }


        if (
            d > 0 &&
            c > 0
        ) {

            throw new Error(
                "لا يمكن أن يحتوي السطر على مدين ودائن معاً"
            );

        }


        debit += d;

        credit += c;

    }


    if (
        Math.abs(debit - credit) >
        0.001
    ) {

        throw new Error(
            `القيد غير متوازن: المدين ${debit} والدائن ${credit}`
        );

    }


    return {
        debit,
        credit
    };
}


/*
|--------------------------------------------------------------------------
| CREATE JOURNAL
|--------------------------------------------------------------------------
*/

function createJournal(
    description,
    referenceType,
    referenceId,
    lines
) {

    const totals =
        validateJournalLines(
            lines
        );


    const result =
        db.prepare(`
            INSERT INTO journal_entries
            (
                reference_type,
                reference_id,
                description
            )
            VALUES (?, ?, ?)
        `)
        .run(

            referenceType,

            referenceId,

            description

        );


    const journalId =
        Number(
            result.lastInsertRowid
        );


    const insertLine =
        db.prepare(`
            INSERT INTO journal_lines
            (
                journal_id,
                account_code,
                account_name,
                debit,
                credit
            )
            VALUES (?, ?, ?, ?, ?)
        `);


    for (const line of lines) {

        insertLine.run(

            journalId,

            String(
                line.code
            ),

            String(
                line.name
            ),

            toNumber(
                line.debit
            ),

            toNumber(
                line.credit
            )

        );

    }


    return {

        id: journalId,

        debit:
            totals.debit,

        credit:
            totals.credit

    };
}


/*
|--------------------------------------------------------------------------
| STOCK MOVEMENT
|--------------------------------------------------------------------------
*/

function createStockMovement({

    productId,

    quantity,

    movementType,

    referenceType,

    referenceId

}) {

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
    `)
    .run(

        Number(productId),

        toNumber(quantity),

        movementType,

        referenceType,

        referenceId || null

    );

}


/*
|--------------------------------------------------------------------------
| AUDIT
|--------------------------------------------------------------------------
*/

function createAuditLog(
    action,
    entityType,
    entityId,
    details
) {

    db.prepare(`
        INSERT INTO audit_logs
        (
            action,
            entity_type,
            entity_id,
            details
        )
        VALUES (?, ?, ?, ?)
    `)
    .run(

        action,

        entityType,

        entityId,

        JSON.stringify(
            details || {}
        )

    );

}


/*
|--------------------------------------------------------------------------
| CREATE INVOICE
|--------------------------------------------------------------------------
*/

function createInvoice(input) {

    if (!input) {

        throw new Error(
            "بيانات الفاتورة مطلوبة"
        );

    }


    const customerName =
        cleanString(
            input.customer
        );


    if (!customerName) {

        throw new Error(
            "العميل مطلوب"
        );

    }


    if (
        !Array.isArray(input.items) ||
        input.items.length === 0
    ) {

        throw new Error(
            "يجب إضافة صنف واحد على الأقل"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | CUSTOMER
    |--------------------------------------------------------------------------
    */

    const customer =
        getOrCreateCustomer(

            customerName,

            input.customer_phone

        );


    /*
    |--------------------------------------------------------------------------
    | ITEMS
    |--------------------------------------------------------------------------
    */

    const items =
        input.items.map(item => {

            const name =
                cleanString(
                    item.name
                );


            const qty =
                toNumber(
                    item.qty
                );


            const price =
                toNumber(
                    item.price
                );


            const unit =
                cleanString(
                    item.unit
                ) ||
                "قطعة";


            if (!name) {

                throw new Error(
                    "اسم الصنف مطلوب"
                );

            }


            if (
                !Number.isFinite(qty) ||
                qty <= 0
            ) {

                throw new Error(
                    `الكمية غير صحيحة للصنف: ${name}`
                );

            }


            if (
                !Number.isFinite(price) ||
                price < 0
            ) {

                throw new Error(
                    `السعر غير صحيح للصنف: ${name}`
                );

            }


            return {

                name,

                qty,

                price,

                unit

            };

        });


    /*
    |--------------------------------------------------------------------------
    | TOTALS
    |--------------------------------------------------------------------------
    */

    const subtotal =
        items.reduce(

            (sum, item) =>
                sum +
                (
                    item.qty *
                    item.price
                ),

            0

        );


    const discount =
        toNumber(
            input.discount
        );


    const tax =
        toNumber(
            input.tax
        );


    if (discount < 0) {

        throw new Error(
            "الخصم غير صحيح"
        );

    }


    if (tax < 0) {

        throw new Error(
            "الضريبة غير صحيحة"
        );

    }


    if (
        discount > subtotal
    ) {

        throw new Error(
            "الخصم أكبر من قيمة المبيعات"
        );

    }


    const total =
        subtotal -
        discount +
        tax;


    if (total < 0) {

        throw new Error(
            "إجمالي الفاتورة غير صحيح"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | TYPE
    |--------------------------------------------------------------------------
    */

    const type =
        input.type === "credit"
            ? "credit"
            : "cash";


    const dueDate =
        type === "credit"
            ? cleanString(
                input.due_date
            )
            : null;


    /*
    |--------------------------------------------------------------------------
    | INVOICE NUMBER
    |--------------------------------------------------------------------------
    */

    const invNo =
        nextInvoiceNo();


    /*
    |--------------------------------------------------------------------------
    | TRANSACTION
    |--------------------------------------------------------------------------
    */

    const invoiceId =
        db.transaction(() => {

            /*
            --------------------------------------------------------------
            | PRODUCTS FIRST
            --------------------------------------------------------------
            */

            const products = [];


            for (const item of items) {

                const product =
                    getOrCreateProduct(
                        item
                    );


                products.push({

                    item,

                    product

                });

            }


            /*
            --------------------------------------------------------------
            | STOCK VALIDATION
            --------------------------------------------------------------
            */

            const preventNegativeStock =
                process.env.PREVENT_NEGATIVE_STOCK === "true";


            if (
                preventNegativeStock
            ) {

                for (
                    const entry
                    of products
                ) {

                    const stock =
                        toNumber(
                            entry.product.stock
                        );


                    if (
                        stock <
                        entry.item.qty
                    ) {

                        throw new Error(
                            `المخزون غير كاف للصنف ${entry.item.name}. المتاح: ${stock}`
                        );

                    }

                }

            }


            /*
            --------------------------------------------------------------
            | CASH / CREDIT
            --------------------------------------------------------------
            */

            const paid =
                type === "cash"
                    ? total
                    : 0;


            const status =
                type === "cash"
                    ? "paid"
                    : "approved";


            /*
            --------------------------------------------------------------
            | INSERT INVOICE
            --------------------------------------------------------------
            */

            const result =
                db.prepare(`
                    INSERT INTO invoices
                    (
                        inv_no,
                        customer_id,
                        customer_name,
                        type,
                        due_date,
                        subtotal,
                        discount,
                        tax,
                        total,
                        paid,
                        status,
                        items_json
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .run(

                    invNo,

                    customer.id,

                    customer.name,

                    type,

                    dueDate,

                    subtotal,

                    discount,

                    tax,

                    total,

                    paid,

                    status,

                    JSON.stringify(
                        items
                    )

                );


            const id =
                Number(
                    result.lastInsertRowid
                );


            /*
            --------------------------------------------------------------
            | STOCK
            --------------------------------------------------------------
            */

            let totalCost = 0;


            for (
                const entry
                of products
            ) {

                const item =
                    entry.item;


                const product =
                    entry.product;


                const cost =
                    toNumber(
                        product.cost_price
                    );


                const itemCost =
                    item.qty *
                    cost;


                totalCost +=
                    itemCost;


                /*
                خصم المخزون
                */

                db.prepare(`
                    UPDATE products
                    SET stock = stock - ?
                    WHERE id = ?
                `)
                .run(

                    item.qty,

                    product.id

                );


                /*
                حركة مخزون
                */

                createStockMovement({

                    productId:
                        product.id,

                    quantity:
                        -item.qty,

                    movementType:
                        "sale",

                    referenceType:
                        "invoice",

                    referenceId:
                        id

                });

            }


            /*
            --------------------------------------------------------------
            | SALES JOURNAL
            --------------------------------------------------------------
            */

            const salesLines = [];


            if (type === "credit") {

                salesLines.push({

                    code:
                        "1100",

                    name:
                        `العملاء - ${customer.name}`,

                    debit:
                        total,

                    credit:
                        0

                });

            }

            else {

                salesLines.push({

                    code:
                        "1000",

                    name:
                        "الصندوق",

                    debit:
                        total,

                    credit:
                        0

                });

            }


            salesLines.push({

                code:
                    "4100",

                name:
                    "المبيعات",

                debit:
                    0,

                credit:
                    total

            });


            createJournal(

                type === "credit"
                    ? `فاتورة مبيعات آجلة ${invNo}`
                    : `فاتورة مبيعات نقدية ${invNo}`,

                "invoice",

                id,

                salesLines

            );


            /*
            --------------------------------------------------------------
            | COST OF GOODS SOLD
            --------------------------------------------------------------
            |
            | إذا كانت تكلفة الأصناف معروفة، نسجل:
            |
            | مدين  5100 تكلفة المبيعات
            | دائن  1300 المخزون
            |
            --------------------------------------------------------------
            */

            if (
                totalCost > 0
            ) {

                createJournal(

                    `تكلفة المبيعات - ${invNo}`,

                    "cogs",

                    id,

                    [

                        {

                            code:
                                "5100",

                            name:
                                "تكلفة المبيعات",

                            debit:
                                totalCost,

                            credit:
                                0

                        },

                        {

                            code:
                                "1300",

                            name:
                                "المخزون",

                            debit:
                                0,

                            credit:
                                totalCost

                        }

                    ]

                );

            }


            /*
            --------------------------------------------------------------
            | AUDIT
            --------------------------------------------------------------
            */

            createAuditLog(

                "create",

                "invoice",

                id,

                {

                    invoice:
                        invNo,

                    customer:
                        customer.name,

                    type,

                    subtotal,

                    discount,

                    tax,

                    total,

                    paid,

                    cost_of_goods_sold:
                        totalCost

                }

            );


            return id;

        })();


    /*
    |--------------------------------------------------------------------------
    | RETURN CREATED INVOICE
    |--------------------------------------------------------------------------
    */

    return db
        .prepare(`
            SELECT *
            FROM invoices
            WHERE id = ?
        `)
        .get(
            invoiceId
        );

}


/*
|--------------------------------------------------------------------------
| RECORD PAYMENT
|--------------------------------------------------------------------------
*/

function recordPayment({

    invoiceId,

    amount,

    method = "cash",

    reference = null

}) {

    const id =
        Number(invoiceId);


    const value =
        toNumber(amount);


    if (
        !Number.isInteger(id)
    ) {

        throw new Error(
            "رقم الفاتورة غير صحيح"
        );

    }


    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {

        throw new Error(
            "قيمة السداد غير صحيحة"
        );

    }


    const invoice =
        db.prepare(`
            SELECT *
            FROM invoices
            WHERE id = ?
        `)
        .get(id);


    if (!invoice) {

        throw new Error(
            "الفاتورة غير موجودة"
        );

    }


    if (
        invoice.status ===
        "cancelled"
    ) {

        throw new Error(
            "لا يمكن سداد فاتورة ملغاة"
        );

    }


    const remaining =
        Math.max(

            0,

            toNumber(invoice.total) -
            toNumber(invoice.paid)

        );


    if (
        value > remaining + 0.001
    ) {

        throw new Error(
            `مبلغ السداد أكبر من المتبقي. المتبقي: ${remaining}`
        );

    }


    const paymentMethod =
        cleanString(method) ||
        "cash";


    const paymentReference =
        cleanString(reference);


    db.transaction(() => {

        /*
        --------------------------------------------------------------
        | PAYMENT
        --------------------------------------------------------------
        */

        db.prepare(`
            INSERT INTO payments
            (
                customer_id,
                invoice_id,
                amount,
                method,
                reference
            )
            VALUES (?, ?, ?, ?, ?)
        `)
        .run(

            invoice.customer_id,

            id,

            value,

            paymentMethod,

            paymentReference

        );


        /*
        --------------------------------------------------------------
        | UPDATE INVOICE
        --------------------------------------------------------------
        */

        const newPaid =
            toNumber(invoice.paid) +
            value;


        const newStatus =
            newPaid >=
            toNumber(invoice.total) - 0.001
                ? "paid"
                : "partially_paid";


        db.prepare(`
            UPDATE invoices
            SET
                paid = ?,
                status = ?
            WHERE id = ?
        `)
        .run(

            newPaid,

            newStatus,

            id

        );


        /*
        --------------------------------------------------------------
        | CASH / BANK
        --------------------------------------------------------------
        */

        let accountCode =
            "1000";


        let accountName =
            "الصندوق";


        if (
            paymentMethod === "bank"
        ) {

            accountCode =
                "1200";

            accountName =
                "البنك";

        }


        /*
        --------------------------------------------------------------
        | PAYMENT JOURNAL
        --------------------------------------------------------------
        */

        createJournal(

            `سداد فاتورة ${invoice.inv_no}`,

            "payment",

            id,

            [

                {

                    code:
                        accountCode,

                    name:
                        accountName,

                    debit:
                        value,

                    credit:
                        0

                },

                {

                    code:
                        "1100",

                    name:
                        `العملاء - ${invoice.customer_name}`,

                    debit:
                        0,

                    credit:
                        value

                }

            ]

        );


        /*
        --------------------------------------------------------------
        | AUDIT
        --------------------------------------------------------------
        */

        createAuditLog(

            "payment",

            "invoice",

            id,

            {

                invoice:
                    invoice.inv_no,

                amount:
                    value,

                method:
                    paymentMethod,

                reference:
                    paymentReference,

                previous_paid:
                    invoice.paid,

                new_paid:
                    newPaid,

                remaining:
                    Math.max(
                        0,
                        toNumber(
                            invoice.total
                        ) -
                        newPaid
                    )

            }

        );

    })();


    return db
        .prepare(`
            SELECT *
            FROM invoices
            WHERE id = ?
        `)
        .get(id);

}


/*
|--------------------------------------------------------------------------
| CUSTOMER STATEMENT
|--------------------------------------------------------------------------
*/

function customerStatement(name) {

    const customerName =
        cleanString(name);


    if (!customerName) {

        throw new Error(
            "اسم العميل مطلوب"
        );

    }


    const customer =
        db.prepare(`
            SELECT *
            FROM customers
            WHERE name = ?
        `)
        .get(
            customerName
        );


    if (!customer) {

        return {

            customer:
                null,

            invoices:
                [],

            payments:
                [],

            balance:
                0,

            totals: {

                sales:
                    0,

                paid:
                    0,

                remaining:
                    0

            }

        };

    }


    /*
    |--------------------------------------------------------------------------
    | INVOICES
    |--------------------------------------------------------------------------
    */

    const invoices =
        db.prepare(`
            SELECT
                id,
                inv_no,
                type,
                due_date,
                subtotal,
                discount,
                tax,
                total,
                paid,
                (total - paid) AS remaining,
                status,
                created_at
            FROM invoices
            WHERE
                customer_id = ?
            AND
                status != 'cancelled'
            ORDER BY
                id DESC
        `)
        .all(
            customer.id
        );


    /*
    |--------------------------------------------------------------------------
    | PAYMENTS
    |--------------------------------------------------------------------------
    */

    const payments =
        db.prepare(`
            SELECT
                id,
                invoice_id,
                amount,
                method,
                reference,
                payment_date
            FROM payments
            WHERE
                customer_id = ?
            ORDER BY
                id DESC
        `)
        .all(
            customer.id
        );


    /*
    |--------------------------------------------------------------------------
    | TOTALS
    |--------------------------------------------------------------------------
    */

    const totals =
        invoices.reduce(

            (result, invoice) => {

                result.sales +=
                    toNumber(
                        invoice.total
                    );

                result.paid +=
                    toNumber(
                        invoice.paid
                    );

                result.remaining +=
                    Math.max(
                        0,
                        toNumber(
                            invoice.total
                        ) -
                        toNumber(
                            invoice.paid
                        )
                    );

                return result;

            },

            {

                sales:
                    0,

                paid:
                    0,

                remaining:
                    0

            }

        );


    return {

        customer,

        invoices,

        payments,

        balance:
            totals.remaining,

        totals

    };

}


/*
|--------------------------------------------------------------------------
| GET CUSTOMER BALANCE
|--------------------------------------------------------------------------
*/

function getCustomerBalance(
    customerId
) {

    const row =
        db.prepare(`
            SELECT
                COALESCE(
                    SUM(
                        total - paid
                    ),
                    0
                ) AS balance
            FROM invoices
            WHERE
                customer_id = ?
            AND
                status != 'cancelled'
        `)
        .get(
            Number(customerId)
        );


    return toNumber(
        row.balance
    );

}


/*
|--------------------------------------------------------------------------
| GET INVOICE
|--------------------------------------------------------------------------
*/

function getInvoiceById(id) {

    const invoice =
        db.prepare(`
            SELECT *
            FROM invoices
            WHERE id = ?
        `)
        .get(
            Number(id)
        );


    if (!invoice) {

        return null;

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


    return {

        ...invoice,

        items

    };

}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    createInvoice,

    recordPayment,

    customerStatement,

    getOrCreateCustomer,

    getOrCreateProduct,

    createJournal,

    getCustomerBalance,

    getInvoiceById

};
