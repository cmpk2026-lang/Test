import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

function getMembers(householdId) {
  return db.prepare('SELECT id FROM users WHERE household_id = ?').all(householdId).map((u) => u.id);
}

function computeSplits({ splitType, amount, payerId, members, customSplits }) {
  if (splitType === 'personal') {
    return [{ userId: payerId, shareAmount: amount }];
  }
  if (splitType === 'custom') {
    if (!Array.isArray(customSplits) || customSplits.length === 0) {
      throw new Error('customSplits is required for custom split type');
    }
    const sum = customSplits.reduce((s, x) => s + Number(x.amount || 0), 0);
    if (Math.abs(sum - amount) > 0.01) {
      throw new Error(`Custom splits (${sum.toFixed(2)}) must add up to the total amount (${amount.toFixed(2)})`);
    }
    return customSplits.map((x) => ({ userId: x.userId, shareAmount: Number(x.amount) }));
  }
  // equal split across all household members
  const n = members.length;
  const base = Math.floor((amount / n) * 100) / 100;
  const splits = members.map((userId) => ({ userId, shareAmount: base }));
  const remainder = Math.round((amount - base * n) * 100) / 100;
  splits[0].shareAmount = Math.round((splits[0].shareAmount + remainder) * 100) / 100;
  return splits;
}

function serializeExpense(expense) {
  const splits = db
    .prepare('SELECT user_id AS userId, share_amount AS shareAmount FROM expense_splits WHERE expense_id = ?')
    .all(expense.id);
  return {
    id: expense.id,
    categoryId: expense.category_id,
    payerId: expense.payer_id,
    amount: expense.amount,
    description: expense.description,
    date: expense.date,
    splitType: expense.split_type,
    createdAt: expense.created_at,
    splits,
  };
}

router.get('/', (req, res) => {
  const { month, categoryId } = req.query;
  let sql = 'SELECT * FROM expenses WHERE household_id = ?';
  const params = [req.householdId];
  if (month) {
    sql += " AND substr(date, 1, 7) = ?";
    params.push(month);
  }
  if (categoryId) {
    sql += ' AND category_id = ?';
    params.push(categoryId);
  }
  sql += ' ORDER BY date DESC, id DESC';
  const expenses = db.prepare(sql).all(...params);
  res.json(expenses.map(serializeExpense));
});

router.post('/', (req, res) => {
  const { categoryId, payerId, amount, description, date, splitType, splits: customSplits } = req.body || {};
  if (!payerId || !amount || !date) {
    return res.status(400).json({ error: 'payerId, amount, and date are required' });
  }
  const amt = Number(amount);
  if (!(amt > 0)) return res.status(400).json({ error: 'amount must be a positive number' });

  const members = getMembers(req.householdId);
  if (!members.includes(Number(payerId))) {
    return res.status(400).json({ error: 'payerId must be a member of your household' });
  }

  let splits;
  try {
    splits = computeSplits({
      splitType: splitType || 'equal',
      amount: amt,
      payerId: Number(payerId),
      members,
      customSplits,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const result = db.transaction(() => {
    const expense = db
      .prepare(
        `INSERT INTO expenses (household_id, category_id, payer_id, amount, description, date, split_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.householdId, categoryId || null, payerId, amt, description || '', date, splitType || 'equal');
    const expenseId = expense.lastInsertRowid;
    const insertSplit = db.prepare(
      'INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES (?, ?, ?)'
    );
    for (const s of splits) insertSplit.run(expenseId, s.userId, s.shareAmount);
    return expenseId;
  })();

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result);
  res.status(201).json(serializeExpense(expense));
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM expenses WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  const { categoryId, payerId, amount, description, date, splitType, splits: customSplits } = req.body || {};
  const amt = amount !== undefined ? Number(amount) : existing.amount;
  const payer = payerId !== undefined ? Number(payerId) : existing.payer_id;
  const type = splitType || existing.split_type;
  const members = getMembers(req.householdId);
  if (!members.includes(payer)) {
    return res.status(400).json({ error: 'payerId must be a member of your household' });
  }

  let splits;
  try {
    splits = computeSplits({ splitType: type, amount: amt, payerId: payer, members, customSplits });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE expenses SET category_id = ?, payer_id = ?, amount = ?, description = ?, date = ?, split_type = ?
       WHERE id = ?`
    ).run(
      categoryId !== undefined ? categoryId : existing.category_id,
      payer,
      amt,
      description !== undefined ? description : existing.description,
      date || existing.date,
      type,
      existing.id
    );
    db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(existing.id);
    const insertSplit = db.prepare(
      'INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES (?, ?, ?)'
    );
    for (const s of splits) insertSplit.run(existing.id, s.userId, s.shareAmount);
  })();

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(existing.id);
  res.json(serializeExpense(expense));
});

router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM expenses WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  db.prepare('DELETE FROM expenses WHERE id = ?').run(existing.id);
  res.status(204).end();
});

export default router;
