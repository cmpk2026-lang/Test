import { Router } from 'express';
import { pool, getOrCreateHousehold } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

const ACCESS_CODE = process.env.ACCESS_CODE || 'CMPK';
const MEMBER_COLORS = ['#6366f1', '#ec4899', '#22c55e', '#f97316'];

function checkCode(code) {
  return typeof code === 'string' && code.trim().toUpperCase() === ACCESS_CODE.toUpperCase();
}

// Step 1: verify the shared code and list who's already set up their name,
// so returning users can just tap their name instead of retyping it.
router.post('/check', async (req, res) => {
  const { code } = req.body || {};
  if (!checkCode(code)) return res.status(401).json({ error: 'Incorrect code' });
  const household = await getOrCreateHousehold();
  const members = await pool.query(
    'SELECT id, name, color FROM users WHERE household_id = $1 ORDER BY id',
    [household.id]
  );
  res.json({ members: members.rows });
});

// Step 2: re-check the code and find-or-create the named person, then issue a token.
router.post('/enter', async (req, res) => {
  const { code, name } = req.body || {};
  if (!checkCode(code)) return res.status(401).json({ error: 'Incorrect code' });
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) return res.status(400).json({ error: 'name is required' });

  const household = await getOrCreateHousehold();

  const existing = await pool.query(
    'SELECT * FROM users WHERE household_id = $1 AND LOWER(name) = LOWER($2)',
    [household.id, trimmedName]
  );
  let user = existing.rows[0];
  if (!user) {
    const countResult = await pool.query('SELECT COUNT(*)::int AS c FROM users WHERE household_id = $1', [
      household.id,
    ]);
    const color = MEMBER_COLORS[countResult.rows[0].c % MEMBER_COLORS.length];
    try {
      const inserted = await pool.query(
        'INSERT INTO users (household_id, name, color) VALUES ($1, $2, $3) RETURNING *',
        [household.id, trimmedName, color]
      );
      user = inserted.rows[0];
    } catch (err) {
      // Two requests for the same brand-new name can race (e.g. a double-tap
      // on "Go"): both see no existing user and both try to insert. The
      // loser hits the (household_id, name) uniqueness constraint — treat
      // that as a hit rather than an error, since the name now exists either way.
      if (err.code === '23505') {
        const retry = await pool.query(
          'SELECT * FROM users WHERE household_id = $1 AND LOWER(name) = LOWER($2)',
          [household.id, trimmedName]
        );
        user = retry.rows[0];
      } else {
        throw err;
      }
    }
  }

  const token = signToken(user);
  res.status(201).json({ token });
});

router.get('/me', requireAuth, async (req, res) => {
  const userResult = await pool.query('SELECT id, name, color, household_id FROM users WHERE id = $1', [
    req.userId,
  ]);
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const householdResult = await pool.query('SELECT * FROM households WHERE id = $1', [user.household_id]);
  const household = householdResult.rows[0];
  const membersResult = await pool.query(
    'SELECT id, name, color FROM users WHERE household_id = $1 ORDER BY id',
    [user.household_id]
  );
  res.json({
    user: { id: user.id, name: user.name, color: user.color },
    household: { id: household.id, name: household.name },
    members: membersResult.rows,
  });
});

export default router;
