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

    return String(value)
        .replace(
            /[٠-٩]/g,
            character => map[character]
        )
        .replace(/,/g, "")
        .replace(/٬/g, "");

}


function number(value) {

    return Number(
        arabicNumbersToEnglish(value)
    );

}


function parseTransaction(text) {

    const original =
        String(text || "").trim();


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


    if (
        /فاتورة|بيع|مبيعات/i
        .test(original)
    ) {

        result.intent =
            "sales_invoice";

    }


    if (
        /أجل|اجل|آجل|دين|على الحساب/i
        .test(original)
    ) {

        result.type =
            "credit";

    }


    const customerMatch =
        original.match(
            /(?:العميل|للعميل|على العميل)\s+(.+?)(?=\s+(?:بسعر|سعر|اجل|أجل|آجل|لمدة)|$)/i
        );


    if (customerMatch) {

        result.customer =
            customerMatch[1]
                .trim()
                .replace(/[،,]+$/, "");

    }


    const itemMatch =
        original.match(

            /([٠-٩0-9]+)\s*(?:كرتون|كرتونة|قطعة|حبة|وحدة)\s+(.+?)\s+(?:بسعر|سعر)\s+([٠-٩0-9,٬]+)/i

        );


    if (itemMatch) {

        const qty =
            number(itemMatch[1]);


        const unit =
            /كرتون|كرتونة/i
                .test(itemMatch[0])
                ? "كرتون"
                : "قطعة";


        const name =
            itemMatch[2].trim();


        const price =
            number(itemMatch[3]);


        result.items.push({

            name,

            qty,

            price,

            unit

        });

    }


    const dueMatch =
        original.match(

            /(?:أجل|اجل|آجل)\s*(?:لمدة)?\s*([٠-٩0-9]+)\s*(يوم|أيام|شهر|أشهر)?/i

        );


    if (dueMatch) {

        const n =
            number(dueMatch[1]);


        if (
            /شهر|أشهر/i
                .test(dueMatch[2] || "")
        ) {

            result.due_days =
                n * 30;

        } else {

            result.due_days = n;

        }

    }


    if (
        result.customer &&
        result.items.length
    ) {

        result.total =
            result.items.reduce(

                (sum, item) =>
                    sum +
                    item.qty *
                    item.price,

                0

            );

        result.ready = true;

    }


    return result;

}


module.exports = {

    parseTransaction

};
