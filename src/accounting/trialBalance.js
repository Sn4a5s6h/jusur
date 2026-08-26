const {
    query
} = require("../database/db");


async function trialBalance(
    companyId,
    fromDate,
    toDate
) {

    const result =
        await query(
            `
            SELECT

                a.id,

                a.code,

                a.name,

                a.account_type,

                COALESCE(
                    SUM(jl.debit),
                    0
                ) AS debit,

                COALESCE(
                    SUM(jl.credit),
                    0
                ) AS credit

            FROM accounts a

            LEFT JOIN journal_lines jl
                ON jl.account_id = a.id

            LEFT JOIN journal_entries je
                ON je.id = jl.journal_id

                AND je.company_id = $1

                AND je.entry_date >= $2

                AND je.entry_date <= $3

                AND je.status = 'posted'

            WHERE
                a.company_id = $1

            GROUP BY
                a.id,
                a.code,
                a.name,
                a.account_type

            ORDER BY
                a.code
            `,
            [
                companyId,
                fromDate,
                toDate
            ]
        );

    let totalDebit = 0;
    let totalCredit = 0;

    const accounts =
        result.rows.map(row => {

            const debit =
                Number(row.debit);

            const credit =
                Number(row.credit);

            totalDebit += debit;
            totalCredit += credit;

            return {
                ...row,
                debit,
                credit,
                balance:
                    debit - credit
            };

        });

    return {
        accounts,
        totalDebit,
        totalCredit,
        difference:
            totalDebit - totalCredit
    };

}


module.exports = {
    trialBalance
};
