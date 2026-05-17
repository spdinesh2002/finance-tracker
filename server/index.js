const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');
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

// ─── GET /api/finances ───
app.get('/api/finances', (req, res) => {
  const { status } = req.query; // ?status=active|closed|all
  let rows;
  if (status && status !== 'all') {
    rows = db.prepare('SELECT * FROM finances WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM finances ORDER BY created_at DESC').all();
  }
  const enriched = rows.map(enrichWithInterest);
  res.json(enriched);
});

// ─── GET /api/finances/:id ───
app.get('/api/finances/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM finances WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const payments = db.prepare('SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC').all(req.params.id);
  const enriched = enrichWithInterest(row);
  res.json({ ...enriched, payments });
});

// ─── POST /api/finances ───
app.post('/api/finances', (req, res) => {
  const { name, principal, interest_rate, period, debt_date } = req.body;

  if (!name || !principal || !interest_rate || !period || !debt_date) {
    return res.status(400).json({ error: 'Missing required fields: name, principal, interest_rate, period, debt_date' });
  }
  if (principal <= 0 || interest_rate <= 0) {
    return res.status(400).json({ error: 'Principal and interest rate must be positive' });
  }
  if (!['weekly', 'monthly'].includes(period)) {
    return res.status(400).json({ error: 'Period must be weekly or monthly' });
  }

  const id = genId();
  db.prepare(`
    INSERT INTO finances (id, name, original_principal, remaining_principal, interest_rate, period, debt_date, last_interest_calc_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), principal, principal, interest_rate, period, debt_date, debt_date);

  const created = db.prepare('SELECT * FROM finances WHERE id = ?').get(id);
  res.status(201).json(enrichWithInterest(created));
});

// ─── POST /api/finances/:id/payments ───
app.post('/api/finances/:id/payments', (req, res) => {
  const finance = db.prepare('SELECT * FROM finances WHERE id = ?').get(req.params.id);
  if (!finance) return res.status(404).json({ error: 'Finance record not found' });
  if (finance.status === 'closed') return res.status(400).json({ error: 'This record is already closed' });

  const { to_interest = 0, to_principal = 0 } = req.body;

  if (to_interest <= 0 && to_principal <= 0) {
    return res.status(400).json({ error: 'Enter at least one payment amount' });
  }

  const currentInterest = calculateCurrentInterest(finance);

  if (to_interest > currentInterest + 0.01) {
    return res.status(400).json({ error: `Interest due is only ₹${currentInterest.toFixed(2)}` });
  }
  if (to_principal > finance.remaining_principal + 0.01) {
    return res.status(400).json({ error: `Remaining principal is only ₹${finance.remaining_principal.toFixed(2)}` });
  }

  const actualInterest = Math.min(to_interest, currentInterest);
  const actualPrincipal = Math.min(to_principal, finance.remaining_principal);
  const totalAmount = Math.round((actualInterest + actualPrincipal) * 100) / 100;
  const now = new Date().toISOString();
  const paymentId = genId();

  const newRemainingPrincipal = Math.round((finance.remaining_principal - actualPrincipal) * 100) / 100;
  const newAccruedInterest = Math.round((currentInterest - actualInterest) * 100) / 100;
  const newStatus = (newRemainingPrincipal === 0 && newAccruedInterest === 0) ? 'closed' : 'active';

  const update = db.transaction(() => {
    db.prepare(`
      UPDATE finances SET
        remaining_principal = ?,
        accrued_interest = ?,
        last_interest_calc_date = ?,
        total_interest_paid = total_interest_paid + ?,
        total_principal_paid = total_principal_paid + ?,
        status = ?,
        closed_date = ?
      WHERE id = ?
    `).run(
      newRemainingPrincipal,
      newAccruedInterest,
      now,
      Math.round(actualInterest * 100) / 100,
      Math.round(actualPrincipal * 100) / 100,
      newStatus,
      newStatus === 'closed' ? now : null,
      finance.id
    );

    db.prepare(`
      INSERT INTO payments (id, finance_id, date, amount, to_interest, to_principal)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(paymentId, finance.id, now, totalAmount, Math.round(actualInterest * 100) / 100, Math.round(actualPrincipal * 100) / 100);
  });

  update();

  const updated = db.prepare('SELECT * FROM finances WHERE id = ?').get(finance.id);
  const payments = db.prepare('SELECT * FROM payments WHERE finance_id = ? ORDER BY date DESC').all(finance.id);
  res.json({ ...enrichWithInterest(updated), payments });
});

// ─── DELETE /api/finances/:id ───
app.delete('/api/finances/:id', (req, res) => {
  const result = db.prepare('DELETE FROM finances WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─── SPA fallback: serve index.html for all non-API routes ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Finance Tracker API running on port ${PORT}`);
});
