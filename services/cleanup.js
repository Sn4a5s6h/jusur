// services/cleanup.js
const fs = require('fs');
const path = require('path');

function cleanupUploads(uploadDir, maxAgeMs = 3600000) {
    try {
        if (!fs.existsSync(uploadDir)) return;
        
        const now = Date.now();
        const files = fs.readdirSync(uploadDir);
        let deletedCount = 0;
        
        files.forEach(file => {
            const filePath = path.join(uploadDir, file);
            try {
                const stats = fs.statSync(filePath);
                if ((now - stats.mtimeMs) > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            } catch (e) {
                // تجاهل الملفات التي لا يمكن قراءتها
            }
        });
        
        if (deletedCount > 0) {
            console.log(`🗑️ تم حذف ${deletedCount} ملف مؤقت من ${uploadDir}`);
        }
    } catch (error) {
        console.error("CLEANUP ERROR:", error);
    }
}

function cleanupInvoices(invoiceDir, maxAgeMs = 30 * 24 * 60 * 60 * 1000) { // 30 يوم
    try {
        if (!fs.existsSync(invoiceDir)) return;
        
        const now = Date.now();
        const files = fs.readdirSync(invoiceDir);
        let deletedCount = 0;
        
        files.forEach(file => {
            const filePath = path.join(invoiceDir, file);
            try {
                const stats = fs.statSync(filePath);
                if ((now - stats.mtimeMs) > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            } catch (e) {
                // تجاهل الملفات التي لا يمكن قراءتها
            }
        });
        
        if (deletedCount > 0) {
            console.log(`🗑️ تم حذف ${deletedCount} فاتورة قديمة من ${invoiceDir}`);
        }
    } catch (error) {
        console.error("CLEANUP ERROR:", error);
    }
}

module.exports = { cleanupUploads, cleanupInvoices };
