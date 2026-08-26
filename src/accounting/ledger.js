const {
    query
} = require("../database/db");


async function accountLedger(
    companyId,
    accountId,
    fromDate,
    toDate
) {

    const result =
        await query(
            `
            SELECT

                je.entry_date,

                je.entry_no,

                je.description,

                jl.description AS line_description,

                jl.debit,

                jl.credit

            FROM journal_lines jl

            JOIN journal_entries je
                ON je.id = jl.journal_id

            WHERE
                je.company_id = $1

                AND jl.account_id = $2

                AND je.entry_date >= $3

                AND je.entry_date <= $4

                AND je.status = 'posted'

            ORDER BY
                je.entry_date,
                je.entry_no
            `,
            [
                companyId,
                accountId,
                fromDate,
                toDate
            ]
        );

    let balance = 0;

    const rows =
        result.rows.map(row => {

            balance +=
                Number(row.debit) -
                Number(row.credit);

            return {
                ...row,
                balance
            };

        });

    return rows;

}


module.exports = {
    accountLedger
};
