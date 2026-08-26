function normalizeArabicNumbers(value) {
    if (value === null || value === undefined) return value;

    const map = {
        "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
        "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
    };

    return String(value)
        .replace(/[٠-٩]/g, c => map[c])
        .replace(/[٬,،]/g, "")
        .trim();
}

function normalizeNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const n = Number(normalizeArabicNumbers(value));
    return Number.isFinite(n) ? n : null;
}

function normalizeText(text) {
    return String(text || "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[إأآ]/g, "ا")
        .replace(/ة/g, "ة");
}

function normalizeSaleType(text) {
    const value = normalizeText(text);

    if (
        /آجل|اجل|أجل|دين|على الحساب|حساب|بالآجل/i.test(value)
    ) {
        return "credit";
    }

    return "cash";
}

function normalizeUnit(text) {
    const value = String(text || "");

    if (/كرتون|كرتونة|كرتونه/i.test(value)) return "كرتون";
    if (/قطمة|قطمه/i.test(value)) return "قطمة";
    if (/كيلو|كجم|كغ/i.test(value)) return "كيلو";
    if (/جرام|غرام/i.test(value)) return "جرام";
    if (/لتر/i.test(value)) return "لتر";
    if (/علبة|علبه/i.test(value)) return "علبة";
    if (/حبة|حبه/i.test(value)) return "حبة";
    if (/قطعة|قطعه/i.test(value)) return "قطعة";

    return "قطعة";
}

module.exports = {
    normalizeArabicNumbers,
    normalizeNumber,
    normalizeText,
    normalizeSaleType,
    normalizeUnit
};
