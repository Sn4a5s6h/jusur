function arabicNumbersToEnglish(value) {
    const map = {
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

    return String(value || "")
        .replace(/[٠-٩]/g, c => map[c])
        .replace(/,/g, "")
        .replace(/٬/g, "")
        .trim();
}

function number(value) {
    return Number(arabicNumbersToEnglish(value));
}

function normalizeText(text) {
    return String(text || "")
        .replace(/[إأآ]/g, "ا")
        .replace(/ة/g, "ة")
        .replace(/\s+/g, " ")
        .trim();
}

const units = [
    "كرتون",
    "كرتونة",
    "قطمة",
    "قطم",
    "قطعة",
    "حبة",
    "وحدة",
    "كيلو",
    "كجم",
    "كغ",
    "جرام",
    "لتر",
    "كيس",
    "علبة",
    "باكت",
    "صندوق"
];

const months = {
    "يناير": 0,
    "فبراير": 1,
    "مارس": 2,
    "ابريل": 3,
    "أبريل": 3,
    "مايو": 4,
    "يونيو": 5,
    "يوليو": 6,
    "اغسطس": 7,
    "أغسطس": 7,
    "سبتمبر": 8,
    "اكتوبر": 9,
    "أكتوبر": 9,
    "نوفمبر": 10,
    "ديسمبر": 11
};

function parseDueDate(text) {

    const match = text.match(
        /(?:تستحق|استحقاق|الاستحقاق|موعد السداد|السداد)\s+(?:في|يوم)?\s*([٠-٩0-9]{1,2})\s+(يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر)/i
    );

    if (!match) {
        return null;
    }

    const day = number(match[1]);
    const monthName = match[2];
    const month = months[monthName];

    if (
        month === undefined ||
        day < 1 ||
        day > 31
    ) {
        return null;
    }

    const now = new Date();

    let year = now.getFullYear();

    const candidate =
        new Date(year, month, day);

    if (candidate < now) {
        year++;
    }

    const finalDate =
        new Date(year, month, day);

    return {
        due_date:
            finalDate.toISOString().slice(0, 10),

        due_days:
            Math.ceil(
                (
                    finalDate.getTime() -
                    now.getTime()
                ) /
                (1000 * 60 * 60 * 24)
            )
    };
}

function parseTransaction(text) {

    const original =
        String(text || "").trim();

    const normalized =
        normalizeText(original);

    const result = {

        intent: "unknown",

        customer: null,

        customer_phone: null,

        type: "cash",

        due_days: null,

        due_date: null,

        items: [],

        discount: 0,

        tax: 0,

        total: 0,

        ready: false,

        needs_confirmation: true,

        original_text: original

    };

    /*
     * نوع العملية
     */

    if (
        /فاتورة\s+مبيعات|فاتورة\s+بيع|مبيعات|بيع/i
            .test(normalized)
    ) {
        result.intent =
            "sales_invoice";
    }

    /*
     * آجل / دين
     */

    if (
        /اجل|آجل|آجلة|دين|على الحساب|بالدين/i
            .test(normalized)
    ) {
        result.type =
            "credit";
    }

    /*
     * العميل
     *
     * أمثلة:
     * من العميل غيلان
     * على العميل علي أحمد
     * للعميل محمد
     */

    const customerMatch =
        normalized.match(
            /(?:من|على|لدى|لل|الى|إلى)\s+العميل\s+(.+?)(?=\s+(?:تستحق|استحقاق|بسعر|سعر|من سعر|بسعر|اجل|آجل|لمدة|نقد|نقدا|نقدًا)|$)/i
        );

    if (customerMatch) {

        result.customer =
            customerMatch[1]
                .trim()
                .replace(/[،,.]+$/, "");

    }

    /*
     * صيغة الصنف الرئيسية:
     *
     * ٥٠ قطمة دال اصفر من سعر ٥٠٠
     *
     * أو:
     *
     * ٥٠ قطمة دال اصفر بسعر ٥٠٠
     *
     * أو:
     *
     * ٥٠ قطمة دال اصفر سعر ٥٠٠
     */

    const unitPattern =
        units.join("|");

    const itemRegex =
        new RegExp(
            "(?:^|\\s)" +
            "([٠-٩0-9]+)" +
            "\\s+(" +
            unitPattern +
            ")" +
            "\\s+" +
            "(.+?)" +
            "\\s+" +
            "(?:من\\s+)?(?:سعر|بسعر)" +
            "\\s+" +
            "([٠-٩0-9,٬]+)" +
            "(?=\\s+(?:من|على|لل|تستحق|استحقاق|اجل|آجل|لمدة)|$)",
            "i"
        );

    const itemMatch =
        normalized.match(itemRegex);

    if (itemMatch) {

        const qty =
            number(itemMatch[1]);

        const unit =
            itemMatch[2];

        const name =
            itemMatch[3]
                .trim()
                .replace(/[،,.]+$/, "");

        const price =
            number(itemMatch[4]);

        result.items.push({

            name,

            qty,

            price,

            unit

        });

    }

    /*
     * محاولة ثانية إذا كانت صياغة الجملة مختلفة
     */

    if (result.items.length === 0) {

        const simpleItemRegex =
            new RegExp(
                "([٠-٩0-9]+)\\s+(" +
                unitPattern +
                ")\\s+(.+?)\\s+(?:من\\s+)?(?:سعر|بسعر)\\s+([٠-٩0-9,٬]+)",
                "i"
            );

        const match =
            normalized.match(
                simpleItemRegex
            );

        if (match) {

            result.items.push({

                name:
                    match[3]
                        .trim(),

                qty:
                    number(match[1]),

                price:
                    number(match[4]),

                unit:
                    match[2]

            });

        }

    }

    /*
     * تاريخ الاستحقاق
     */

    const due =
        parseDueDate(normalized);

    if (due) {

        result.due_date =
            due.due_date;

        result.due_days =
            due.due_days;

        /*
         * وجود تاريخ استحقاق يعني
         * أن العملية آجلة حتى لو
         * لم يكتب المستخدم كلمة "أجل".
         */

        result.type =
            "credit";

    }

    /*
     * مدة الأجل
     *
     * مثال:
     * أجل 30 يوم
     * لمدة 30 يوم
     */

    const dueDaysMatch =
        normalized.match(
            /(?:اجل|آجل|لمدة|استحقاق)\s*(?:لمدة)?\s*([٠-٩0-9]+)\s*(يوم|أيام|شهر|أشهر)?/i
        );

    if (
        dueDaysMatch &&
        !result.due_date
    ) {

        const value =
            number(dueDaysMatch[1]);

        const unit =
            dueDaysMatch[2] || "يوم";

        result.due_days =
            /شهر|أشهر/i.test(unit)
                ? value * 30
                : value;

        result.type =
            "credit";

        const date =
            new Date();

        date.setDate(
            date.getDate() +
            result.due_days
        );

        result.due_date =
            date.toISOString()
                .slice(0, 10);
    }

    /*
     * الإجمالي
     */

    if (result.items.length > 0) {

        result.total =
            result.items.reduce(
                (sum, item) =>
                    sum +
                    (
                        item.qty *
                        item.price
                    ),
                0
            );

    }

    /*
     * التحقق
     */

    result.ready =
        result.intent ===
            "sales_invoice" &&

        Boolean(
            result.customer
        ) &&

        result.items.length > 0 &&

        result.items.every(
            item =>
                item.qty > 0 &&
                item.price >= 0 &&
                item.name
        );

    return result;
}

module.exports = {
    parseTransaction
};
