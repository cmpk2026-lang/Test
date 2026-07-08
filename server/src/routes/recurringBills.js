import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

function serialize(bill, month) {
  const payment = db
    .prepare('SELECT * FROM recurring_bill_payments WHERE recurring_bill_id = ? AND month = ?')
    .get(bill.id, month);
  return {
    id: bill.id,
    categoryId: bill.category_id,
    name: bill.name,
    amount: bill.amount,
    dueDay: bill.due_day,
    splitType: bill.split_type,
    active: !!bill.active,
    paidThisMonth: !!payment,
    payment: payment
      ? { paidBy: payment.paid_by, paidDate: payment.paid_date, amount: payment.amount }
      : null,
  };
}

router.get('/', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const bills = db
    .prepare('SELECT * FROM recurring_bills WHERE household_id = ? ORDER BY due_day')
    .all(req.householdId);
  res.json(bills.map((b) => serialize(b, month)));
});

router.post('/', (req, res) => {
  const { categoryId, name, amount, dueDay, splitType } = req.body || {};
  if (!name || !amount) return res.status(400).json({ error: 'name and amount are required' });
  const result = db
    .prepare(
      `INSERT INTO recurring_bills (household_id, category_id, name, amount, due_day, split_type)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.householdId, categoryId || null, name, Number(amount), dueDay || 1, splitType || 'equal');
  const bill = db.prepare('SELECT * FROM recurring_bills WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serialize(bill, new Date().toISOString().slice(0, 7)));
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM recurring_bills WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Recurring bill not found' });
  const { categoryId, name, amount, dueDay, splitType, active } = req.body || {};
  db.prepare(
    `UPDATE recurring_bills SET category_id = ?, name = ?, amount = ?, due_day = ?, split_type = ?, active = ?
     WHERE id = ?`
  ).run(
    categoryId !== undefined ? categoryId : existing.category_id,
    name || existing.name,
    amount !== undefined ? Number(amount) : existing.amount,
    dueDay !== undefined ? dueDay : existing.due_day,
    splitType || existing.split_type,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    existing.id
  );
  const bill = db.prepare('SELECT * FROM recurring_bills WHERE id = ?').get(existing.id);
  res.json(serialize(bill, new Date().toISOString().slice(0, 7)));
});

router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM recurring_bills WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Recurring bill not found' });
  db.prepare('DELETE FROM recurring_bills WHERE id = ?').run(existing.id);
  res.status(204).end();
});

router.post('/:id/pay', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM recurring_bills WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Recurring bill not found' });
  const { month, paidBy, amount, date } = req.body || {};
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  if (!paidBy) return res.status(400).json({ error: 'paidBy is required' });

  const existingPayment = db
    .prepare('SELECT * FROM recurring_bill_payments WHERE recurring_bill_id = ? AND month = ?')
    .get(existing.id, targetMonth);
  if (existingPayment) {
    return res.status(409).json({ error: 'This bill has already been marked paid for that month' });
  }

  const paidAmount = amount !== undefined ? Number(amount) : existing.amount;
  const paidDate = date || new Date().toISOString().slice(0, 10);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO recurring_bill_payments (recurring_bill_id, month, paid_by, paid_date, amount)
       VALUES (?, ?, ?, ?, ?)`
    ).run(existing.id, targetMonth, paidBy, paidDate, paidAmount);
    // Also log it as an actual expense so it counts toward budgets & balance
    db.prepare(
      `INSERT INTO expenses (household_id, category_id, payer_id, amount, description, date, split_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.householdId,
      existing.category_id,
      paidBy,
      paidAmount,
      existing.name,
      paidDate,
      existing.split_type
    );
    const expenseId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    const members = db.prepare('SELECT id FROM users WHERE household_id = ?').all(req.householdId).map((u) => u.id);
    const insertSplit = db.prepare(
      'INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES (?, ?, ?)'
    );
    if (existing.split_type === 'personal') {
      insertSplit.run(expenseId, paidBy, paidAmount);
    } else {
      const n = members.length;
      const base = Math.floor((paidAmount / n) * 100) / 100;
      const remainder = Math.round((paidAmount - base * n) * 100) / 100;
      members.forEach((userId, i) => {
        insertSplit.run(expenseId, userId, i === 0 ? Math.round((base + remainder) * 100) / 100 : base);
      });
    }
  })();

  const bill = db.prepare('SELECT * FROM recurring_bills WHERE id = ?').get(existing.id);
  res.status(201).json(serialize(bill, targetMonth));
});

export default router;
