import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const categories = db
    .prepare('SELECT * FROM categories WHERE household_id = ? ORDER BY name')
    .all(req.householdId);
  res.json(categories);
});

router.post('/', (req, res) => {
  const { name, icon, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db
    .prepare('INSERT INTO categories (household_id, name, icon, color) VALUES (?, ?, ?, ?)')
    .run(req.householdId, name, icon || '💰', color || '#6366f1');
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(category);
});

router.delete('/:id', (req, res) => {
  const category = db
    .prepare('SELECT * FROM categories WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(category.id);
  res.status(204).end();
});

export default router;
