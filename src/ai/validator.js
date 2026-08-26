"use strict";

/*
==================================================
JUSOOR ACCOUNTING AI
Transaction Validator
==================================================

وظيفة الملف:
- التحقق من صحة العملية
- التأكد من وجود البيانات الأساسية
- فحص الكميات والأسعار
- فحص الإجماليات
- فحص الفواتير الآجلة
- فحص عمليات السداد
- فحص القيود المحاسبية
- منع العمليات غير المتوازنة
*/


/* ================================================
   Helpers
================================================ */

function isNumber(value) {
    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );
}


function number(value, fallback = 0) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;

}


function cleanText(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();

}


function round2(value) {

    return Math.round(
        (Number(value) + Number.EPSILON) * 100
    ) / 100;

}


/* ================================================
   Validate Required Text
================================================ */

function requireText(
    errors,
    value,
    message
) {

    if (!cleanText(value)) {

        errors.push(message);

    }

}


/* ================================================
   Validate Sales Invoice
================================================ */

function validateSalesInvoice(data) {

    const errors = [];

    const warnings = [];


    requireText(
        errors,
        data.customer,
        "اسم العميل مطلوب"
    );


    if (
        !Array.isArray(data.items) ||
        data.items.length === 0
    ) {

        errors.push(
            "يجب أن تحتوي الفاتورة على صنف واحد على الأقل"
        );

    }


    if (
        Array.isArray(data.items)
    ) {

        data.items.forEach(
            (item, index) => {

                const row =
                    index + 1;


                requireText(
                    errors,
                    item.name,
                    `اسم الصنف مطلوب في السطر ${row}`
                );


                const qty =
                    number(item.qty, NaN);


                if (
                    !Number.isFinite(qty) ||
                    qty <= 0
                ) {

                    errors.push(
                        `كمية الصنف في السطر ${row} غير صحيحة`
                    );

                }


                const price =
                    number(item.price, NaN);


                /*
                 * السعر صفر مسموح فقط
                 * عندما تكون العملية مجانية.
                 */

                if (
                    data.payment_type !== "free" &&
                    (
                        !Number.isFinite(price) ||
                        price < 0
                    )
                ) {

                    errors.push(
                        `سعر الصنف في السطر ${row} غير صحيح`
                    );

                }


                const expectedTotal =
                    round2(
                        qty * price
                    );


                if (
                    item.total !== undefined &&
                    item.total !== null
                ) {

                    const itemTotal =
                        number(
                            item.total,
                            NaN
                        );


                    if (
                        Number.isFinite(itemTotal) &&
                        Math.abs(
                            itemTotal -
                            expectedTotal
                        ) > 0.01
                    ) {

                        errors.push(
                            `إجمالي الصنف في السطر ${row} لا يطابق الكمية × السعر`
                        );

                    }

                }

            }
        );

    }


    /*
     * إجمالي الفاتورة
     */

    if (
        Array.isArray(data.items)
    ) {

        const calculatedSubtotal =
            round2(
                data.items.reduce(
                    (sum, item) => {

                        return sum +
                            (
                                number(item.qty) *
                                number(item.price)
                            );

                    },
                    0
                )
            );


        const discount =
            number(
                data.discount
            );


        const tax =
            number(
                data.tax
            );


        if (discount < 0) {

            errors.push(
                "الخصم لا يمكن أن يكون سالبًا"
            );

        }


        if (tax < 0) {

            errors.push(
                "الضريبة لا يمكن أن تكون سالبة"
            );

        }


        const calculatedTotal =
            round2(
                calculatedSubtotal -
                discount +
                tax
            );


        if (
            data.total !== undefined &&
            data.total !== null
        ) {

            const total =
                number(
                    data.total,
                    NaN
                );


            if (
                !Number.isFinite(total)
            ) {

                errors.push(
                    "إجمالي الفاتورة غير صحيح"
                );

            }
            else if (
                Math.abs(
                    total -
                    calculatedTotal
                ) > 0.01
            ) {

                errors.push(
                    `إجمالي الفاتورة غير صحيح. المتوقع ${calculatedTotal}`
                );

            }

        }

    }


    /*
     * الآجل يجب أن يكون له مدة
     * أو تاريخ استحقاق.
     */

    if (
        data.type === "credit"
    ) {

        const dueDays =
            number(
                data.due_days,
                NaN
            );


        const hasDueDate =
            !!cleanText(
                data.due_date
            );


        if (
            !hasDueDate &&
            (
                !Number.isFinite(dueDays) ||
                dueDays <= 0
            )
        ) {

            warnings.push(
                "الفاتورة آجل ولكن تاريخ أو مدة الاستحقاق غير محددة"
            );

        }

    }


    /*
     * المجاني
     */

    if (
        data.payment_type === "free"
    ) {

        if (
            number(data.total) !== 0
        ) {

            errors.push(
                "المعاملة المجانية يجب أن يكون إجماليها صفر"
            );

        }

    }


    return {

        valid:
            errors.length === 0,

        errors,

        warnings

    };

}


/* ================================================
   Validate Purchase Invoice
================================================ */

function validatePurchaseInvoice(data) {

    const errors = [];

    const warnings = [];


    requireText(
        errors,
        data.supplier,
        "اسم المورد مطلوب"
    );


    if (
        !Array.isArray(data.items) ||
        data.items.length === 0
    ) {

        errors.push(
            "فاتورة المشتريات تحتاج إلى صنف واحد على الأقل"
        );

    }


    if (
        Array.isArray(data.items)
    ) {

        data.items.forEach(
            (item, index) => {

                const row =
                    index + 1;


                requireText(
                    errors,
                    item.name,
                    `اسم الصنف مطلوب في السطر ${row}`
                );


                const qty =
                    number(
                        item.qty,
                        NaN
                    );


                if (
                    !Number.isFinite(qty) ||
                    qty <= 0
                ) {

                    errors.push(
                        `كمية المشتريات في السطر ${row} غير صحيحة`
                    );

                }


                const price =
                    number(
                        item.price,
                        NaN
                    );


                if (
                    !Number.isFinite(price) ||
                    price < 0
                ) {

                    errors.push(
                        `سعر الشراء في السطر ${row} غير صحيح`
                    );

                }

            }
        );

    }


    return {

        valid:
            errors.length === 0,

        errors,

        warnings

    };

}


/* ================================================
   Validate Payment
================================================ */

function validatePayment(data) {

    const errors = [];

    const warnings = [];


    requireText(
        errors,
        data.customer,
        "اسم العميل مطلوب لعملية السداد"
    );


    const amount =
        number(
            data.amount,
            NaN
        );


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        errors.push(
            "مبلغ السداد يجب أن يكون أكبر من صفر"
        );

    }


    /*
     * طرق الدفع المعروفة
     */

    const allowedMethods = [

        "cash",
        "bank",
        "transfer",
        "card",
        "check",
        "other"

    ];


    if (
        data.method &&
        !allowedMethods.includes(
            String(data.method).toLowerCase()
        )
    ) {

        warnings.push(
            "طريقة الدفع غير معروفة وسيتم التعامل معها كطريقة عامة"
        );

    }


    return {

        valid:
            errors.length === 0,

        errors,

        warnings

    };

}


/* ================================================
   Validate Customer Statement
================================================ */

function validateCustomerStatement(data) {

    const errors = [];


    requireText(
        errors,
        data.customer,
        "اسم العميل مطلوب للاستعلام عن كشف الحساب"
    );


    return {

        valid:
            errors.length === 0,

        errors,

        warnings: []

    };

}


/* ================================================
   Validate Journal Entry
================================================ */

function validateJournalEntry(data) {

    const errors = [];

    const warnings = [];


    if (
        !Array.isArray(data.lines) ||
        data.lines.length < 2
    ) {

        errors.push(
            "القيد المحاسبي يجب أن يحتوي على سطرين على الأقل"
        );

    }


    let totalDebit = 0;

    let totalCredit = 0;


    if (
        Array.isArray(data.lines)
    ) {

        data.lines.forEach(
            (line, index) => {

                const row =
                    index + 1;


                requireText(
                    errors,
                    line.account_code,
                    `رمز الحساب مطلوب في السطر ${row}`
                );


                requireText(
                    errors,
                    line.account_name,
                    `اسم الحساب مطلوب في السطر ${row}`
                );


                const debit =
                    number(
                        line.debit
                    );


                const credit =
                    number(
                        line.credit
                    );


                if (
                    debit < 0 ||
                    credit < 0
                ) {

                    errors.push(
                        `القيم المدينة والدائنة لا يمكن أن تكون سالبة في السطر ${row}`
                    );

                }


                if (
                    debit > 0 &&
                    credit > 0
                ) {

                    errors.push(
                        `السطر ${row} لا يمكن أن يحتوي على مدين ودائن في الوقت نفسه`
                    );

                }


                if (
                    debit === 0 &&
                    credit === 0
                ) {

                    warnings.push(
                        `السطر ${row} لا يحتوي على قيمة`
                    );

                }


                totalDebit += debit;

                totalCredit += credit;

            }
        );

    }


    totalDebit =
        round2(totalDebit);


    totalCredit =
        round2(totalCredit);


    /*
     * أهم قاعدة:
     *
     * المدين = الدائن
     */

    if (
        Math.abs(
            totalDebit -
            totalCredit
        ) > 0.01
    ) {

        errors.push(
            `القيد غير متوازن: المدين ${totalDebit} والدائن ${totalCredit}`
        );

    }


    return {

        valid:
            errors.length === 0,

        errors,

        warnings,

        totalDebit,

        totalCredit,

        balanced:
            Math.abs(
                totalDebit -
                totalCredit
            ) <= 0.01

    };

}


/* ================================================
   Validate General AI Transaction
================================================ */

function validateTransaction(data) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        return {

            valid: false,

            errors: [
                "بيانات المعاملة غير موجودة"
            ],

            warnings: []

        };

    }


    const intent =
        cleanText(
            data.intent
        );


    switch (intent) {

        case "sales_invoice":

            return validateSalesInvoice(
                data
            );


        case "purchase_invoice":

            return validatePurchaseInvoice(
                data
            );


        case "payment":

            return validatePayment(
                data
            );


        case "customer_statement":

            return validateCustomerStatement(
                data
            );


        case "journal_entry":

            return validateJournalEntry(
                data
            );


        case "sales_report":

        case "receivables_report":

            return {

                valid: true,

                errors: [],

                warnings: []

            };


        default:

            return {

                valid: false,

                errors: [
                    "نوع العملية غير معروف"
                ],

                warnings: []

            };

    }

}


/* ================================================
   Validate Accounting Balance
================================================ */

function validateBalance(
    debit,
    credit
) {

    const d =
        round2(
            number(debit)
        );

    const c =
        round2(
            number(credit)
        );


    return {

        debit: d,

        credit: c,

        balanced:
            Math.abs(d - c) <= 0.01,

        difference:
            round2(d - c)

    };

}


/* ================================================
   Export
================================================ */

module.exports = {

    validateTransaction,

    validateSalesInvoice,

    validatePurchaseInvoice,

    validatePayment,

    validateCustomerStatement,

    validateJournalEntry,

    validateBalance,

    isNumber,

    round2

};
