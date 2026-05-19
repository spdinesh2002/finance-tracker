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
    const { name, principal, interest_rate, period, debt_date, previous_interest = 0, interest_mode = 'auto', description = '' } = req.body;

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
      sql: `INSERT INTO finances (id, name, original_principal, remaining_principal, interest_rate, period, debt_date, last_interest_calc_date, accrued_interest, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, name.trim(), principal, principal, interest_rate, period, debt_date, calcDate, accrued, (description || '').trim()],
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

    const { to_interest = 0, to_principal = 0, description = '', date: customDate } = req.body;
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
    const paymentDate = customDate ? new Date(customDate).toISOString() : now;
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
      sql: `INSERT INTO payments (id, finance_id, date, amount, to_interest, to_principal, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [paymentId, finance.id, paymentDate, totalAmount, Math.round(actualInterest * 100) / 100, Math.round(actualPrincipal * 100) / 100, (description || '').trim()],
    });

    const updated = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [finance.id] });
    const payments = await db.execute({ sql: 'SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC', args: [finance.id] });
    res.json({ ...enrichWithInterest(updated.rows[0]), payments: payments.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Payment failed' });
  }
});

// ─── POST /api/finances/:id/settle ───
app.post('/api/finances/:id/settle', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [req.params.id] });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Finance record not found' });
    const finance = result.rows[0];

    if (finance.status === 'closed') return res.status(400).json({ error: 'This record is already closed' });

    const { description = '' } = req.body;
    const currentInterest = calculateCurrentInterest(finance);
    const remainingPrincipal = finance.remaining_principal;
    const totalAmount = Math.round((currentInterest + remainingPrincipal) * 100) / 100;
    const now = new Date().toISOString();
    const paymentId = genId();

    // Record the full settlement payment
    await db.execute({
      sql: `INSERT INTO payments (id, finance_id, date, amount, to_interest, to_principal, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [paymentId, finance.id, now, totalAmount, Math.round(currentInterest * 100) / 100, Math.round(remainingPrincipal * 100) / 100, (description || 'Settlement').trim()],
    });

    // Close the finance record
    await db.execute({
      sql: `UPDATE finances SET
              remaining_principal = 0,
              accrued_interest = 0,
              last_interest_calc_date = ?,
              total_interest_paid = total_interest_paid + ?,
              total_principal_paid = total_principal_paid + ?,
              status = 'closed',
              closed_date = ?
            WHERE id = ?`,
      args: [now, Math.round(currentInterest * 100) / 100, Math.round(remainingPrincipal * 100) / 100, now, finance.id],
    });

    const updated = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [finance.id] });
    const payments = await db.execute({ sql: 'SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC', args: [finance.id] });
    res.json({ ...enrichWithInterest(updated.rows[0]), payments: payments.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Settlement failed' });
  }
});

// ─── PUT /api/finances/:id ───
app.put('/api/finances/:id', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [req.params.id] });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const finance = result.rows[0];

    if (finance.status === 'closed') return res.status(400).json({ error: 'Cannot edit a closed record' });

    const { name, interest_rate, period, debt_date, remaining_principal, description } = req.body;

    if (!name || !interest_rate || !period || !debt_date || remaining_principal === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (interest_rate <= 0) return res.status(400).json({ error: 'Interest rate must be positive' });
    if (remaining_principal < 0) return res.status(400).json({ error: 'Principal cannot be negative' });
    if (!['weekly', 'monthly'].includes(period)) return res.status(400).json({ error: 'Period must be weekly or monthly' });

    // Settle current interest before changing rate/period/date
    const currentInterest = calculateCurrentInterest(finance);
    const now = new Date().toISOString();

    const desc = description !== undefined ? (description || '').trim() : (finance.description || '');

    await db.execute({
      sql: `UPDATE finances SET
              name = ?,
              interest_rate = ?,
              period = ?,
              debt_date = ?,
              remaining_principal = ?,
              accrued_interest = ?,
              last_interest_calc_date = ?,
              description = ?
            WHERE id = ?`,
      args: [
        name.trim(),
        interest_rate,
        period,
        debt_date,
        remaining_principal,
        currentInterest,
        now,
        desc,
        finance.id,
      ],
    });

    const updated = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [finance.id] });
    const payments = await db.execute({ sql: 'SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC', args: [finance.id] });
    res.json({ ...enrichWithInterest(updated.rows[0]), payments: payments.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// ─── PUT /api/finances/:fid/payments/:pid ───
app.put('/api/finances/:fid/payments/:pid', async (req, res) => {
  try {
    const finResult = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [req.params.fid] });
    if (finResult.rows.length === 0) return res.status(404).json({ error: 'Finance record not found' });
    const finance = finResult.rows[0];

    const payResult = await db.execute({ sql: 'SELECT * FROM payments WHERE id = ? AND finance_id = ?', args: [req.params.pid, req.params.fid] });
    if (payResult.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    const oldPayment = payResult.rows[0];

    const { to_interest = 0, to_principal = 0, description, date: customDate } = req.body;
    if (to_interest <= 0 && to_principal <= 0) {
      return res.status(400).json({ error: 'Enter at least one payment amount' });
    }

    // Reverse old payment effect
    const revertedPrincipal = Math.round((finance.remaining_principal + oldPayment.to_principal) * 100) / 100;
    const revertedInterestPaid = Math.round((finance.total_interest_paid - oldPayment.to_interest) * 100) / 100;
    const revertedPrincipalPaid = Math.round((finance.total_principal_paid - oldPayment.to_principal) * 100) / 100;

    // Validate new amounts against reverted state
    if (to_principal > revertedPrincipal + 0.01) {
      return res.status(400).json({ error: `Remaining principal after reverting is only ${revertedPrincipal.toFixed(2)}` });
    }

    // Apply new payment
    const newRemainingPrincipal = Math.round((revertedPrincipal - to_principal) * 100) / 100;
    const newTotalInterestPaid = Math.round((revertedInterestPaid + to_interest) * 100) / 100;
    const newTotalPrincipalPaid = Math.round((revertedPrincipalPaid + to_principal) * 100) / 100;
    const totalAmount = Math.round((to_interest + to_principal) * 100) / 100;
    const paymentDate = customDate ? new Date(customDate).toISOString() : oldPayment.date;
    const desc = description !== undefined ? (description || '').trim() : (oldPayment.description || '');

    // Update finance record
    await db.execute({
      sql: `UPDATE finances SET
              remaining_principal = ?,
              total_interest_paid = ?,
              total_principal_paid = ?
            WHERE id = ?`,
      args: [newRemainingPrincipal, newTotalInterestPaid, newTotalPrincipalPaid, finance.id],
    });

    // Update payment record
    await db.execute({
      sql: `UPDATE payments SET amount = ?, to_interest = ?, to_principal = ?, description = ?, date = ? WHERE id = ?`,
      args: [totalAmount, Math.round(to_interest * 100) / 100, Math.round(to_principal * 100) / 100, desc, paymentDate, oldPayment.id],
    });

    const updated = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [finance.id] });
    const payments = await db.execute({ sql: 'SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC', args: [finance.id] });
    res.json({ ...enrichWithInterest(updated.rows[0]), payments: payments.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// ─── DELETE /api/finances/:fid/payments/:pid ───
app.delete('/api/finances/:fid/payments/:pid', async (req, res) => {
  try {
    const finResult = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [req.params.fid] });
    if (finResult.rows.length === 0) return res.status(404).json({ error: 'Finance record not found' });
    const finance = finResult.rows[0];

    const payResult = await db.execute({ sql: 'SELECT * FROM payments WHERE id = ? AND finance_id = ?', args: [req.params.pid, req.params.fid] });
    if (payResult.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    const payment = payResult.rows[0];

    // Reverse payment effect on finance record
    const newRemainingPrincipal = Math.round((finance.remaining_principal + payment.to_principal) * 100) / 100;
    const newTotalInterestPaid = Math.round((finance.total_interest_paid - payment.to_interest) * 100) / 100;
    const newTotalPrincipalPaid = Math.round((finance.total_principal_paid - payment.to_principal) * 100) / 100;

    // If record was closed, reopen it
    await db.execute({
      sql: `UPDATE finances SET
              remaining_principal = ?,
              total_interest_paid = ?,
              total_principal_paid = ?,
              status = 'active',
              closed_date = NULL
            WHERE id = ?`,
      args: [newRemainingPrincipal, newTotalInterestPaid, newTotalPrincipalPaid, finance.id],
    });

    // Delete the payment
    await db.execute({ sql: 'DELETE FROM payments WHERE id = ?', args: [payment.id] });

    const updated = await db.execute({ sql: 'SELECT * FROM finances WHERE id = ?', args: [finance.id] });
    const payments = await db.execute({ sql: 'SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC', args: [finance.id] });
    res.json({ ...enrichWithInterest(updated.rows[0]), payments: payments.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete payment' });
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
