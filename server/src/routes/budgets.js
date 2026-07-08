import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const budgets = db
    .prepare(
      `SELECT b.id, b.category_id AS categoryId, b.month, b.amount,
              c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor,
              COALESCE((SELECT SUM(e.amount) FROM expenses e
                        WHERE e.category_id = b.category_id AND e.household_id = b.household_id
                        AND substr(e.date, 1, 7) = b.month), 0) AS spent
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.household_id = ? AND b.month = ?
       ORDER BY c.name`
    )
    .all(req.householdId, month);
  res.json(budgets);
});

router.post('/', (req, res) => {
  const { categoryId, month, amount } = req.body || {};
  if (!categoryId || !month || amount === undefined) {
    return res.status(400).json({ error: 'categoryId, month, and amount are required' });
  }
  const category = db
    .prepare('SELECT * FROM categories WHERE id = ? AND household_id = ?')
    .get(categoryId, req.householdId);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const existing = db
    .prepare('SELECT * FROM budgets WHERE category_id = ? AND month = ?')
    .get(categoryId, month);
  if (existing) {
    db.prepare('UPDATE budgets SET amount = ? WHERE id = ?').run(Number(amount), existing.id);
  } else {
    db.prepare(
      'INSERT INTO budgets (household_id, category_id, month, amount) VALUES (?, ?, ?, ?)'
    ).run(req.householdId, categoryId, month, Number(amount));
  }
  const budget = db
    .prepare('SELECT * FROM budgets WHERE category_id = ? AND month = ?')
    .get(categoryId, month);
  res.status(201).json(budget);
});

router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM budgets WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!existing) return res.status(404).json({ error: 'Budget not found' });
  db.prepare('DELETE FROM budgets WHERE id = ?').run(existing.id);
  res.status(204).end();
});

export default router;
