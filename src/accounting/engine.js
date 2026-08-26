const {
    transaction
} = require("../database/db");

const {
    postJournal
} = require("./journal");


async function postSimpleTransaction({

    companyId,

    fiscalPeriodId,

    date,

    description,

    debitAccountId,

    creditAccountId,

    amount,

    referenceType,

    referenceId

}) {

    const value =
        Number(amount);

    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {

        throw new Error(
            "قيمة العملية غير صحيحة"
        );

    }

    if (
        !debitAccountId ||
        !creditAccountId
    ) {

        throw new Error(
            "يجب تحديد الحساب المدين والدائن"
        );

    }

    return transaction(
        async client => {

            return postJournal(
                client,
                {

                    companyId,

                    fiscalPeriodId,

                    entryDate:
                        date,

                    description,

                    referenceType,

                    referenceId,

                    lines: [

                        {
                            accountId:
                                debitAccountId,

                            debit:
                                value,

                            credit:
                                0

                        },

                        {
                            accountId:
                                creditAccountId,

                            debit:
                                0,

                            credit:
                                value

                        }

                    ]

                }
            );

        }
    );

}


module.exports = {
    postSimpleTransaction
};
