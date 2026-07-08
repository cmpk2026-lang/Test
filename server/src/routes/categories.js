import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM categories WHERE household_id = $1 ORDER BY name', [
    req.householdId,
  ]);
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  const { name, icon, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await pool.query(
    'INSERT INTO categories (household_id, name, icon, color) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.householdId, name, icon || '💰', color || '#6366f1']
  );
  res.status(201).json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM categories WHERE id = $1 AND household_id = $2 RETURNING id', [
    req.params.id,
    req.householdId,
  ]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
  res.status(204).end();
});

export default router;
