import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

function serialize(goal) {
  const contributions = db
    .prepare(
      `SELECT id, user_id AS userId, amount, date FROM savings_contributions
       WHERE goal_id = ? ORDER BY date DESC, id DESC`
    )
    .all(goal.id);
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

router.get('/', (req, res) => {
  const goals = db
    .prepare('SELECT * FROM savings_goals WHERE household_id = ? ORDER BY created_at')
    .all(req.householdId);
  res.json(goals.map(serialize));
});

router.post('/', (req, res) => {
  const { name, targetAmount, targetDate, icon } = req.body || {};
  if (!name || !targetAmount) return res.status(400).json({ error: 'name and targetAmount are required' });
  const result = db
    .prepare(
      'INSERT INTO savings_goals (household_id, name, target_amount, target_date, icon) VALUES (?, ?, ?, ?, ?)'
    )
    .run(req.householdId, name, Number(targetAmount), targetDate || null, icon || '🎯');
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serialize(goal));
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Savings goal not found' });
  const { name, targetAmount, targetDate, icon } = req.body || {};
  db.prepare(
    'UPDATE savings_goals SET name = ?, target_amount = ?, target_date = ?, icon = ? WHERE id = ?'
  ).run(
    name || existing.name,
    targetAmount !== undefined ? Number(targetAmount) : existing.target_amount,
    targetDate !== undefined ? targetDate : existing.target_date,
    icon || existing.icon,
    existing.id
  );
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(existing.id);
  res.json(serialize(goal));
});

router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Savings goal not found' });
  db.prepare('DELETE FROM savings_goals WHERE id = ?').run(existing.id);
  res.status(204).end();
});

router.post('/:id/contribute', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Savings goal not found' });
  const { userId, amount, date } = req.body || {};
  if (!userId || !amount) return res.status(400).json({ error: 'userId and amount are required' });
  const member = db
    .prepare('SELECT id FROM users WHERE id = ? AND household_id = ?')
    .get(userId, req.householdId);
  if (!member) return res.status(400).json({ error: 'userId must be a member of your household' });
  db.prepare(
    'INSERT INTO savings_contributions (goal_id, user_id, amount, date) VALUES (?, ?, ?, ?)'
  ).run(existing.id, userId, Number(amount), date || new Date().toISOString().slice(0, 10));
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(existing.id);
  res.status(201).json(serialize(goal));
});

export default router;
