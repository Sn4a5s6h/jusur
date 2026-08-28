// services/email.js
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return transporter;
}

async function sendInvoiceEmail(to, invoiceNo, pdfPath, customerName) {
    try {
        const transporter = getTransporter();
        
        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@jusoor.com',
            to,
            subject: `فاتورة رقم ${invoiceNo}`,
            html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2c3e50; text-align: center;">🌉 جسور للمحاسبة</h2>
                    <hr style="border: 1px solid #e0e0e0;">
                    <p>السيد/السيدة <strong>${customerName || 'العميل'}</strong>،</p>
                    <p>نشكركم على تعاملكم معنا. نرفق لكم فاتورتكم رقم <strong>${invoiceNo}</strong>.</p>
                    <p>للاستفسارات، يرجى التواصل معنا على الرقم: <strong>${process.env.COMPANY_PHONE || '05xxxxxxxx'}</strong></p>
                    <hr style="border: 1px solid #e0e0e0;">
                    <p style="text-align: center; color: #7f8c8d; font-size: 12px;">
                        هذا البريد إلكتروني آلي، يرجى عدم الرد عليه.
                    </p>
                </div>
            `,
            attachments: [{
                filename: `invoice-${invoiceNo}.pdf`,
                path: pdfPath
            }]
        });
        
        console.log(`📧 تم إرسال الفاتورة ${invoiceNo} إلى ${to}`);
        return true;
    } catch (error) {
        console.error("EMAIL ERROR:", error);
        return false;
    }
}

async function sendPaymentConfirmation(to, invoiceNo, amount, method) {
    try {
        const transporter = getTransporter();
        
        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@jusoor.com',
            to,
            subject: `تأكيد استلام الدفع - فاتورة ${invoiceNo}`,
            html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2c3e50; text-align: center;">🌉 جسور للمحاسبة</h2>
                    <hr style="border: 1px solid #e0e0e0;">
                    <p>تم استلام مبلغ <strong>${amount}</strong> ريال</p>
                    <p>عن طريق: <strong>${method}</strong></p>
                    <p>للفاتورة رقم: <strong>${invoiceNo}</strong></p>
                    <hr style="border: 1px solid #e0e0e0;">
                    <p style="text-align: center; color: #7f8c8d; font-size: 12px;">
                        هذا البريد إلكتروني آلي، يرجى عدم الرد عليه.
                    </p>
                </div>
            `
        });
        
        console.log(`📧 تم إرسال تأكيد الدفع للفاتورة ${invoiceNo} إلى ${to}`);
        return true;
    } catch (error) {
        console.error("EMAIL ERROR:", error);
        return false;
    }
}

module.exports = { sendInvoiceEmail, sendPaymentConfirmation };
