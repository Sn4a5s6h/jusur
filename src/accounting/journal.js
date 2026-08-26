function validateLines(lines) {

    if (
        !Array.isArray(lines) ||
        lines.length < 2
    ) {
        throw new Error(
            "القيد يجب أن يحتوي على سطرين على الأقل"
        );
    }

    let debit = 0;
    let credit = 0;

    for (const line of lines) {

        const d =
            Number(line.debit || 0);

        const c =
            Number(line.credit || 0);

        if (d < 0 || c < 0) {
            throw new Error(
                "القيم المحاسبية لا يمكن أن تكون سالبة"
            );
        }

        if (d > 0 && c > 0) {
            throw new Error(
                "لا يجوز أن يكون الحساب مدينًا ودائنًا في نفس السطر"
            );
        }

        debit += d;
        credit += c;

    }

    const difference =
        Math.abs(debit - credit);

    if (difference > 0.0001) {

        throw new Error(
            `القيد غير متوازن: المدين ${debit} والدائن ${credit}`
        );

    }

    return {
        debit,
        credit
    };

}


async function postJournal(
    client,
    {
        companyId,
        fiscalPeriodId,
        entryDate,
        description,
        referenceType,
        referenceId,
        lines
    }
) {

    validateLines(lines);

    const entryResult =
        await client.query(
            `
            INSERT INTO journal_entries
            (
                company_id,
                fiscal_period_id,
                entry_date,
                description,
                reference_type,
                reference_id
            )
            VALUES
            ($1,$2,$3,$4,$5,$6)
            RETURNING *
            `,
            [
                companyId,
                fiscalPeriodId,
                entryDate,
                description,
                referenceType || null,
                referenceId || null
            ]
        );

    const entry =
        entryResult.rows[0];

    for (const line of lines) {

        await client.query(
            `
            INSERT INTO journal_lines
            (
                journal_id,
                account_id,
                description,
                debit,
                credit
            )
            VALUES
            ($1,$2,$3,$4,$5)
            `,
            [
                entry.id,
                line.accountId,
                line.description || null,
                Number(line.debit || 0),
                Number(line.credit || 0)
            ]
        );

    }

    return entry;

}

module.exports = {
    validateLines,
    postJournal
};
