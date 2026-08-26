const db = require("../db");

/**
 * إنشاء قيد يومية متوازن
 *
 * كل قيد يجب أن يكون:
 * مجموع المدين = مجموع الدائن
 */
function createJournalEntry({
    reference_type,
    reference_id,
    description,
    lines
}) {
    if (!Array.isArray(lines) || lines.length < 2) {
        throw new Error("القيد يجب أن يحتوي على سطرين محاسبيين على الأقل");
    }

    const totalDebit = lines.reduce(
        (sum, line) => sum + Number(line.debit || 0),
        0
    );

    const totalCredit = lines.reduce(
        (sum, line) => sum + Number(line.credit || 0),
        0
    );

    // السماح بفارق صغير جدًا بسبب الكسور العشرية
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(
            `القيد غير متوازن: المدين ${totalDebit} والدائن ${totalCredit}`
        );
    }

    const transaction = db.transaction(() => {

        const entry = db.prepare(`
            INSERT INTO journal_entries
            (
                reference_type,
                reference_id,
                description
            )
            VALUES (?, ?, ?)
        `).run(
            reference_type || null,
            reference_id || null,
            description || ""
        );

        const journalId = entry.lastInsertRowid;

        const insertLine = db.prepare(`
            INSERT INTO journal_lines
            (
                journal_id,
                account_code,
                account_name,
                debit,
                credit
            )
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const line of lines) {

            if (!line.account_code) {
                throw new Error("رمز الحساب مطلوب");
            }

            if (!line.account_name) {
                throw new Error("اسم الحساب مطلوب");
            }

            const debit = Number(line.debit || 0);
            const credit = Number(line.credit || 0);

            if (debit < 0 || credit < 0) {
                throw new Error("القيم المحاسبية لا يمكن أن تكون سالبة");
            }

            if (debit > 0 && credit > 0) {
                throw new Error(
                    `الحساب ${line.account_name} لا يمكن أن يكون مدينًا ودائنًا في نفس السطر`
                );
            }

            insertLine.run(
                journalId,
                line.account_code,
                line.account_name,
                debit,
                credit
            );
        }

        return journalId;
    });

    const journalId = transaction();

    return db.prepare(`
        SELECT *
        FROM journal_entries
        WHERE id = ?
    `).get(journalId);
}


/**
 * جلب تفاصيل قيد
 */
function getJournalEntry(journalId) {

    const entry = db.prepare(`
        SELECT *
        FROM journal_entries
        WHERE id = ?
    `).get(journalId);

    if (!entry) {
        return null;
    }

    const lines = db.prepare(`
        SELECT *
        FROM journal_lines
        WHERE journal_id = ?
        ORDER BY id
    `).all(journalId);

    return {
        ...entry,
        lines
    };
}


/**
 * التحقق من توازن قيد موجود
 */
function validateJournalEntry(journalId) {

    const result = db.prepare(`
        SELECT
            COALESCE(SUM(debit), 0) AS debit,
            COALESCE(SUM(credit), 0) AS credit
        FROM journal_lines
        WHERE journal_id = ?
    `).get(journalId);

    return {
        balanced:
            Math.abs(
                Number(result.debit) -
                Number(result.credit)
            ) <= 0.001,

        debit: Number(result.debit),

        credit: Number(result.credit)
    };
}


module.exports = {
    createJournalEntry,
    getJournalEntry,
    validateJournalEntry
};
