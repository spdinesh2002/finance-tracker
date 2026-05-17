const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'finance.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS finances (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_principal REAL NOT NULL,
    remaining_principal REAL NOT NULL,
    interest_rate REAL NOT NULL,
    period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly')),
    debt_date TEXT NOT NULL,
    total_interest_paid REAL DEFAULT 0,
    total_principal_paid REAL DEFAULT 0,
    accrued_interest REAL DEFAULT 0,
    last_interest_calc_date TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed')),
    closed_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    finance_id TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    to_interest REAL DEFAULT 0,
    to_principal REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (finance_id) REFERENCES finances(id) ON DELETE CASCADE
  );
`);

module.exports = db;
