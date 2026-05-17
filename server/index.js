const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { db, initDB } = require('./database');
const { calculateCurrentInterest, enrichWithInterest } = require('./interest');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

// ─── Helper ───
function genId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function rowToObj(row) {
  // libSQL returns rows as arrays with .columns metadata
  // but with the client we use, rows come as objects already
  return row;
}

// ─── GET /api/finances ───
app.get('/api/finances', async (req, res) => {
  try {
    const { status } = req.query;
    let result;
    if (status && status !== 'all') {
      result = await db.execute({ sql: 'SELECT * FROM finances WHERE status = ? ORDER BY created_at DESC', args: [status] });
    } else {
      result = await db.execute('SELECT * FROM finances ORDER BY created_at DESC');
    }
    const enriched = result.rows.map(enrichWithInterest);
    res.json(enriched);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ─── GET /api/finances/:id ───
app.get('/api/finances/:id', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [req.params.id] });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const payments = await db.execute({ sql: 'SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC', args: [req.params.id] });
    const enriched = enrichWithInterest(result.rows[0]);
    res.json({ ...enriched, payments: payments.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

// ─── POST /api/finances ───
app.post('/api/finances', async (req, res) => {
  try {
    const { name, principal, interest_rate, period, debt_date, previous_interest = 0, interest_mode = 'auto' } = req.body;

    if (!name || !principal || !interest_rate || !period || !debt_date) {
      return res.status(400).json({ error: 'Missing required fields: name, principal, interest_rate, period, debt_date' });
    }
    if (principal <= 0 || interest_rate <= 0) {
      return res.status(400).json({ error: 'Principal and interest rate must be positive' });
    }
    if (!['weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Period must be weekly or monthly' });
    }

    // interest_mode = 'auto': interest calculated from debt_date (last_interest_calc_date = debt_date, accrued = 0)
    // interest_mode = 'manual': user provides previous_interest, new interest starts from today
    const calcDate = interest_mode === 'manual' ? new Date().toISOString() : debt_date;
    const accrued = interest_mode === 'manual' ? (previous_interest || 0) : 0;

    const id = genId();
    await db.execute({
      sql: `INSERT INTO finances (id, name, original_principal, remaining_principal, interest_rate, period, debt_date, last_interest_calc_date, accrued_interest)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, name.trim(), principal, principal, interest_rate, period, debt_date, calcDate, accrued],
    });

    const created = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [id] });
    res.status(201).json(enrichWithInterest(created.rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

// ─── POST /api/finances/:id/payments ───
app.post('/api/finances/:id/payments', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [req.params.id] });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Finance record not found' });
    const finance = result.rows[0];

    if (finance.status === 'closed') return res.status(400).json({ error: 'This record is already closed' });

    const { to_interest = 0, to_principal = 0 } = req.body;
    if (to_interest <= 0 && to_principal <= 0) {
      return res.status(400).json({ error: 'Enter at least one payment amount' });
    }

    const currentInterest = calculateCurrentInterest(finance);

    if (to_interest > currentInterest + 0.01) {
      return res.status(400).json({ error: `Interest due is only ${currentInterest.toFixed(2)}` });
    }
    if (to_principal > finance.remaining_principal + 0.01) {
      return res.status(400).json({ error: `Remaining principal is only ${finance.remaining_principal.toFixed(2)}` });
    }

    const actualInterest = Math.min(to_interest, currentInterest);
    const actualPrincipal = Math.min(to_principal, finance.remaining_principal);
    const totalAmount = Math.round((actualInterest + actualPrincipal) * 100) / 100;
    const now = new Date().toISOString();
    const paymentId = genId();

    const newRemainingPrincipal = Math.round((finance.remaining_principal - actualPrincipal) * 100) / 100;
    const newAccruedInterest = Math.round((currentInterest - actualInterest) * 100) / 100;
    const newStatus = (newRemainingPrincipal === 0 && newAccruedInterest === 0) ? 'closed' : 'active';

    await db.execute({
      sql: `UPDATE finances SET
              remaining_principal = ?,
              accrued_interest = ?,
              last_interest_calc_date = ?,
              total_interest_paid = total_interest_paid + ?,
              total_principal_paid = total_principal_paid + ?,
              status = ?,
              closed_date = ?
            WHERE id = ?`,
      args: [
        newRemainingPrincipal,
        newAccruedInterest,
        now,
        Math.round(actualInterest * 100) / 100,
        Math.round(actualPrincipal * 100) / 100,
        newStatus,
        newStatus === 'closed' ? now : null,
        finance.id,
      ],
    });

    await db.execute({
      sql: `INSERT INTO payments (id, finance_id, date, amount, to_interest, to_principal)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [paymentId, finance.id, now, totalAmount, Math.round(actualInterest * 100) / 100, Math.round(actualPrincipal * 100) / 100],
    });

    const updated = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [finance.id] });
    const payments = await db.execute({ sql: 'SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC', args: [finance.id] });
    res.json({ ...enrichWithInterest(updated.rows[0]), payments: payments.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Payment failed' });
  }
});

// ─── DELETE /api/finances/:id ───
app.delete('/api/finances/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM payments WHERE finance_id = ?', args: [req.params.id] });
    const result = await db.execute({ sql: 'DELETE FROM finances WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ─── SPA fallback ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// ─── Start ───
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Finance Tracker API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
