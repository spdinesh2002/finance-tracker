const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_URL || 'libsql://finance-tracker-spdinesh2002.aws-ap-south-1.turso.io',
  authToken: process.env.TURSO_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzkwMTEzMjQsImlkIjoiMDE5ZTM1NTYtNWQwMS03MzRlLWJmZDEtYWYzODlhNjU2ZjdkIiwicmlkIjoiZTQ1MzQ4YjYtZTYxYy00MjgxLTk1ZDEtM2RiNWY3YTRiNjUwIn0.nGjoSnBgvUQqIZ7hfmA8lWuum2mjRDyow2Sdm5C3j726tcBBXat4U7JQ4DgR74TrZTqT--OOsJgTRSny5kC5AA',
});

async function initDB() {
  await db.execute(`
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
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      finance_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      to_interest REAL DEFAULT 0,
      to_principal REAL DEFAULT 0,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (finance_id) REFERENCES finances(id) ON DELETE CASCADE
    )
  `);

  // Migration: add description column if missing (existing tables)
  try {
    await db.execute(`ALTER TABLE payments ADD COLUMN description TEXT DEFAULT ''`);
  } catch (e) {
    // Column already exists, ignore
  }
}

module.exports = { db, initDB };
