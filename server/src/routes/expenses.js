import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

async function getMembers(householdId) {
  const result = await pool.query('SELECT id FROM users WHERE household_id = $1', [householdId]);
  return result.rows.map((u) => u.id);
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

async function serializeExpense(expense) {
  const splitsResult = await pool.query(
    'SELECT user_id AS "userId", share_amount AS "shareAmount" FROM expense_splits WHERE expense_id = $1',
    [expense.id]
  );
  return {
    id: expense.id,
    categoryId: expense.category_id,
    payerId: expense.payer_id,
    amount: expense.amount,
    description: expense.description,
    date: expense.date,
    splitType: expense.split_type,
    createdAt: expense.created_at,
    splits: splitsResult.rows,
  };
}

router.get('/', async (req, res) => {
  const { month, categoryId } = req.query;
  let sql = 'SELECT * FROM expenses WHERE household_id = $1';
  const params = [req.householdId];
  if (month) {
    params.push(month);
    sql += ` AND substr(date, 1, 7) = $${params.length}`;
  }
  if (categoryId) {
    params.push(categoryId);
    sql += ` AND category_id = $${params.length}`;
  }
  sql += ' ORDER BY date DESC, id DESC';
  const result = await pool.query(sql, params);
  res.json(await Promise.all(result.rows.map(serializeExpense)));
});

router.post('/', async (req, res) => {
  const { categoryId, payerId, amount, description, date, splitType, splits: customSplits } = req.body || {};
  if (!payerId || !amount || !date) {
    return res.status(400).json({ error: 'payerId, amount, and date are required' });
  }
  const amt = Number(amount);
  if (!(amt > 0)) return res.status(400).json({ error: 'amount must be a positive number' });

  const members = await getMembers(req.householdId);
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

  const client = await pool.connect();
  let expenseId;
  try {
    await client.query('BEGIN');
    const expenseResult = await client.query(
      `INSERT INTO expenses (household_id, category_id, payer_id, amount, description, date, split_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [req.householdId, categoryId || null, payerId, amt, description || '', date, splitType || 'equal']
    );
    expenseId = expenseResult.rows[0].id;
    for (const s of splits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES ($1, $2, $3)',
        [expenseId, s.userId, s.shareAmount]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const expenseResult = await pool.query('SELECT * FROM expenses WHERE id = $1', [expenseId]);
  res.status(201).json(await serializeExpense(expenseResult.rows[0]));
});

router.put('/:id', async (req, res) => {
  const existingResult = await pool.query('SELECT * FROM expenses WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.householdId,
  ]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  const { categoryId, payerId, amount, description, date, splitType, splits: customSplits } = req.body || {};
  const amt = amount !== undefined ? Number(amount) : existing.amount;
  const payer = payerId !== undefined ? Number(payerId) : existing.payer_id;
  const type = splitType || existing.split_type;
  const members = await getMembers(req.householdId);
  if (!members.includes(payer)) {
    return res.status(400).json({ error: 'payerId must be a member of your household' });
  }

  let splits;
  try {
    splits = computeSplits({ splitType: type, amount: amt, payerId: payer, members, customSplits });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE expenses SET category_id = $1, payer_id = $2, amount = $3, description = $4, date = $5, split_type = $6
       WHERE id = $7`,
      [
        categoryId !== undefined ? categoryId : existing.category_id,
        payer,
        amt,
        description !== undefined ? description : existing.description,
        date || existing.date,
        type,
        existing.id,
      ]
    );
    await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [existing.id]);
    for (const s of splits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES ($1, $2, $3)',
        [existing.id, s.userId, s.shareAmount]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const expenseResult = await pool.query('SELECT * FROM expenses WHERE id = $1', [existing.id]);
  res.json(await serializeExpense(expenseResult.rows[0]));
});

router.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND household_id = $2 RETURNING id', [
    req.params.id,
    req.householdId,
  ]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Expense not found' });
  res.status(204).end();
});

export default router;
