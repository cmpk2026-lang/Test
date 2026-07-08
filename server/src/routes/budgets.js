import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const result = await pool.query(
    `SELECT b.id, b.category_id AS "categoryId", b.month, b.amount,
            c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor",
            COALESCE((SELECT SUM(e.amount) FROM expenses e
                      WHERE e.category_id = b.category_id AND e.household_id = b.household_id
                      AND substr(e.date, 1, 7) = b.month), 0) AS spent
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     WHERE b.household_id = $1 AND b.month = $2
     ORDER BY c.name`,
    [req.householdId, month]
  );
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  const { categoryId, month, amount } = req.body || {};
  if (!categoryId || !month || amount === undefined) {
    return res.status(400).json({ error: 'categoryId, month, and amount are required' });
  }
  const category = await pool.query('SELECT * FROM categories WHERE id = $1 AND household_id = $2', [
    categoryId,
    req.householdId,
  ]);
  if (category.rows.length === 0) return res.status(404).json({ error: 'Category not found' });

  const result = await pool.query(
    `INSERT INTO budgets (household_id, category_id, month, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (category_id, month) DO UPDATE SET amount = EXCLUDED.amount
     RETURNING *`,
    [req.householdId, categoryId, month, Number(amount)]
  );
  res.status(201).json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM budgets WHERE id = $1 AND household_id = $2 RETURNING id', [
    req.params.id,
    req.householdId,
  ]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Budget not found' });
  res.status(204).end();
});

export default router;
