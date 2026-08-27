/*
|--------------------------------------------------------------------------
| JUSOOR AI ACCOUNTING ENGINE
|--------------------------------------------------------------------------
| تحليل العمليات المحاسبية باللغة العربية
|
| يدعم:
| - بيع نقدي
| - بيع آجل
| - قبض من عميل
| - شراء نقدي
| - شراء آجل
| - دفع لمورد
| - إضافة أصناف
| - مصروف
| - إيداع وسحب نقدية
|
| ملاحظة:
| هذا المحرك لا ينفذ أي عملية في قاعدة البيانات.
| وظيفته تحليل النص فقط، ثم يقوم server.js بالمراجعة
| قبل الحفظ.
|--------------------------------------------------------------------------
*/

"use strict";


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

    const text =
        String(value).trim();

    return text || null;
}


function normalizeArabicNumbers(text) {

    if (!text) {
        return "";
    }

    const arabicNumbers = {
        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9",
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

    return String(text)
        .replace(
            /[٠-٩۰-۹]/g,
            char => arabicNumbers[char]
        )
        .replace(/٬/g, "")
        .replace(/٫/g, ".")
        .replace(/,/g, "");
}


function numberFromText(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const text =
        normalizeArabicNumbers(
            String(value)
        )
        .replace(/[^\d.-]/g, "");

    if (!text) {
        return null;
    }

    const number =
        Number(text);

    return Number.isFinite(number)
        ? number
        : null;
}


function roundNumber(value) {

    return Math.round(
        Number(value || 0) * 100
    ) / 100;

}


function addItem(
    items,
    name,
    qty,
    price,
    unit
) {

    name =
        cleanString(name);

    qty =
        numberFromText(qty);

    price =
        numberFromText(price);

    unit =
        cleanString(unit) ||
        "قطعة";


    if (!name) {
        return;
    }

    if (
        qty === null ||
        qty <= 0
    ) {
        return;
    }

    if (
        price === null ||
        price < 0
    ) {
        return;
    }


    items.push({

        name,

        qty:
            roundNumber(qty),

        price:
            roundNumber(price),

        unit

    });

}


/*
|--------------------------------------------------------------------------
| REMOVE COMMON WORDS FROM PRODUCT NAMES
|--------------------------------------------------------------------------
*/

function cleanItemName(name) {

    if (!name) {
        return null;
    }

    let result =
        String(name).trim();


    result =
        result
            .replace(
                /^(من|عدد|كمية|الصنف|صنف)\s+/i,
                ""
            )
            .replace(
                /\s+(بسعر|سعر|بقيمة|قيمة)\s*.*$/i,
                ""
            )
            .trim();


    return result || null;

}


/*
|--------------------------------------------------------------------------
| DETECT TRANSACTION TYPE
|--------------------------------------------------------------------------
*/

function detectType(text) {

    const value =
        text.toLowerCase();


    if (
        /آجل|اجل|بالآجل|بالاجل|على الحساب|دين|دائن/.test(
            value
        )
    ) {

        return "credit";

    }


    return "cash";

}


/*
|--------------------------------------------------------------------------
| DETECT INTENT
|--------------------------------------------------------------------------
*/

function detectIntent(text) {

    const value =
        text.toLowerCase();


    /*
    |--------------------------------------------------------------------------
    | CUSTOMER PAYMENT
    |--------------------------------------------------------------------------
    */

    if (
        /قبض|استلام|تحصيل|استلمنا|استلمت|سدد لنا|سداد من العميل|دفع العميل/.test(
            value
        )
    ) {

        return "customer_payment";

    }


    /*
    |--------------------------------------------------------------------------
    | SUPPLIER PAYMENT
    |--------------------------------------------------------------------------
    */

    if (
        /دفع للمورد|سداد للمورد|سددنا للمورد|سدد للمورد|صرف للمورد/.test(
            value
        )
    ) {

        return "supplier_payment";

    }


    /*
    |--------------------------------------------------------------------------
    | PURCHASE
    |--------------------------------------------------------------------------
    */

    if (
        /شراء|اشترينا|اشترى|مشتريات|توريد/.test(
            value
        )
    ) {

        return "purchase_invoice";

    }


    /*
    |--------------------------------------------------------------------------
    | EXPENSE
    |--------------------------------------------------------------------------
    */

    if (
        /مصروف|مصاريف|إيجار|ايجار|كهرباء|ماء|رواتب|راتب|نقل|مواصلات/.test(
            value
        )
    ) {

        return "expense";

    }


    /*
    |--------------------------------------------------------------------------
    | CASH WITHDRAWAL
    |--------------------------------------------------------------------------
    */

    if (
        /سحب نقدي|سحب من الصندوق|سحبنا من الصندوق/.test(
            value
        )
    ) {

        return "cash_withdrawal";

    }


    /*
    |--------------------------------------------------------------------------
    | CASH DEPOSIT
    |--------------------------------------------------------------------------
    */

    if (
        /إيداع|ايداع|إيداع نقدي|اودع/.test(
            value
        )
    ) {

        return "cash_deposit";

    }


    /*
    |--------------------------------------------------------------------------
    | SALES
    |--------------------------------------------------------------------------
    */

    if (
        /بيع|مبيعات|بعنا|باع|فاتورة بيع|فاتورة/.test(
            value
        )
    ) {

        return "sales_invoice";

    }


    return "unknown";

}


/*
|--------------------------------------------------------------------------
| EXTRACT CUSTOMER / SUPPLIER NAME
|--------------------------------------------------------------------------
*/

function extractPersonName(
    text,
    intent
) {

    const patterns = [

        /(?:لـ|ل|إلى|الى)\s+([^\s:،,]+(?:\s+[^\s:،,]+){0,3})/i,

        /(?:من)\s+([^\s:،,]+(?:\s+[^\s:،,]+){0,3})/i,

        /(?:العميل)\s*[:\-]?\s*([^\s:،,]+(?:\s+[^\s:،,]+){0,3})/i,

        /(?:المورد)\s*[:\-]?\s*([^\s:،,]+(?:\s+[^\s:،,]+){0,3})/i

    ];


    for (
        const pattern
        of patterns
    ) {

        const match =
            text.match(pattern);


        if (!match) {
            continue;
        }


        let name =
            cleanString(
                match[1]
            );


        if (!name) {
            continue;
        }


        /*
        |--------------------------------------------------------------------------
        | REMOVE TRAILING ACTION WORDS
        |--------------------------------------------------------------------------
        */

        name =
            name
                .replace(
                    /\s+(دفع|دفعنا|وباقي|والباقي|بمبلغ|بقيمة|مبلغ|هاتف|رقم).*$/i,
                    ""
                )
                .trim();


        if (
            name.length > 0 &&
            name.length < 100
        ) {

            return name;

        }

    }


    return null;

}


/*
|--------------------------------------------------------------------------
| EXTRACT PHONE
|--------------------------------------------------------------------------
*/

function extractPhone(text) {

    const normalized =
        normalizeArabicNumbers(
            text
        );


    const match =
        normalized.match(
            /(?:05|07|7|967|\+967)[0-9]{7,12}/
        );


    return match
        ? match[0]
        : null;

}


/*
|--------------------------------------------------------------------------
| EXTRACT DUE DAYS
|--------------------------------------------------------------------------
*/

function extractDueDays(text) {

    const normalized =
        normalizeArabicNumbers(
            text
        );


    const match =
        normalized.match(
            /(\d+)\s*(?:يوم|أيام|ايام|يوماً)/
        );


    if (!match) {
        return null;
    }


    return Number(
        match[1]
    );

}


/*
|--------------------------------------------------------------------------
| EXTRACT PAID AMOUNT
|--------------------------------------------------------------------------
*/

function extractPaid(text) {

    const normalized =
        normalizeArabicNumbers(
            text
        );


    const patterns = [

        /(?:دفع|دفع العميل|تم دفع|دفعنا|المبلغ المدفوع|المدفوع)\s*(?:مبلغ|بقيمة|قدر|قدرها)?\s*[:\-]?\s*([\d.]+)/i,

        /(?:دفع)\s*([\d.]+)/i,

        /(?:استلمنا|استلمت|قبضنا|قبض)\s*([\d.]+)/i

    ];


    for (
        const pattern
        of patterns
    ) {

        const match =
            normalized.match(
                pattern
            );


        if (match) {

            const amount =
                numberFromText(
                    match[1]
                );


            if (
                amount !== null
            ) {

                return amount;

            }

        }

    }


    return 0;

}


/*
|--------------------------------------------------------------------------
| EXTRACT DISCOUNT
|--------------------------------------------------------------------------
*/

function extractDiscount(text) {

    const normalized =
        normalizeArabicNumbers(
            text
        );


    const match =
        normalized.match(
            /(?:خصم|الخصم)\s*(?:مبلغ|بقيمة)?\s*[:\-]?\s*([\d.]+)/
        );


    return match
        ? numberFromText(match[1])
        : 0;

}


/*
|--------------------------------------------------------------------------
| EXTRACT TAX
|--------------------------------------------------------------------------
*/

function extractTax(text) {

    const normalized =
        normalizeArabicNumbers(
            text
        );


    const match =
        normalized.match(
            /(?:ضريبة|الضريبة)\s*(?:مبلغ|بقيمة)?\s*[:\-]?\s*([\d.]+)/
        );


    return match
        ? numberFromText(match[1])
        : 0;

}


/*
|--------------------------------------------------------------------------
| EXTRACT ITEMS
|--------------------------------------------------------------------------
|
| أمثلة:
|
| 2 كيس أرز 25 كيلو بسعر 25000 للكيس
| 5 زيت بسعر 4000
| 3 سكر بسعر 8000
|
|--------------------------------------------------------------------------
*/

function extractItems(text) {

    const items = [];


    const normalized =
        normalizeArabicNumbers(
            text
        );


    /*
    |--------------------------------------------------------------------------
    | PATTERN 1
    |--------------------------------------------------------------------------
    | 2 كيس أرز 25 كيلو بسعر 25000 للكيس
    |--------------------------------------------------------------------------
    */

    const patternWithWeight =
        /(\d+(?:\.\d+)?)\s+(?:كيس|أكياس|كيساً)\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(?:كيلو|كجم|kg)\s+بسعر\s+(\d+(?:\.\d+)?)\s*(?:للكيس|للوحدة|للوحده)?/gi;


    let match;


    while (
        (match =
            patternWithWeight.exec(
                normalized
            )) !== null
    ) {

        const qty =
            Number(match[1]);

        const name =
            cleanItemName(
                match[2]
            );

        const price =
            Number(match[4]);


        addItem(
            items,
            name,
            qty,
            price,
            "كيس"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | PATTERN 2
    |--------------------------------------------------------------------------
    | 5 زيت بسعر 4000
    |--------------------------------------------------------------------------
    */

    const patternSimple =
        /(\d+(?:\.\d+)?)\s+([^\d،,؛;:]+?)\s+(?:بسعر|سعر)\s+(\d+(?:\.\d+)?)/gi;


    while (
        (match =
            patternSimple.exec(
                normalized
            )) !== null
    ) {

        const qty =
            Number(match[1]);


        let name =
            cleanItemName(
                match[2]
            );


        /*
        |--------------------------------------------------------------------------
        | CLEAN NAME
        |--------------------------------------------------------------------------
        */

        if (name) {

            name =
                name
                    .replace(
                        /\s+(للكيلو|للكيس|للقطعة|للوحدة)$/i,
                        ""
                    )
                    .trim();

        }


        /*
        |--------------------------------------------------------------------------
        | AVOID DUPLICATES
        |--------------------------------------------------------------------------
        */

        const exists =
            items.some(
                item =>
                    item.name === name &&
                    item.qty === qty &&
                    item.price === Number(match[3])
            );


        if (!exists) {

            addItem(
                items,
                name,
                qty,
                Number(match[3]),
                "قطعة"
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | PATTERN 3
    |--------------------------------------------------------------------------
    | 2 أرز × 25000
    |--------------------------------------------------------------------------
    */

    const multiplication =
        /(\d+(?:\.\d+)?)\s+([^\d،,؛;:]+?)\s*[x×*]\s*(\d+(?:\.\d+)?)/gi;


    while (
        (match =
            multiplication.exec(
                normalized
            )) !== null
    ) {

        const qty =
            Number(match[1]);


        const name =
            cleanItemName(
                match[2]
            );


        const price =
            Number(match[3]);


        const exists =
            items.some(
                item =>
                    item.name === name &&
                    item.qty === qty &&
                    item.price === price
            );


        if (!exists) {

            addItem(
                items,
                name,
                qty,
                price,
                "قطعة"
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | PATTERN 4
    |--------------------------------------------------------------------------
    | أرز 2 بسعر 25000
    |--------------------------------------------------------------------------
    */

    const reversePattern =
        /([^\d،,؛;:]+?)\s+(\d+(?:\.\d+)?)\s+(?:بسعر|سعر)\s+(\d+(?:\.\d+)?)/gi;


    while (
        (match =
            reversePattern.exec(
                normalized
            )) !== null
    ) {

        const name =
            cleanItemName(
                match[1]
            );


        const qty =
            Number(match[2]);


        const price =
            Number(match[3]);


        if (!name) {
            continue;
        }


        const exists =
            items.some(
                item =>
                    item.name === name &&
                    item.qty === qty &&
                    item.price === price
            );


        if (!exists) {

            addItem(
                items,
                name,
                qty,
                price,
                "قطعة"
            );

        }

    }


    return items;

}


/*
|--------------------------------------------------------------------------
| CALCULATE TOTAL
|--------------------------------------------------------------------------
*/

function calculateTotals(
    items,
    discount,
    tax
) {

    const subtotal =
        items.reduce(
            (
                total,
                item
            ) => {

                return total +
                    (
                        Number(item.qty) *
                        Number(item.price)
                    );

            },
            0
        );


    const safeDiscount =
        Number(discount || 0);


    const safeTax =
        Number(tax || 0);


    const total =
        subtotal -
        safeDiscount +
        safeTax;


    return {

        subtotal:
            roundNumber(
                subtotal
            ),

        discount:
            roundNumber(
                safeDiscount
            ),

        tax:
            roundNumber(
                safeTax
            ),

        total:
            roundNumber(
                Math.max(
                    total,
                    0
                )
            )

    };

}


/*
|--------------------------------------------------------------------------
| PARSE SALES
|--------------------------------------------------------------------------
*/

function parseSales(
    text
) {

    const type =
        detectType(
            text
        );


    const customer =
        extractPersonName(
            text,
            "sales"
        );


    const customerPhone =
        extractPhone(
            text
        );


    const dueDays =
        type === "credit"
            ? extractDueDays(text)
            : null;


    const items =
        extractItems(
            text
        );


    const discount =
        extractDiscount(
            text
        );


    const tax =
        extractTax(
            text
        );


    const totals =
        calculateTotals(
            items,
            discount,
            tax
        );


    const paid =
        extractPaid(
            text
        );


    const balance =
        Math.max(
            totals.total -
            paid,
            0
        );


    return {

        intent:
            "sales_invoice",

        customer,

        customer_phone:
            customerPhone,

        type,

        due_days:
            dueDays,

        due_date:
            null,

        items,

        discount:
            totals.discount,

        tax:
            totals.tax,

        subtotal:
            totals.subtotal,

        total:
            totals.total,

        paid:
            roundNumber(
                paid
            ),

        balance:
            roundNumber(
                balance
            ),

        ready:
            Boolean(
                customer &&
                items.length > 0 &&
                (
                    type === "cash" ||
                    dueDays !== null
                )
            ),

        needs_confirmation:
            true,

        original_text:
            text

    };

}


/*
|--------------------------------------------------------------------------
| PARSE CUSTOMER PAYMENT
|--------------------------------------------------------------------------
*/

function parseCustomerPayment(
    text
) {

    const customer =
        extractPersonName(
            text,
            "customer_payment"
        );


    const amount =
        extractPaid(
            text
        );


    return {

        intent:
            "customer_payment",

        customer,

        customer_phone:
            extractPhone(text),

        type:
            "cash",

        amount:
            roundNumber(amount),

        ready:
            Boolean(
                customer &&
                amount > 0
            ),

        needs_confirmation:
            true,

        original_text:
            text

    };

}


/*
|--------------------------------------------------------------------------
| PARSE PURCHASE
|--------------------------------------------------------------------------
*/

function parsePurchase(
    text
) {

    const supplier =
        extractPersonName(
            text,
            "purchase"
        );


    const type =
        detectType(
            text
        );


    const items =
        extractItems(
            text
        );


    const discount =
        extractDiscount(
            text
        );


    const tax =
        extractTax(
            text
        );


    const totals =
        calculateTotals(
            items,
            discount,
            tax
        );


    const paid =
        extractPaid(
            text
        );


    return {

        intent:
            "purchase_invoice",

        supplier,

        type,

        items,

        discount:
            totals.discount,

        tax:
            totals.tax,

        subtotal:
            totals.subtotal,

        total:
            totals.total,

        paid:
            roundNumber(
                paid
            ),

        balance:
            roundNumber(
                Math.max(
                    totals.total -
                    paid,
                    0
                )
            ),

        due_days:
            type === "credit"
                ? extractDueDays(text)
                : null,

        ready:
            Boolean(
                supplier &&
                items.length > 0
            ),

        needs_confirmation:
            true,

        original_text:
            text

    };

}


/*
|--------------------------------------------------------------------------
| PARSE EXPENSE
|--------------------------------------------------------------------------
*/

function parseExpense(
    text
) {

    const amount =
        extractPaid(
            text
        );


    let description =
        text
            .replace(
                /مصروف|مصاريف|إيجار|ايجار|كهرباء|ماء|رواتب|راتب/gi,
                ""
            )
            .trim();


    return {

        intent:
            "expense",

        description,

        amount:
            roundNumber(amount),

        type:
            "cash",

        ready:
            amount > 0,

        needs_confirmation:
            true,

        original_text:
            text

    };

}


/*
|--------------------------------------------------------------------------
| MAIN PARSER
|--------------------------------------------------------------------------
*/

function parseTransaction(
    input
) {

    const text =
        cleanString(
            input
        );


    if (!text) {

        throw new Error(
            "النص المحاسبي مطلوب"
        );

    }


    const normalizedText =
        normalizeArabicNumbers(
            text
        );


    const intent =
        detectIntent(
            normalizedText
        );


    let result;


    switch (intent) {

        case "sales_invoice":

            result =
                parseSales(
                    normalizedText
                );

            break;


        case "customer_payment":

            result =
                parseCustomerPayment(
                    normalizedText
                );

            break;


        case "purchase_invoice":

            result =
                parsePurchase(
                    normalizedText
                );

            break;


        case "expense":

            result =
                parseExpense(
                    normalizedText
                );

            break;


        default:

            result = {

                intent:
                    "unknown",

                customer:
                    null,

                customer_phone:
                    null,

                type:
                    "cash",

                due_days:
                    null,

                due_date:
                    null,

                items: [],

                discount:
                    0,

                tax:
                    0,

                subtotal:
                    0,

                total:
                    0,

                paid:
                    0,

                balance:
                    0,

                ready:
                    false,

                needs_confirmation:
                    true,

                original_text:
                    text,

                error:
                    "لم أستطع تحديد نوع المعاملة"

            };

            break;

    }


    /*
    |--------------------------------------------------------------------------
    | ALWAYS KEEP ORIGINAL TEXT
    |--------------------------------------------------------------------------
    */

    result.original_text =
        text;


    /*
    |--------------------------------------------------------------------------
    | NORMALIZE NUMERIC VALUES
    |--------------------------------------------------------------------------
    */

    if (
        result.items &&
        Array.isArray(result.items)
    ) {

        result.items =
            result.items.map(
                item => ({

                    ...item,

                    qty:
                        roundNumber(
                            item.qty
                        ),

                    price:
                        roundNumber(
                            item.price
                        )

                })
            );

    }


    return result;

}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    parseTransaction

};
