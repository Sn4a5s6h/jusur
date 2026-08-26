const express = require('express');
const Database = require('better-sqlite3'); // اسرع وما يحتاج build
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/invoices', express.static('invoices'));

const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('invoices')) fs.mkdirSync('invoices');

// قاعدة البيانات better-sqlite3
const db = new Database('jusoor.db', { verbose: console.log });

// انشاء الجداول
db.exec(`
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT, 
  inv_no TEXT UNIQUE, 
  customer TEXT, 
  customer_phone TEXT, 
  items TEXT, 
  total REAL, 
  type TEXT, 
  status TEXT DEFAULT 'draft', 
  pdf_path TEXT, 
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, 
  name TEXT UNIQUE, 
  phone TEXT, 
  balance REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, 
  amount REAL, 
  description TEXT, 
  date TEXT, 
  matched_inv_id INTEGER, 
  status TEXT DEFAULT 'unmatched'
);
`);

// دالة توليد PDF حراري 80mm
const generatePDF = (invoice) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: [226, 400], margin: 10 });
    const filePath = `invoices/${invoice.inv_no}.pdf`;
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(12).text('🌉 جسور', { align: 'center' });
    doc.fontSize(8).text('فاتورة مبيعات', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).text(`رقم: ${invoice.inv_no}`);
    doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-SA')}`);
    doc.text(`العميل: ${invoice.customer}`);
    doc.moveDown(0.5);
    doc.text('--------------------------------');

    const items = JSON.parse(invoice.items);
    items.forEach(item => {
      doc.text(`${item.qty} x ${item.name} = ${item.qty * item.price} ريال`);
    });

    doc.text('--------------------------------');
    doc.fontSize(10).text(`الاجمالي: ${invoice.total} ريال - ${invoice.type}`, { align: 'right' });
    doc.moveDown(1);
    doc.fontSize(8).text('شكرا لتعاملكم معنا', { align: 'center' });
    doc.end();

    stream.on('finish', () => resolve(filePath));
  });
};

// 1. انشاء مسودة
app.post('/api/draft-invoice', (req, res) => {
  const { customer, customer_phone, items, total, type } = req.body;
  const inv_no = 'INV-' + Date.now();
  const stmt = db.prepare(`INSERT INTO invoices (inv_no, customer, customer_phone, items, total, type) VALUES (?,?,?,?,?,?)`);
  const result = stmt.run(inv_no, customer, customer_phone, JSON.stringify(items), total, type);
  res.json({success: true, invoice: {id: result.lastInsertRowid, inv_no, customer, items, total, type}});
});

// 2. اعتماد + توليد PDF
app.post('/api/approve-invoice/:id', async (req, res) => {
  const id = req.params.id;
  const invoice = db.prepare(`SELECT * FROM invoices WHERE id =?`).get(id);
  if(!invoice) return res.status(404).json({error: 'غير موجود'});

  const pdfPath = await generatePDF(invoice);
  db.prepare(`UPDATE invoices SET status='approved', pdf_path=? WHERE id=?`).run(pdfPath, id);

  const amount = invoice.type === 'أجل'? invoice.total : 0;
  db.prepare(`INSERT INTO customers (name, phone, balance) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET balance = balance +?, phone=excluded.phone`)
  .run(invoice.customer, invoice.customer_phone, amount, amount);

  res.json({success: true, pdf_url: `https://jusur.onrender.com/${pdfPath}`});
});

// 3. رفع كشف بنك CSV + مطابقة
app.post('/api/upload-bank', upload.single('file'), (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
   .pipe(csv())
   .on('data', (data) => results.push(data))
   .on('end', () => {
      results.forEach(row => {
        const amount = parseFloat(row.Amount || row.amount);
        const desc = row.Description || row.desc;
        const date = row.Date || row.date;

        const inv = db.prepare(`SELECT * FROM invoices WHERE total=? AND status='approved'`).get(amount);
        if(inv){
          db.prepare(`UPDATE invoices SET status='paid' WHERE id=?`).run(inv.id);
          db.prepare(`UPDATE customers SET balance = balance -? WHERE name=?`).run(amount, inv.customer);
        } else {
          db.prepare(`INSERT INTO bank_transactions (amount, description, date) VALUES (?,?,?)`).run(amount, desc, date);
        }
      });
      fs.unlinkSync(req.file.path); // امسح الملف بعد الرفع
      res.json({success: true, count: results.length});
    });
});

// 4. جلب كشف حساب
app.get('/api/customer/:name', (req, res) => {
  const customer = db.prepare(`SELECT * FROM customers WHERE name =?`).get(req.params.name);
  res.json({customer: customer || {name: req.params.name, balance: 0}});
});

app.get('/', (req, res) => res.json({status: 'Jusoor API is Running', version: '1.0.3'}));
app.listen(PORT, () => console.log(`🌉 Jusoor running on ${PORT}`));
