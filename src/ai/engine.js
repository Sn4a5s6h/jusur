"use strict";

const {
    normalizeText,
    detectSignals,
    extractNumbers
} = require("./normalizer");


/*
========================================
JUSOOR ACCOUNTING AI ENGINE
المرحلة الأولى من محرك الفهم المحاسبي
========================================
*/


/* ================================
   Helpers
================================ */

function cleanName(value) {

    if (!value) return null;

    return String(value)
        .replace(
            /^(العميل|عميل|للعميل|لدى العميل|المورد|مورد)\s+/i,
            ""
        )
        .trim();

}


function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const n =
        Number(
            String(value)
                .replace(/[,،]/g, "")
                .trim()
        );

    return Number.isFinite(n)
        ? n
        : null;

}


/* ================================
   Detect Intent
================================ */

function detectIntent(text) {

    const t =
        normalizeText(text);


    /*
     * الاستعلامات
     */

    if (
        /كشف حساب|رصيد العميل|كم باقي|كم عليه|المتبقي|المستحق|ذمم/i
            .test(t)
    ) {

        return "customer_statement";

    }


    if (
        /كم مبيعات|مبيعات اليوم|اجمالي المبيعات|إجمالي المبيعات/i
            .test(t)
    ) {

        return "sales_report";

    }


    if (
        /من عليه|العملاء المتأخرين|ديون العملاء|الديون المستحقة/i
            .test(t)
    ) {

        return "receivables_report";

    }


    /*
     * سداد
     */

    if (
        /سدد|سددت|دفع|دفعت|حول|حولت|استلمت|استلم/i
            .test(t)
    ) {

        return "payment";

    }


    /*
     * مشتريات
     */

    if (
        /مشتريات|شراء|اشتريت|اشترينا|من المورد/i
            .test(t)
    ) {

        return "purchase_invoice";

    }


    /*
     * مبيعات
     */

    if (
        /فاتورة|بيع|مبيعات|بعت|بعنا|للعميل/i
            .test(t)
    ) {

        return "sales_invoice";

    }


    return "unknown";

}


/* ================================
   Detect Customer
================================ */

function extractCustomer(text) {

    const t =
        normalizeText(text);


    const patterns = [

        /للعميل\s+(.+?)(?=\s+(?:بـ|ب|بسعر|سعر|اجل|آجل|نقدي|لمدة|بمبلغ|بقيمة)|$)/i,

        /العميل\s+(.+?)(?=\s+(?:بـ|ب|بسعر|سعر|اجل|آجل|نقدي|لمدة|بمبلغ|بقيمة)|$)/i,

        /على\s+(.+?)(?=\s+(?:لمدة|بمبلغ|بقيمة|اجل|آجل|نقدي)|$)/i,

        /من\s+(.+?)(?=\s+(?:المورد|بمبلغ|بقيمة)|$)/i

    ];


    for (const pattern of patterns) {

        const match =
            t.match(pattern);

        if (match && match[1]) {

            return cleanName(
                match[1]
            );

        }

    }


    return null;

}


/* ================================
   Detect Supplier
================================ */

function extractSupplier(text) {

    const t =
        normalizeText(text);


    const patterns = [

        /من المورد\s+(.+?)(?=\s+(?:بـ|ب|بسعر|سعر|بمبلغ|بقيمة)|$)/i,

        /المورد\s+(.+?)(?=\s+(?:بـ|ب|بسعر|سعر|بمبلغ|بقيمة)|$)/i

    ];


    for (const pattern of patterns) {

        const match =
            t.match(pattern);

        if (match && match[1]) {

            return cleanName(
                match[1]
            );

        }

    }


    return null;

}


/* ================================
   Detect Payment Type
================================ */

function detectPaymentType(text) {

    const signals =
        detectSignals(text);


    if (signals.isFree) {

        return "free";

    }


    if (signals.isCredit) {

        return "credit";

    }


    if (signals.isCash) {

        return "cash";

    }


    return "cash";

}


/* ================================
   Detect Due Days
================================ */

function extractDueDays(text) {

    const t =
        normalizeText(text);


    const match =
        t.match(
            /(?:لمدة|بعد|خلال)\s*(\d+)\s*(?:يوم|ايام|أيام)/i
        );


    if (match) {

        return Number(
            match[1]
        );

    }


    if (
        /30\s*يوم/i.test(t)
    ) {

        return 30;

    }


    if (
        /60\s*يوم/i.test(t)
    ) {

        return 60;

    }


    if (
        /90\s*يوم/i.test(t)
    ) {

        return 90;

    }


    return null;

}


/* ================================
   Detect Amount
================================ */

function extractAmount(text) {

    const t =
        normalizeText(text);


    const patterns = [

        /(?:بمبلغ|بقيمة|مبلغ)\s*(\d+(?:\.\d+)?)/i,

        /(?:سدد|دفع|دفعت|حول|حولت|استلمت)\s*(\d+(?:\.\d+)?)/i,

        /(\d+(?:\.\d+)?)\s*(?:ريال|دولار)/i

    ];


    for (const pattern of patterns) {

        const match =
            t.match(pattern);

        if (match) {

            return toNumber(
                match[1]
            );

        }

    }


    return null;

}


/* ================================
   Detect Items
================================ */

function extractItems(text) {

    const t =
        normalizeText(text);


    /*
     * مثال:
     * 50 كرتون زيت سعر 500
     */

    const pattern =
        /(\d+(?:\.\d+)?)\s+([^\d]+?)\s+(?:سعر|بسعر)\s*(\d+(?:\.\d+)?)/i;


    const match =
        t.match(pattern);


    if (match) {

        const qty =
            Number(match[1]);

        const name =
            match[2]
                .replace(
                    /^(من|عدد)\s+/i,
                    ""
                )
                .trim();


        const price =
            Number(match[3]);


        return [

            {

                name,

                qty,

                unit: "قطعة",

                price,

                total:
                    qty * price

            }

        ];

    }


    /*
     * محاولة ثانية:
     *
     * 50 كرتون زيت
     */

    const simplePattern =
        /(\d+(?:\.\d+)?)\s+([^\d]+?)(?=\s+(?:آجل|اجل|نقدي|مجاني|بمبلغ|بقيمة|$))/i;


    const simple =
        t.match(
            simplePattern
        );


    if (simple) {

        return [

            {

                name:
                    simple[2].trim(),

                qty:
                    Number(simple[1]),

                unit:
                    "قطعة",

                price:
                    0,

                total:
                    0

            }

        ];

    }


    return [];

}


/* ================================
   Calculate Totals
================================ */

function calculateTotals(items) {

    const subtotal =
        items.reduce(

            (sum, item) => {

                return sum +
                    (
                        Number(item.qty || 0) *
                        Number(item.price || 0)
                    );

            },

            0

        );


    return {

        subtotal,

        discount: 0,

        tax: 0,

        total: subtotal

    };

}


/* ================================
   Validate Basic Transaction
================================ */

function validateTransaction(data) {

    const errors = [];


    if (
        data.intent ===
        "sales_invoice"
    ) {

        if (!data.customer) {

            errors.push(
                "اسم العميل مطلوب"
            );

        }


        if (
            !data.items ||
            !data.items.length
        ) {

            errors.push(
                "لم يتم تحديد الأصناف"
            );

        }


        const hasPrice =
            data.items &&
            data.items.some(
                item =>
                    Number(item.price) > 0
            );


        if (!hasPrice) {

            errors.push(
                "سعر البيع غير محدد"
            );

        }

    }


    if (
        data.intent ===
        "payment"
    ) {

        if (!data.customer) {

            errors.push(
                "اسم العميل مطلوب للسداد"
            );

        }


        if (!data.amount) {

            errors.push(
                "مبلغ السداد مطلوب"
            );

        }

    }


    return {

        valid:
            errors.length === 0,

        errors

    };

}


/* ================================
   Main Parser
================================ */

function parseTransaction(text) {

    if (
        typeof text !== "string" ||
        !text.trim()
    ) {

        throw new Error(
            "النص مطلوب"
        );

    }


    const normalized =
        normalizeText(text);


    const signals =
        detectSignals(
            normalized
        );


    const intent =
        detectIntent(
            normalized
        );


    const customer =
        extractCustomer(
            normalized
        );


    const supplier =
        extractSupplier(
            normalized
        );


    const paymentType =
        detectPaymentType(
            normalized
        );


    const dueDays =
        extractDueDays(
            normalized
        );


    const amount =
        extractAmount(
            normalized
        );


    const items =
        extractItems(
            normalized
        );


    /*
     * المجاني = قيمة صفر
     */

    if (
        paymentType === "free"
    ) {

        for (
            const item
            of items
        ) {

            item.price = 0;

            item.total = 0;

        }

    }


    const totals =
        calculateTotals(
            items
        );


    const data = {

        raw_text:
            text,

        normalized_text:
            normalized,

        intent,

        customer,

        supplier,

        customer_phone:
            null,

        type:
            paymentType === "credit"
                ? "credit"
                : "cash",

        payment_type:
            paymentType,

        due_days:
            dueDays,

        due_date:
            null,

        amount,

        items,

        subtotal:
            totals.subtotal,

        discount:
            totals.discount,

        tax:
            totals.tax,

        total:
            totals.total,

        signals,

        ready:
            false,

        errors: []

    };


    const validation =
        validateTransaction(
            data
        );


    data.ready =
        validation.valid;


    data.errors =
        validation.errors;


    /*
     * العمليات التي ليست فواتير
     * لا تحتاج شرط الفاتورة.
     */

    if (
        intent !== "sales_invoice" &&
        intent !== "purchase_invoice"
    ) {

        data.ready =
            validation.valid;

    }


    return data;

}


/* ================================
   Export
================================ */

module.exports = {

    parseTransaction,

    detectIntent,

    extractCustomer,

    extractSupplier,

    extractAmount,

    extractItems,

    extractDueDays,

    detectPaymentType,

    validateTransaction

};
