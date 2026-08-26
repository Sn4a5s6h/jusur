const {
    query
} = require("../database/db");


async function incomeStatement(
    companyId,
    fromDate,
    toDate
) {

    const result =
        await query(
            `
            SELECT

                a.account_type,

                a.code,

                a.name,

                COALESCE(
                    SUM(jl.debit),
                    0
                ) AS debit,

                COALESCE(
                    SUM(jl.credit),
                    0
                ) AS credit

            FROM accounts a

            JOIN journal_lines jl
                ON jl.account_id = a.id

            JOIN journal_entries je
                ON je.id = jl.journal_id

            WHERE
                a.company_id = $1

                AND je.company_id = $1

                AND je.entry_date >= $2

                AND je.entry_date <= $3

                AND je.status = 'posted'

                AND a.account_type IN
                (
                    'revenue',
                    'expense'
                )

            GROUP BY
                a.account_type,
                a.code,
                a.name

            ORDER BY
                a.code
            `,
            [
                companyId,
                fromDate,
                toDate
            ]
        );

    let revenue = 0;
    let expenses = 0;

    const accounts =
        result.rows.map(row => {

            const debit =
                Number(row.debit);

            const credit =
                Number(row.credit);

            let amount;

            if (
                row.account_type ===
                "revenue"
            ) {

                amount =
                    credit - debit;

                revenue += amount;

            } else {

                amount =
                    debit - credit;

                expenses += amount;

            }

            return {
                ...row,
                amount
            };

        });

    return {
        accounts,
        revenue,
        expenses,
        netIncome:
            revenue - expenses
    };

}


module.exports = {
    incomeStatement
};
