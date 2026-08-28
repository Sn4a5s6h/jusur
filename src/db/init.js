// src/db/init.js
const db = require("./index");

/*
|--------------------------------------------------------------------------
| INITIALIZE DATABASE
|--------------------------------------------------------------------------
|
| هذا الملف يقوم بتهيئة قاعدة البيانات وإضافة البيانات الافتراضية.
| يتم استدعاؤه من src/server.js عند بدء التشغيل.
|
| ملاحظة: جميع الجداول يتم إنشاؤها تلقائياً في db/index.js
| لذلك هذا الملف يركز فقط على البيانات الافتراضية.
|
|--------------------------------------------------------------------------
*/

function initializeDatabase() {
    console.log("🔄 جاري تهيئة قاعدة البيانات...");

    try {
        // ============================================
        // التحقق من وجود الشركة الافتراضية
        // ============================================
        let company = db.prepare(`
            SELECT * FROM companies ORDER BY id LIMIT 1
        `).get();

        if (!company) {
            const result = db.prepare(`
                INSERT INTO companies (name, legal_name, currency, country, status)
                VALUES (?, ?, ?, ?, ?)
            `).run("شركة جسور", "شركة جسور", "YER", "Yemen", "active");

            company = db.prepare(`
                SELECT * FROM companies WHERE id = ?
            `).get(Number(result.lastInsertRowid));

            console.log("✅ تم إنشاء الشركة الافتراضية");
        }

        // ============================================
        // التحقق من وجود السنة المالية
        // ============================================
        let fiscalYear = db.prepare(`
            SELECT * FROM fiscal_years
            WHERE company_id = ?
            ORDER BY is_current DESC, id DESC
            LIMIT 1
        `).get(company.id);

        if (!fiscalYear) {
            const year = new Date().getFullYear();
            const result = db.prepare(`
                INSERT INTO fiscal_years (company_id, name, start_date, end_date, status, is_current)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                company.id,
                String(year),
                `${year}-01-01`,
                `${year}-12-31`,
                "open",
                1
            );

            fiscalYear = db.prepare(`
                SELECT * FROM fiscal_years WHERE id = ?
            `).get(Number(result.lastInsertRowid));

            console.log("✅ تم إنشاء السنة المالية الافتراضية");
        }

        // ============================================
        // التحقق من وجود مستخدم افتراضي
        // ============================================
        const adminExists = db.prepare(`
            SELECT id FROM users WHERE username = 'admin'
        `).get();

        if (!adminExists) {
            const bcrypt = require("bcryptjs");
            const hashedPassword = bcrypt.hashSync("admin123", 12);

            const result = db.prepare(`
                INSERT INTO users (username, password_hash, full_name, role, status)
                VALUES (?, ?, ?, ?, ?)
            `).run("admin", hashedPassword, "مدير النظام", "admin", "active");

            // ربط المستخدم بالشركة
            db.prepare(`
                INSERT INTO user_companies (user_id, company_id, role, is_default)
                VALUES (?, ?, ?, ?)
            `).run(
                Number(result.lastInsertRowid),
                company.id,
                "admin",
                1
            );

            console.log("✅ تم إنشاء مستخدم افتراضي: admin / admin123");
        }

        // ============================================
        // التحقق من وجود الحسابات المحاسبية
        // ============================================
        const accountCount = db.prepare(`
            SELECT COUNT(*) AS count FROM accounts WHERE company_id = ?
        `).get(company.id).count;

        if (Number(accountCount) === 0) {
            const defaultAccounts = [
                ["1000", "الأصول", "asset"],
                ["1100", "الصندوق", "asset"],
                ["1200", "البنك", "asset"],
                ["1300", "العملاء", "asset"],
                ["1400", "المخزون", "asset"],
                ["2000", "الخصوم", "liability"],
                ["2100", "الموردون", "liability"],
                ["3000", "حقوق الملكية", "equity"],
                ["4000", "المبيعات", "revenue"],
                ["5000", "تكلفة المبيعات", "expense"],
                ["5100", "المصروفات", "expense"],
                ["5200", "المصروفات الإدارية", "expense"],
                ["5300", "المصروفات التشغيلية", "expense"]
            ];

            const insertAccount = db.prepare(`
                INSERT OR IGNORE INTO accounts (company_id, code, name, account_type)
                VALUES (?, ?, ?, ?)
            `);

            const insertAccounts = db.transaction(() => {
                for (const account of defaultAccounts) {
                    insertAccount.run(company.id, account[0], account[1], account[2]);
                }
            });

            insertAccounts();
            console.log("✅ تم إنشاء دليل الحسابات الافتراضي");
        }

        // ============================================
        // التحقق من وجود الصلاحيات الافتراضية
        // ============================================
        const permissionCount = db.prepare(`
            SELECT COUNT(*) AS count FROM permissions
        `).get().count;

        if (Number(permissionCount) === 0) {
            const defaultPermissions = [
                ["dashboard.view", "عرض لوحة التحكم", "الوصول إلى لوحة التحكم"],
                ["sales.view", "عرض المبيعات", "عرض فواتير المبيعات"],
                ["sales.create", "إنشاء المبيعات", "إنشاء فواتير المبيعات"],
                ["sales.cancel", "إلغاء المبيعات", "إلغاء فواتير المبيعات"],
                ["purchases.view", "عرض المشتريات", "عرض فواتير المشتريات"],
                ["purchases.create", "إنشاء المشتريات", "إنشاء فواتير المشتريات"],
                ["customers.view", "عرض العملاء", "عرض العملاء وكشوف الحساب"],
                ["customers.create", "إضافة العملاء", "إضافة العملاء"],
                ["suppliers.view", "عرض الموردين", "عرض الموردين"],
                ["suppliers.create", "إضافة الموردين", "إضافة الموردين"],
                ["products.view", "عرض الأصناف", "عرض الأصناف والمخزون"],
                ["products.create", "إضافة الأصناف", "إضافة أصناف جديدة"],
                ["inventory.adjust", "تسوية المخزون", "تعديل كميات المخزون"],
                ["payments.create", "تسجيل السداد", "تسجيل القبض والصرف"],
                ["journal.view", "عرض القيود", "عرض القيود اليومية"],
                ["reports.view", "عرض التقارير", "الوصول إلى التقارير المالية"],
                ["bank.view", "عرض البنك", "عرض عمليات البنك"],
                ["bank.import", "استيراد البنك", "استيراد كشوف البنك"],
                ["whatsapp.view", "عرض WhatsApp", "إدارة رسائل WhatsApp"],
                ["whatsapp.manage", "إدارة WhatsApp", "إدارة حسابات WhatsApp"],
                ["ai.use", "استخدام الذكاء الاصطناعي", "تحليل المعاملات بالذكاء الاصطناعي"],
                ["audit.view", "سجل التدقيق", "عرض سجل العمليات"],
                ["settings.manage", "الإعدادات", "إدارة إعدادات النظام"],
                ["users.manage", "إدارة المستخدمين", "إضافة وإدارة المستخدمين"],
                ["companies.manage", "إدارة الشركات", "إضافة وتعديل الشركات"],
                ["fiscal_year.manage", "إدارة السنوات المالية", "فتح وإغلاق السنوات المالية"]
            ];

            const insertPermission = db.prepare(`
                INSERT OR IGNORE INTO permissions (code, name, description)
                VALUES (?, ?, ?)
            `);

            const insertPermissions = db.transaction(() => {
                for (const permission of defaultPermissions) {
                    insertPermission.run(permission[0], permission[1], permission[2]);
                }
            });

            insertPermissions();
            console.log("✅ تم إنشاء الصلاحيات الافتراضية");
        }

        console.log("✅ تم تهيئة قاعدة البيانات بنجاح");
        return true;
    } catch (error) {
        console.error("❌ خطأ في تهيئة قاعدة البيانات:", error.message);
        throw error;
    }
}

module.exports = { initializeDatabase };
