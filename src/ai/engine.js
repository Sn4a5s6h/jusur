const {
    normalizeArabicNumbers,
    normalizeNumber,
    normalizeText,
    normalizeSaleType,
    normalizeUnit
} = require("./normalizer");

const {
    validateTransaction
} = require("./validator");


function extractCustomer(text) {
    const patterns = [
        /(?:العميل|للعميل|على العميل|من العميل)\s+(.+?)(?=\s+(?:بسعر|سعر|بـ|ب|آجل|اجل|أجل|لمدة|تستحق|استحقاق)|$)/i,

        /(?:لـ|ل)\s*([ء-يA-Za-z0-9 ]+?)(?=\s+(?:عدد|كمية|سعر|بسعر|بـ|آجل|اجل|أجل)|$)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match && match[1]) {
            return match[1]
                .trim()
                .replace(/[،,.]+$/, "");
        }
    }

    return null;
}


function extractDueDate(text) {
    const normalized =
        normalizeArabicNumbers(text);

    /*
     * 30 أغسطس
     */
    const dateMatch =
        normalized.match(
            /(?:تستحق|استحقاق|حتى|إلى|الى|يوم)\s*(\d{1,2})\s*(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)/i
        );

    if (dateMatch) {
        const months = {
            "يناير": "01",
            "فبراير": "02",
            "مارس": "03",
            "أبريل": "04",
            "ابريل": "04",
            "مايو": "05",
            "يونيو": "06",
            "يوليو": "07",
            "أغسطس": "08",
            "اغسطس": "08",
            "سبتمبر": "09",
            "أكتوبر": "10",
            "اكتوبر": "10",
            "نوفمبر": "11",
            "ديسمبر": "12"
        };

        const day =
            String(Number(dateMatch[1]))
                .padStart(2, "0");

        const month =
            months[dateMatch[2]];

        const year =
            new Date().getFullYear();

        return `${year}-${month}-${day}`;
    }

    return null;
}


function extractDueDays(text) {
    const normalized =
        normalizeArabicNumbers(text);

    const match =
        normalized.match(
            /(?:لمدة|بعد)\s*(\d+)\s*(يوم|أيام|شهر|أشهر)/i
        );

    if (!match) return null;

    const value =
        Number(match[1]);

    if (/شهر|أشهر/i.test(match[2])) {
        return value * 30;
    }

    return value;
}


function extractItems(text) {
    const items = [];

    /*
     * مثال:
     * 50 قطمة دال أصفر بسعر 500
     */

    const pattern =
        /(\d+(?:\.\d+)?)\s*(كرتون|كرتونة|قطمة|قطمه|قطعة|قطعه|حبة|حبه|كيلو|كجم|كغ|علبة|علبه|لتر)\s+(.+?)\s+(?:بسعر|سعر|بـ|ب)\s*(\d+(?:\.\d+)?)/gi;

    let match;

    while ((match = pattern.exec(text)) !== null) {
        items.push({
            name: match[3]
                .trim()
                .replace(/[،,.]+$/, ""),

            qty: normalizeNumber(match[1]),

            unit: normalizeUnit(match[2]),

            price: normalizeNumber(match[4])
        });
    }

    return items;
}


function calculateTotal(items) {
    return items.reduce(
        (sum, item) =>
            sum +
            Number(item.qty || 0) *
            Number(item.price || 0),
        0
    );
}


function parseTransaction(text) {
    const original =
        String(text || "").trim();

    const normalized =
        normalizeText(
            normalizeArabicNumbers(original)
        );

    const result = {
        intent: "unknown",

        customer: extractCustomer(normalized),

        customer_phone: null,

        type: normalizeSaleType(normalized),

        due_days:
            extractDueDays(normalized),

        due_date:
            extractDueDate(normalized),

        items:
            extractItems(normalized),

        discount: 0,

        tax: 0,

        total: 0,

        ready: false,

        needs_confirmation: true,

        errors: [],

        original_text: original
    };


    /*
     * تحديد نوع العملية
     */

    if (
        /فاتورة مبيعات|فاتورة بيع|بعت|بعت له|بيع/i
            .test(normalized)
    ) {
        result.intent =
            "sales_invoice";
    }

    else if (
        /فاتورة مشتريات|اشتريت|شراء/i
            .test(normalized)
    ) {
        result.intent =
            "purchase_invoice";
    }

    else if (
        /قبضت|استلمت|تحصلت/i
            .test(normalized)
    ) {
        result.intent =
            "payment_received";
    }

    else if (
        /دفعت|سددت/i
            .test(normalized)
    ) {
        result.intent =
            "payment_sent";
    }

    else if (
        /مصروف|دفعت مصروف/i
            .test(normalized)
    ) {
        result.intent =
            "expense";
    }


    result.total =
        calculateTotal(
            result.items
        );


    /*
     * إذا كانت العملية آجل
     * ولم يوجد تاريخ محدد ولكن توجد مدة
     */

    if (
        result.type === "credit" &&
        !result.due_date &&
        result.due_days
    ) {
        const date =
            new Date();

        date.setDate(
            date.getDate() +
            Number(result.due_days)
        );

        result.due_date =
            date.toISOString()
                .slice(0, 10);
    }


    const validation =
        validateTransaction(
            result
        );


    result.errors =
        validation.errors;

    result.ready =
        validation.valid;


    return result;
}


module.exports = {
    parseTransaction
};
