const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// الميدلوير
app.use(cors()); // عشان الفرونت على github pages يقدر يكلم السيرفر
app.use(express.json());

// قاعدة البيانات SQLite
const dbPath = path.resolve(__dirname, 'jusoor.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('Connected to SQLite DB');
});

// انشاء الجداول لو مش موجودة
db.serialize(() => {
  // جدول الفواتير
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inv_no TEXT UNIQUE,
    customer TEXT NOT NULL,
    customer_phone TEXT,
    items TEXT,
    total REAL,
    type TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // جدول العملاء وكشف الحساب
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    phone TEXT,
    balance REAL DEFAULT 0
  )`);
});

// ============ API Routes ============

// 1. انشاء مسودة فاتورة من الصوت
app.post('/api/draft-invoice', (req, res) => {
  const { customer, customer_phone, items, total, type } = req.body;
  const inv_no = 'INV-' + Date.now();
  const itemsStr = JSON.stringify(items);

  db.run(`INSERT INTO invoices (inv_no, customer, customer_phone, items, total, type, status)
          VALUES (?,?,?,?,?,?,'draft')`,
  [inv_no, customer, customer_phone, itemsStr, total, type], function(err){
    if(err) return res.status(500).json({error: err.message});

    res.json({
      success: true,
      invoice: {id: this.lastID, inv_no, customer, items, total, type, status: 'draft'}
    });
  });
});

// 2. اعتماد الفاتورة + ترحيل القيد + تحديث رصيد العميل
app.post('/api/approve-invoice/:id', (req, res) => {
  const id = req.params.id;

  db.get(`SELECT * FROM invoices WHERE id =?`, [id], (err, invoice) => {
    if(err ||!invoice) return res.status(404).json({error: 'Invoice not found'});

    // 1. نحدث حالة الفاتورة
    db.run(`UPDATE invoices SET status='approved' WHERE id=?`, [id]);

    // 2. نحدث رصيد العميل
    const amount = invoice.type === 'نقدي'? 0 : invoice.total;
    db.run(`INSERT INTO customers (name, phone, balance) VALUES (?,?,?)
            ON CONFLICT(name) DO UPDATE SET balance = balance +?`,
    [invoice.customer, invoice.customer_phone, amount, amount]);

    // 3. هنا لاحقاً: نرسل واتساب + نطبع الفاتورة

    res.json({success: true, message: 'تم اعتماد الفاتورة وترحيلها', invoice_no: invoice.inv_no});
  });
});

// 3. جلب كل الفواتير
app.get('/api/invoices', (req, res) => {
  db.all(`SELECT * FROM invoices ORDER BY id DESC LIMIT 100`, [], (err, rows) => {
    if(err) return res.status(500).json({error: err.message});
    res.json(rows);
  });
});

// 4. جلب كشف حساب عميل
app.get('/api/customer/:name', (req, res) => {
  const name = req.params.name;
  db.get(`SELECT * FROM customers WHERE name =?`, [name], (err, row) => {
    if(err) return res.status(500).json({error: err.message});
    res.json(row || {name, balance: 0});
  });
});

// 5. رفع كشف بنك CSV للمطابقة - هنكمله لاحق
app.post('/api/upload-bank-statement', (req, res) => {
  res.json({message: 'سيتم اضافة المطابقة الذكية هنا'});
})

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({status: 'Jusoor API is Running', version: '1.0.0'});
});

app.listen(PORT, () => {
  console.log(`Jusoor Server running on http://localhost:${PORT}`);
});
