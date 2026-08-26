const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// قاعدة البيانات
const db = new sqlite3.Database('./jusoor.db');
db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inv_no TEXT, customer TEXT, items TEXT, total REAL,
    type TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// انشاء فاتورة مسودة
app.post('/api/draft-invoice', (req, res) => {
    const { customer, items, total, type } = req.body;
    const inv_no = 'INV-' + Date.now();
    const itemsStr = JSON.stringify(items);
    db.run(`INSERT INTO invoices (inv_no, customer, items, total, type, status) VALUES (?,?,?,?,?,'draft')`,
    [inv_no, customer, itemsStr, total, type], function(err){
        if(err) return res.status(500).json({error: err.message});
        res.json({success: true, invoice: {id: this.lastID, inv_no, customer, items, total, type}});
    });
});

// اعتماد الفاتورة
app.post('/api/approve-invoice/:id', (req, res) => {
    db.run(`UPDATE invoices SET status='approved' WHERE id=?`, [req.params.id], function(){
        // هنا نضيف: ترحيل القيد + ارسال واتساب + طباعة
        res.json({success: true, message: 'تم اعتماد الفاتورة وترحيلها'});
    });
});

// جلب الفواتير
app.get('/api/invoices', (req, res) => {
    db.all(`SELECT * FROM invoices ORDER BY id DESC LIMIT 50`, [], (err, rows) => {
        res.json(rows);
    });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
