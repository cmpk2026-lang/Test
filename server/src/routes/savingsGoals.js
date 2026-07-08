import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

async function serialize(goal) {
  const contributionsResult = await pool.query(
    `SELECT id, user_id AS "userId", amount, date FROM savings_contributions
     WHERE goal_id = $1 ORDER BY date DESC, id DESC`,
    [goal.id]
  );
  const contributions = contributionsResult.rows;
  const current = contributions.reduce((s, c) => s + c.amount, 0);
  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    targetAmount: goal.target_amount,
    targetDate: goal.target_date,
    currentAmount: Math.round(current * 100) / 100,
    contributions,
  };
}

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM savings_goals WHERE household_id = $1 ORDER BY created_at', [
    req.householdId,
  ]);
  res.json(await Promise.all(result.rows.map(serialize)));
});

router.post('/', async (req, res) => {
  const { name, targetAmount, targetDate, icon } = req.body || {};
  if (!name || !targetAmount) return res.status(400).json({ error: 'name and targetAmount are required' });
  const result = await pool.query(
    'INSERT INTO savings_goals (household_id, name, target_amount, target_date, icon) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [req.householdId, name, Number(targetAmount), targetDate || null, icon || '🎯']
  );
  res.status(201).json(await serialize(result.rows[0]));
});

router.put('/:id', async (req, res) => {
  const existingResult = await pool.query('SELECT * FROM savings_goals WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.householdId,
  ]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Savings goal not found' });
  const { name, targetAmount, targetDate, icon } = req.body || {};
  const result = await pool.query(
    'UPDATE savings_goals SET name = $1, target_amount = $2, target_date = $3, icon = $4 WHERE id = $5 RETURNING *',
    [
      name || existing.name,
      targetAmount !== undefined ? Number(targetAmount) : existing.target_amount,
      targetDate !== undefined ? targetDate : existing.target_date,
      icon || existing.icon,
      existing.id,
    ]
  );
  res.json(await serialize(result.rows[0]));
});

router.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM savings_goals WHERE id = $1 AND household_id = $2 RETURNING id', [
    req.params.id,
    req.householdId,
  ]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Savings goal not found' });
  res.status(204).end();
});

router.post('/:id/contribute', async (req, res) => {
  const existingResult = await pool.query('SELECT * FROM savings_goals WHERE id = $1 AND household_id = $2', [
    req.params.id,
    req.householdId,
  ]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Savings goal not found' });
  const { userId, amount, date } = req.body || {};
  if (!userId || !amount) return res.status(400).json({ error: 'userId and amount are required' });
  const memberResult = await pool.query('SELECT id FROM users WHERE id = $1 AND household_id = $2', [
    userId,
    req.householdId,
  ]);
  if (memberResult.rows.length === 0) {
    return res.status(400).json({ error: 'userId must be a member of your household' });
  }
  await pool.query(
    'INSERT INTO savings_contributions (goal_id, user_id, amount, date) VALUES ($1, $2, $3, $4)',
    [existing.id, userId, Number(amount), date || new Date().toISOString().slice(0, 10)]
  );
  const goalResult = await pool.query('SELECT * FROM savings_goals WHERE id = $1', [existing.id]);
  res.status(201).json(await serialize(goalResult.rows[0]));
});

export default router;
