import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

async function serialize(bill, month) {
  const paymentResult = await pool.query(
    'SELECT * FROM recurring_bill_payments WHERE recurring_bill_id = $1 AND month = $2',
    [bill.id, month]
  );
  const payment = paymentResult.rows[0];
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

router.get('/', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const result = await pool.query(
    'SELECT * FROM recurring_bills WHERE household_id = $1 ORDER BY due_day',
    [req.householdId]
  );
  res.json(await Promise.all(result.rows.map((b) => serialize(b, month))));
});

router.post('/', async (req, res) => {
  const { categoryId, name, amount, dueDay, splitType } = req.body || {};
  if (!name || !amount) return res.status(400).json({ error: 'name and amount are required' });
  const result = await pool.query(
    `INSERT INTO recurring_bills (household_id, category_id, name, amount, due_day, split_type)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.householdId, categoryId || null, name, Number(amount), dueDay || 1, splitType || 'equal']
  );
  res.status(201).json(await serialize(result.rows[0], new Date().toISOString().slice(0, 7)));
});

router.put('/:id', async (req, res) => {
  const existingResult = await pool.query(
    'SELECT * FROM recurring_bills WHERE id = $1 AND household_id = $2',
    [req.params.id, req.householdId]
  );
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Recurring bill not found' });
  const { categoryId, name, amount, dueDay, splitType, active } = req.body || {};
  const result = await pool.query(
    `UPDATE recurring_bills SET category_id = $1, name = $2, amount = $3, due_day = $4, split_type = $5, active = $6
     WHERE id = $7 RETURNING *`,
    [
      categoryId !== undefined ? categoryId : existing.category_id,
      name || existing.name,
      amount !== undefined ? Number(amount) : existing.amount,
      dueDay !== undefined ? dueDay : existing.due_day,
      splitType || existing.split_type,
      active !== undefined ? !!active : existing.active,
      existing.id,
    ]
  );
  res.json(await serialize(result.rows[0], new Date().toISOString().slice(0, 7)));
});

router.delete('/:id', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM recurring_bills WHERE id = $1 AND household_id = $2 RETURNING id',
    [req.params.id, req.householdId]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Recurring bill not found' });
  res.status(204).end();
});

router.post('/:id/pay', async (req, res) => {
  const existingResult = await pool.query(
    'SELECT * FROM recurring_bills WHERE id = $1 AND household_id = $2',
    [req.params.id, req.householdId]
  );
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Recurring bill not found' });

  const { month, paidBy, amount, date } = req.body || {};
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  if (!paidBy) return res.status(400).json({ error: 'paidBy is required' });

  const existingPaymentResult = await pool.query(
    'SELECT * FROM recurring_bill_payments WHERE recurring_bill_id = $1 AND month = $2',
    [existing.id, targetMonth]
  );
  if (existingPaymentResult.rows.length > 0) {
    return res.status(409).json({ error: 'This bill has already been marked paid for that month' });
  }

  const paidAmount = amount !== undefined ? Number(amount) : existing.amount;
  const paidDate = date || new Date().toISOString().slice(0, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO recurring_bill_payments (recurring_bill_id, month, paid_by, paid_date, amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [existing.id, targetMonth, paidBy, paidDate, paidAmount]
    );
    const expenseResult = await client.query(
      `INSERT INTO expenses (household_id, category_id, payer_id, amount, description, date, split_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [req.householdId, existing.category_id, paidBy, paidAmount, existing.name, paidDate, existing.split_type]
    );
    const expenseId = expenseResult.rows[0].id;
    const membersResult = await client.query('SELECT id FROM users WHERE household_id = $1', [req.householdId]);
    const members = membersResult.rows.map((u) => u.id);
    if (existing.split_type === 'personal') {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES ($1, $2, $3)',
        [expenseId, paidBy, paidAmount]
      );
    } else {
      const n = members.length;
      const base = Math.floor((paidAmount / n) * 100) / 100;
      const remainder = Math.round((paidAmount - base * n) * 100) / 100;
      for (let i = 0; i < members.length; i++) {
        const share = i === 0 ? Math.round((base + remainder) * 100) / 100 : base;
        await client.query(
          'INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES ($1, $2, $3)',
          [expenseId, members[i], share]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const billResult = await pool.query('SELECT * FROM recurring_bills WHERE id = $1', [existing.id]);
  res.status(201).json(await serialize(billResult.rows[0], targetMonth));
});

export default router;
