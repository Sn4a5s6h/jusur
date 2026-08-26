function validateTransaction(data) {
    const errors = [];

    if (!data || typeof data !== "object") {
        return {
            valid: false,
            errors: ["بيانات العملية غير صحيحة"]
        };
    }

    if (!data.intent || data.intent === "unknown") {
        errors.push("لم أتمكن من تحديد نوع العملية");
    }

    if (
        data.intent === "sales_invoice" &&
        !data.customer
    ) {
        errors.push("اسم العميل مطلوب");
    }

    if (
        data.intent === "sales_invoice" &&
        (!Array.isArray(data.items) || data.items.length === 0)
    ) {
        errors.push("يجب إضافة صنف واحد على الأقل");
    }

    if (Array.isArray(data.items)) {
        data.items.forEach((item, index) => {
            if (!item.name) {
                errors.push(`اسم الصنف رقم ${index + 1} مطلوب`);
            }

            if (
                !Number.isFinite(Number(item.qty)) ||
                Number(item.qty) <= 0
            ) {
                errors.push(`كمية الصنف ${index + 1} غير صحيحة`);
            }

            if (
                !Number.isFinite(Number(item.price)) ||
                Number(item.price) < 0
            ) {
                errors.push(`سعر الصنف ${index + 1} غير صحيح`);
            }
        });
    }

    if (
        data.type &&
        !["cash", "credit"].includes(data.type)
    ) {
        errors.push("نوع البيع غير صحيح");
    }

    if (
        data.intent === "sales_invoice" &&
        data.type === "credit" &&
        !data.due_date &&
        !data.due_days
    ) {
        errors.push("عملية الآجل تحتاج تاريخ أو مدة استحقاق");
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateTransaction
};
