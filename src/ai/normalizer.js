"use strict";

/*
 * Jusoor Accounting AI
 * Arabic Transaction Normalizer
 *
 * المرحلة الأولى:
 * توحيد الأرقام والكلمات والصياغات العربية
 * قبل إرسال النص إلى محرك فهم المعاملة.
 */


/* =========================
   Arabic Numbers
========================= */

const ARABIC_DIGITS = {
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


/* =========================
   Normalize Digits
========================= */

function normalizeDigits(text) {

    return String(text || "")
        .replace(/[٠-٩]/g, digit => ARABIC_DIGITS[digit])
        .replace(/[۰-۹]/g, digit => {

            const persianDigits = {
                "۰": "0",
                "۱": "1",
                "۲": "2",
                "۳": "3",
                "۴": "4",
                "۵": "5",
                "۶": "6",
                "۷": "7",
                "۸": "8",
                "۹": "9"
            };

            return persianDigits[digit];

        });

}


/* =========================
   Normalize Spaces
========================= */

function normalizeSpaces(text) {

    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();

}


/* =========================
   Arabic Text Normalization
========================= */

function normalizeArabic(text) {

    return String(text || "")

        // Remove tatweel
        .replace(/ـ/g, "")

        // Normalize Alef
        .replace(/[أإآ]/g, "ا")

        // Normalize Ya
        .replace(/ى/g, "ي")

        // Normalize Ta Marbuta
        .replace(/ة/g, "ه")

        // Normalize Hamza
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")

        // Remove duplicate punctuation
        .replace(/[،]+/g, "،")

        .trim();

}


/* =========================
   Currency Normalization
========================= */

function normalizeCurrency(text) {

    let result = String(text || "");

    const replacements = [

        [/\bريال يمني\b/gi, "ريال"],
        [/\bريال\b/gi, "ريال"],
        [/\bر\.ي\b/gi, "ريال"],
        [/\bر ي\b/gi, "ريال"],

        [/\bYER\b/gi, "ريال"],
        [/\byer\b/gi, "ريال"],

        [/\bدولار\b/gi, "دولار"],
        [/\$\b/g, "دولار"]

    ];

    for (const [pattern, replacement] of replacements) {

        result =
            result.replace(
                pattern,
                replacement
            );

    }

    return result;

}


/* =========================
   Payment / Free Expressions
========================= */

function normalizePaymentWords(text) {

    let result = String(text || "");

    const freeExpressions = [

        "مجاني",
        "مجانا",
        "مجّاني",
        "بلاش",
        "بدون مقابل",
        "بدون فلوس",
        "ما عليه فلوس",
        "مافي فلوس",
        "ما في فلوس",
        "دون مقابل",
        "بلا مقابل",
        "هدية",
        "هديه"

    ];

    for (const phrase of freeExpressions) {

        result =
            result.replace(
                new RegExp(phrase, "gi"),
                "مجاني"
            );

    }

    return result;

}


/* =========================
   Credit Expressions
========================= */

function normalizeCreditWords(text) {

    let result = String(text || "");

    const creditExpressions = [

        "بالاجل",
        "بالأجل",
        "اجل",
        "أجل",
        "على الحساب",
        "حساب",
        "دين",
        "بالدين",
        "مؤجل",
        "مؤجلة",
        "لم يسدد",
        "ما دفع"

    ];

    for (const phrase of creditExpressions) {

        result =
            result.replace(
                new RegExp(phrase, "gi"),
                "آجل"
            );

    }

    return result;

}


/* =========================
   Cash Expressions
========================= */

function normalizeCashWords(text) {

    let result = String(text || "");

    const cashExpressions = [

        "نقدا",
        "نقدي",
        "كاش",
        "دفع نقدي",
        "تم الدفع",
        "مدفوع",
        "دفع"

    ];

    for (const phrase of cashExpressions) {

        result =
            result.replace(
                new RegExp(phrase, "gi"),
                "نقدي"
            );

    }

    return result;

}


/* =========================
   Time Expressions
========================= */

function normalizeTimeWords(text) {

    let result = String(text || "");

    const replacements = [

        [/\bشهر\b/gi, "30 يوم"],
        [/\bشهرين\b/gi, "60 يوم"],

        [/\bاسبوع\b/gi, "7 يوم"],
        [/\bأسبوع\b/gi, "7 يوم"],

        [/\bاسبوعين\b/gi, "14 يوم"],

        [/\bسنه\b/gi, "365 يوم"],
        [/\bسنة\b/gi, "365 يوم"],

        [/\bسنتين\b/gi, "730 يوم"]

    ];

    for (const [pattern, replacement] of replacements) {

        result =
            result.replace(
                pattern,
                replacement
            );

    }

    return result;

}


/* =========================
   Quantity Expressions
========================= */

function normalizeQuantityWords(text) {

    let result = String(text || "");

    const replacements = [

        [/\bكرتونه\b/gi, "كرتون"],
        [/\bكرتونات\b/gi, "كرتون"],

        [/\bعلبه\b/gi, "علبة"],
        [/\bعلبات\b/gi, "علبة"],

        [/\bحبه\b/gi, "حبة"],
        [/\bحبوب\b/gi, "حبة"],

        [/\bقطعه\b/gi, "قطعة"],
        [/\bقطع\b/gi, "قطعة"],

        [/\bكيلوات\b/gi, "كيلو"],
        [/\bكجم\b/gi, "كيلو"],
        [/\bكغ\b/gi, "كيلو"]

    ];

    for (const [pattern, replacement] of replacements) {

        result =
            result.replace(
                pattern,
                replacement
            );

    }

    return result;

}


/* =========================
   Invoice Expressions
========================= */

function normalizeInvoiceWords(text) {

    let result = String(text || "");

    const replacements = [

        [/\bفاتوره\b/gi, "فاتورة"],
        [/\bفواتير\b/gi, "فاتورة"],

        [/\bبيع\b/gi, "مبيعات"],
        [/\bبعت\b/gi, "مبيعات"],
        [/\bبعنا\b/gi, "مبيعات"],

        [/\bاشتريت\b/gi, "مشتريات"],
        [/\bشراء\b/gi, "مشتريات"],
        [/\bاشترينا\b/gi, "مشتريات"]

    ];

    for (const [pattern, replacement] of replacements) {

        result =
            result.replace(
                pattern,
                replacement
            );

    }

    return result;

}


/* =========================
   Number Cleanup
========================= */

function normalizeNumbers(text) {

    return String(text || "")

        // 1,500 → 1500
        .replace(/(\d)[,،](\d)/g, "$1$2")

        // 1 500 → 1500
        .replace(/(\d)\s+(\d{3})(?!\d)/g, "$1$2");

}


/* =========================
   Main Normalizer
========================= */

function normalizeText(text) {

    if (
        typeof text !== "string"
    ) {

        throw new TypeError(
            "النص يجب أن يكون نصًا"
        );

    }


    let result = text;


    result =
        normalizeDigits(result);


    result =
        normalizeArabic(result);


    result =
        normalizeCurrency(result);


    result =
        normalizePaymentWords(result);


    result =
        normalizeCreditWords(result);


    result =
        normalizeCashWords(result);


    result =
        normalizeTimeWords(result);


    result =
        normalizeQuantityWords(result);


    result =
        normalizeInvoiceWords(result);


    result =
        normalizeNumbers(result);


    result =
        normalizeSpaces(result);


    return result;

}


/* =========================
   Extract Numbers
========================= */

function extractNumbers(text) {

    const normalized =
        normalizeDigits(text);

    const matches =
        normalized.match(
            /\d+(?:\.\d+)?/g
        );

    if (!matches) {

        return [];

    }

    return matches.map(Number);

}


/* =========================
   Detect Basic Signals
========================= */

function detectSignals(text) {

    const normalized =
        normalizeText(text);


    return {

        isFree:
            normalized.includes("مجاني"),

        isCredit:
            normalized.includes("آجل"),

        isCash:
            normalized.includes("نقدي"),

        hasInvoice:
            normalized.includes("فاتورة"),

        hasSales:
            normalized.includes("مبيعات"),

        hasPurchase:
            normalized.includes("مشتريات"),

        numbers:
            extractNumbers(normalized)

    };

}


/* =========================
   Export
========================= */

module.exports = {

    normalizeText,

    normalizeDigits,

    normalizeArabic,

    normalizeCurrency,

    normalizePaymentWords,

    normalizeCreditWords,

    normalizeCashWords,

    normalizeTimeWords,

    normalizeQuantityWords,

    normalizeInvoiceWords,

    normalizeNumbers,

    extractNumbers,

    detectSignals

};
