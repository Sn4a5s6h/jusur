const db = require("../db");

const {
    createJournalEntry
} = require("./journal");

const ACCOUNTS = require("./chart-of-accounts");


/*
====================================================
 نشر فاتورة مبيعات
====================================================
*/

function postSalesInvoice(invoice) {

    if (!invoice) {
        throw new Error("بيانات الفاتورة مطلوبة");
    }

    const total =
        Number(invoice.total || 0);

    if (total <= 0) {
        throw new Error(
            "قيمة الفاتورة يجب أن تكون أكبر من صفر"
        );
    }


    const isCredit =
        invoice.type === "credit";


    /*
    آجل:
    من حـ/ العملاء
       إلى حـ/ المبيعات

    نقدي:
    من حـ/ الصندوق
       إلى حـ/ المبيعات
    */

    const debitAccount =
        isCredit
            ? ACCOUNTS.ACCOUNTS_RECEIVABLE
            : ACCOUNTS.CASH;


    return createJournalEntry({

        reference_type:
            "sales_invoice",

        reference_id:
            invoice.id,

        description:
            `فاتورة مبيعات رقم ${invoice.inv_no}`,

        lines: [

            {
                account_code:
                    debitAccount.code,

                account_name:
                    isCredit
                        ? `${debitAccount.name} - ${invoice.customer_name}`
                        : debitAccount.name,

                debit:
                    total,

                credit:
                    0
            },

            {
                account_code:
                    ACCOUNTS.SALES.code,

                account_name:
                    ACCOUNTS.SALES.name,

                debit:
                    0,

                credit:
                    total
            }

        ]

    });

}


/*
====================================================
 نشر سداد عميل
====================================================
*/

function postCustomerPayment(payment) {

    if (!payment) {
        throw new Error("بيانات السداد مطلوبة");
    }

    const amount =
        Number(payment.amount || 0);

    if (amount <= 0) {
        throw new Error(
            "مبلغ السداد يجب أن يكون أكبر من صفر"
        );
    }


    /*
    السداد النقدي:

    من حـ/ الصندوق
       إلى حـ/ العملاء
    */


    return createJournalEntry({

        reference_type:
            "customer_payment",

        reference_id:
            payment.id || null,

        description:
            `سداد من العميل ${payment.customer_name || ""}`,

        lines: [

            {
                account_code:
                    ACCOUNTS.CASH.code,

                account_name:
                    ACCOUNTS.CASH.name,

                debit:
                    amount,

                credit:
                    0
            },

            {
                account_code:
                    ACCOUNTS.ACCOUNTS_RECEIVABLE.code,

                account_name:
                    payment.customer_name
                        ? `${ACCOUNTS.ACCOUNTS_RECEIVABLE.name} - ${payment.customer_name}`
                        : ACCOUNTS.ACCOUNTS_RECEIVABLE.name,

                debit:
                    0,

                credit:
                    amount
            }

        ]

    });

}


/*
====================================================
 نشر حركة بنكية
====================================================
*/

function postBankReceipt(transaction) {

    if (!transaction) {
        throw new Error(
            "بيانات الحركة البنكية مطلوبة"
        );
    }

    const amount =
        Number(transaction.amount || 0);

    if (amount <= 0) {
        throw new Error(
            "مبلغ الحركة البنكية غير صحيح"
        );
    }


    return createJournalEntry({

        reference_type:
            "bank_transaction",

        reference_id:
            transaction.id || null,

        description:
            transaction.description ||
            "إيداع بنكي",

        lines: [

            {
                account_code:
                    ACCOUNTS.BANK.code,

                account_name:
                    ACCOUNTS.BANK.name,

                debit:
                    amount,

                credit:
                    0
            },

            {
                account_code:
                    ACCOUNTS.ACCOUNTS_RECEIVABLE.code,

                account_name:
                    ACCOUNTS.ACCOUNTS_RECEIVABLE.name,

                debit:
                    0,

                credit:
                    amount
            }

        ]

    });

}


module.exports = {

    postSalesInvoice,

    postCustomerPayment,

    postBankReceipt

};
