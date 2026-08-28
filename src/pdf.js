// src/pdf.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function generateInvoicePDF(invoice, items, outputDir) {
    return new Promise((resolve, reject) => {
        try {
            // تأكد من وجود مجلد الإخراج
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const fileName = `invoice-${invoice.inv_no}.pdf`;
            const filePath = path.join(outputDir, fileName);

            // إنشاء مستند PDF بحجم A4
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // ============================================
            // الترويسة - محلات الغانم
            // ============================================
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text('ALGANIM STORS FOR TRADING', { align: 'center' });

            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text('محلات الغانم للتجارة العامة', { align: 'center' });

            doc.moveDown(0.5);

            doc.fontSize(11)
               .font('Helvetica')
               .text('صنعاء - شعوب - الصياح', { align: 'center' })
               .text('تلفون : 777463289', { align: 'center' })
               .text('لبيع جميع انواع البقوليات والبهارات', { align: 'center' })
               .text('و المكسرات جملة - تجزئة', { align: 'center' });

            doc.moveDown(0.5);

            // خط فاصل
            doc.strokeColor('#000000')
               .lineWidth(1)
               .moveTo(50, doc.y)
               .lineTo(550, doc.y)
               .stroke();

            doc.moveDown(0.5);

            // ============================================
            // معلومات الاتصال
            // ============================================
            doc.fontSize(10)
               .font('Helvetica')
               .text(`Tele No.777463289`, { align: 'left' })
               .text(`Fax No`, { align: 'left' })
               .text(`P.O.Box`, { align: 'left' });

            doc.moveDown(0.5);

            // ============================================
            // عنوان الفاتورة
            // ============================================
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('فاتورة المبيعات أجل', { align: 'center' });

            doc.moveDown(0.5);

            // ============================================
            // معلومات الفاتورة
            // ============================================
            doc.fontSize(10)
               .font('Helvetica')
               .text(`رقم الفاتورة : ${invoice.inv_no || 'N/A'}`, { align: 'right' })
               .text(`تاريخ : ${new Date(invoice.created_at || Date.now()).toLocaleDateString('ar-EG')}`, { align: 'right' })
               .text(`نوع الفاتورة : ${invoice.type === 'credit' ? 'أجل' : 'نقدي'}`, { align: 'right' });

            doc.moveDown(0.3);

            // ============================================
            // العملة
            // ============================================
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .text('YER : العملة', { align: 'left' });

            doc.moveDown(0.5);

            // ============================================
            // جدول المنتجات
            // ============================================
            const tableTop = doc.y;
            const tableHeaders = [
                { text: 'رقم الصنف', width: 70 },
                { text: 'اسم الصنف', width: 120 },
                { text: 'الوحدة', width: 50 },
                { text: 'الكمية', width: 50 },
                { text: 'ك.المجانية', width: 60 },
                { text: 'السعر', width: 70 },
                { text: 'الإجمالي', width: 80 }
            ];

            // رسم رأس الجدول
            let x = 50;
            const headerY = tableTop;

            // خلفية الرأس
            doc.fillColor('#f0f0f0')
               .rect(50, headerY, 500, 20)
               .fill();

            // نصوص الرأس
            doc.fillColor('#000000')
               .fontSize(9)
               .font('Helvetica-Bold');

            tableHeaders.forEach(header => {
                doc.text(header.text, x, headerY + 5, {
                    width: header.width,
                    align: 'center'
                });
                x += header.width;
            });

            // ============================================
            // صفوف البيانات
            // ============================================
            let y = headerY + 25;
            doc.fontSize(9)
               .font('Helvetica');

            items.forEach((item, index) => {
                const row = [
                    item.code || `001-${String(index + 1).padStart(4, '0')}`,
                    item.name || 'غير محدد',
                    item.unit || 'قطعة',
                    String(item.qty || 0),
                    '0.00',
                    (item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    ((item.qty || 0) * (item.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })
                ];

                let xPos = 50;
                row.forEach((text, i) => {
                    doc.text(text, xPos, y, {
                        width: tableHeaders[i].width,
                        align: 'center'
                    });
                    xPos += tableHeaders[i].width;
                });

                y += 20;

                // إذا كان هناك منتجات كثيرة، أضف صفحة جديدة
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                    // إعادة رسم الرأس في الصفحة الجديدة
                }
            });

            // ============================================
            // الإجماليات
            // ============================================
            const subtotal = items.reduce((sum, item) => sum + (item.qty || 0) * (item.price || 0), 0);
            const discount = invoice.discount || 0;
            const tax = invoice.tax || 0;
            const total = subtotal - discount + tax;
            const paid = invoice.paid || 0;
            const remaining = total - paid;

            const totalsY = Math.max(y + 20, 600);

            doc.fontSize(10)
               .font('Helvetica');

            // الإجمالي
            doc.text(`الإجمالي : ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 400, totalsY, { align: 'right' });
            doc.text(`الخصم : ${discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 400, totalsY + 20, { align: 'right' });

            // ============================================
            // المبلغ كتابة
            // ============================================
            const totalWords = numberToArabicWords(total);

            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text(`${totalWords} ريال يمني`, 50, totalsY + 60, {
                   align: 'center',
                   width: 500
               });

            // ============================================
            // المبلغ بالأرقام
            // ============================================
            doc.fontSize(10)
               .font('Helvetica')
               .text(`${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} YER`, 50, totalsY + 85, {
                   align: 'center',
                   width: 500
               });

            // ============================================
            // التواقيع
            // ============================================
            const signY = totalsY + 130;

            // خطوط التوقيع
            const signatures = [
                { label: 'المحاسب', x: 80 },
                { label: 'المحاسب', x: 180 },
                { label: 'المخازن', x: 280 },
                { label: 'المخازن', x: 380 },
                { label: 'المخازن', x: 480 }
            ];

            signatures.forEach(sig => {
                doc.moveTo(sig.x, signY)
                   .lineTo(sig.x + 60, signY)
                   .stroke();
                doc.fontSize(8)
                   .text(sig.label, sig.x, signY + 5, { width: 60, align: 'center' });
            });

            // ============================================
            // التوقيعات السفلية
            // ============================================
            const bottomSignY = signY + 40;

            const bottomSignatures = [
                { label: 'مدير المبيعات', x: 130 },
                { label: 'مدير الحسابات', x: 280 },
                { label: 'العمل', x: 430 }
            ];

            bottomSignatures.forEach(sig => {
                doc.moveTo(sig.x, bottomSignY)
                   .lineTo(sig.x + 100, bottomSignY)
                   .stroke();
                doc.fontSize(8)
                   .text(sig.label, sig.x, bottomSignY + 5, { width: 100, align: 'center' });
            });

            // ============================================
            // إنهاء المستند
            // ============================================
            doc.end();

            stream.on('finish', () => {
                resolve(filePath);
            });

            stream.on('error', (error) => {
                reject(error);
            });

        } catch (error) {
            reject(error);
        }
    });
}

// ============================================
// دالة تحويل الأرقام إلى كلمات عربية
// ============================================
function numberToArabicWords(number) {
    if (number === 0) return 'صفر';

    const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    let num = Math.floor(number);
    let words = '';

    if (num >= 1000) {
        const thousands = Math.floor(num / 1000);
        if (thousands === 1) {
            words += 'ألف ';
        } else if (thousands === 2) {
            words += 'ألفان ';
        } else if (thousands >= 3 && thousands <= 10) {
            words += units[thousands] + ' آلاف ';
        } else {
            words += numberToArabicWords(thousands) + ' ألف ';
        }
        num %= 1000;
    }

    if (num >= 100) {
        const hundredsDigit = Math.floor(num / 100);
        words += hundreds[hundredsDigit] + ' ';
        num %= 100;
    }

    if (num >= 20) {
        const tensDigit = Math.floor(num / 10);
        const unitDigit = num % 10;
        if (unitDigit > 0) {
            words += units[unitDigit] + ' و ' + tens[tensDigit] + ' ';
        } else {
            words += tens[tensDigit] + ' ';
        }
    } else if (num >= 10) {
        if (num === 10) {
            words += 'عشرة ';
        } else {
            const unitDigit = num % 10;
            if (unitDigit === 1) {
                words += 'أحد عشر ';
            } else if (unitDigit === 2) {
                words += 'اثنا عشر ';
            } else {
                words += units[unitDigit] + ' ' + tens[1] + ' ';
            }
        }
    } else if (num > 0) {
        words += units[num] + ' ';
    }

    return words.trim();
}

module.exports = { generateInvoicePDF, numberToArabicWords };
