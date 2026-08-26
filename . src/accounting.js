const db = require("./db");

function nextInvoiceNo() {

    const row = db
        .prepare(`
            SELECT COUNT(*) AS n
            FROM invoices
        `)
        .get();

    return `INV-${String(row.n + 1).padStart(6, "0")}`;
}


function getOrCreateCustomer(name, phone = null) {

    if (!name) {
        throw new Error("اسم العميل مطلوب");
    }

    let customer = db
        .prepare(`
            SELECT *
            FROM customers
            WHERE name = ?
        `)
        .get(name);

    if (!customer) {

        const result = db
            .prepare(`
                INSERT INTO customers
                (name, phone)
                VALUES (?, ?)
            `)
            .run(name, phone);

        customer = db
            .prepare(`
                SELECT *
                FROM customers
                WHERE id = ?
            `)
            .get(result.lastInsertRowid);

    } else if (phone && customer.phone !== phone) {

        db.prepare(`
            UPDATE customers
            SET phone = ?
            WHERE id = ?
        `).run(phone, customer.id);

    }

    return customer;
}


function getOrCreateProduct(item) {

    if (!item.name) {
        throw new Error("اسم الصنف مطلوب");
    }

    let product = db
        .prepare(`
            SELECT *
            FROM products
            WHERE name = ?
        `)
        .get(item.name);

    if (!product) {

        const result = db
            .prepare(`
                INSERT INTO products
                (
                    name,
                    unit,
                    sale_price,
                    cost_price,
                    stock
                )
                VALUES (?, ?, ?, ?, 0)
            `)
            .run(
                item.name,
                item.unit || "قطعة",
                Number(item.price) || 0,
                0
            );

        product = db
            .prepare(`
                SELECT *
                FROM products
                WHERE id = ?
            `)
            .get(result.lastInsertRowid);

    } else {

        if (
            item.price !== undefined &&
            Number(item.price) > 0
        ) {

            db.prepare(`
                UPDATE products
                SET sale_price = ?
                WHERE id = ?
            `).run(
                Number(item.price),
                product.id
            );

        }

    }

    return product;
}


function createJournal(
    description,
    referenceType,
    referenceId,
    lines
) {

    const result = db
        .prepare(`
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

    const journalId = result.lastInsertRowid;

    const statement = db.prepare(`
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

        statement.run(
            journalId,
            line.code,
            line.name,
            Number(line.debit) || 0,
            Number(line.credit) || 0
        );

    }

    return journalId;
}


function createInvoice(input) {

    if (!input.customer) {
        throw new Error("العميل مطلوب");
    }

    if (!Array.isArray(input.items) || !input.items.length) {
        throw new Error("يجب إضافة صنف واحد على الأقل");
    }

    const customer = getOrCreateCustomer(
        input.customer,
        input.customer_phone
    );

    const items = input.items.map(item => ({

        name: item.name,

        qty: Number(item.qty),

        price: Number(item.price),

        unit: item.unit || "قطعة"

    }));

    for (const item of items) {

        if (item.qty <= 0) {
            throw new Error(
                `الكمية غير صحيحة للصنف ${item.name}`
            );
        }

        if (item.price < 0) {
            throw new Error(
                `السعر غير صحيح للصنف ${item.name}`
            );
        }

    }

    const subtotal = items.reduce(
        (sum, item) =>
            sum + item.qty * item.price,
        0
    );

    const discount =
        Number(input.discount) || 0;

    const tax =
        Number(input.tax) || 0;

    const total =
        subtotal - discount + tax;

    const invNo = nextInvoiceNo();

    const transaction = db.transaction(() => {

        const result = db
            .prepare(`
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

                input.type || "cash",

                input.due_date || null,

                subtotal,

                discount,

                tax,

                total,

                0,

                "approved",

                JSON.stringify(items)

            );

        const invoiceId =
            result.lastInsertRowid;


        for (const item of items) {

            const product =
                getOrCreateProduct(item);

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

                product.id,

                -item.qty,

                "sale",

                "invoice",

                invoiceId

            );


            db.prepare(`
                UPDATE products
                SET stock = stock - ?
                WHERE id = ?
            `).run(
                item.qty,
                product.id
            );

        }


        if (input.type === "credit") {

            createJournal(

                `فاتورة مبيعات ${invNo}`,

                "invoice",

                invoiceId,

                [

                    {

                        code: "1100",

                        name:
                            `العملاء - ${customer.name}`,

                        debit: total

                    },

                    {

                        code: "4100",

                        name: "المبيعات",

                        credit: total

                    }

                ]

            );

        } else {

            createJournal(

                `فاتورة نقدية ${invNo}`,

                "invoice",

                invoiceId,

                [

                    {

                        code: "1000",

                        name: "الصندوق",

                        debit: total

                    },

                    {

                        code: "4100",

                        name: "المبيعات",

                        credit: total

                    }

                ]

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

            "create",

            "invoice",

            invoiceId,

            JSON.stringify({

                invNo,

                total,

                customer: customer.name

            })

        );


        return invoiceId;

    });


    const invoice =
        db.prepare(`
            SELECT *
            FROM invoices
            WHERE id = ?
        `).get(transaction);

    return invoice;
}


function recordPayment({

    invoiceId,

    amount,

    method = "cash",

    reference = null

}) {

    const invoice =
        db.prepare(`
            SELECT *
            FROM invoices
            WHERE id = ?
        `)
        .get(invoiceId);

    if (!invoice) {
        throw new Error("الفاتورة غير موجودة");
    }


    const remaining =
        invoice.total - invoice.paid;

    const value = Number(amount);


    if (
        !Number.isFinite(value) ||
        value <= 0 ||
        value > remaining
    ) {

        throw new Error(
            "قيمة السداد غير صالحة"
        );

    }


    const transaction =
        db.transaction(() => {

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
            `).run(

                invoice.customer_id,

                invoiceId,

                value,

                method,

                reference

            );


            const newPaid =
                invoice.paid + value;


            const status =
                newPaid >= invoice.total
                    ? "paid"
                    : "partially_paid";


            db.prepare(`
                UPDATE invoices
                SET paid = ?,
                    status = ?
                WHERE id = ?
            `).run(

                newPaid,

                status,

                invoiceId

            );


            const accountCode =
                method === "bank"
                    ? "1200"
                    : "1000";


            const accountName =
                method === "bank"
                    ? "البنك"
                    : "الصندوق";


            createJournal(

                `سداد فاتورة ${invoice.inv_no}`,

                "payment",

                invoiceId,

                [

                    {

                        code: accountCode,

                        name: accountName,

                        debit: value

                    },

                    {

                        code: "1100",

                        name:
                            `العملاء - ${invoice.customer_name}`,

                        credit: value

                    }

                ]

            );

        });


    return db
        .prepare(`
            SELECT *
            FROM invoices
            WHERE id = ?
        `)
        .get(invoiceId);
}


function customerStatement(name) {

    const customer =
        db.prepare(`
            SELECT *
            FROM customers
            WHERE name = ?
        `)
        .get(name);


    if (!customer) {

        return {

            customer: null,

            invoices: [],

            payments: [],

            balance: 0

        };

    }


    const invoices =
        db.prepare(`
            SELECT
                id,
                inv_no,
                type,
                due_date,
                total,
                paid,
                (total - paid) AS remaining,
                status,
                created_at
            FROM invoices
            WHERE customer_id = ?
            ORDER BY id DESC
        `)
        .all(customer.id);


    const payments =
        db.prepare(`
            SELECT *
            FROM payments
            WHERE customer_id = ?
            ORDER BY id DESC
        `)
        .all(customer.id);


    const balance =
        invoices.reduce(
            (sum, invoice) =>
                sum + invoice.remaining,
            0
        );


    return {

        customer,

        invoices,

        payments,

        balance

    };

}


module.exports = {

    createInvoice,

    recordPayment,

    customerStatement,

    getOrCreateCustomer,

    getOrCreateProduct

};
