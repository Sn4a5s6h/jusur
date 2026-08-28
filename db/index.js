// db/index.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');

const db = new Database(DB_PATH);

// تمكين القيود الخارجية
db.pragma('foreign_keys = ON');

module.exports = db;
