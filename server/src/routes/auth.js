import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, seedDefaultCategories } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const USER_COLORS = ['#6366f1', '#ec4899'];

router.post('/register', async (req, res) => {
  const { name, email, password, householdName } = req.body || {};
  if (!name || !email || !password || !householdName) {
    return res.status(400).json({ error: 'name, email, password, and householdName are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inviteCode = generateInviteCode();
    for (;;) {
      const clash = await client.query('SELECT id FROM households WHERE invite_code = $1', [inviteCode]);
      if (clash.rows.length === 0) break;
      inviteCode = generateInviteCode();
    }

    const household = await client.query(
      'INSERT INTO households (name, invite_code) VALUES ($1, $2) RETURNING id',
      [householdName, inviteCode]
    );
    const householdId = household.rows[0].id;
    await seedDefaultCategories(client, householdId);

    const passwordHash = bcrypt.hashSync(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (household_id, name, email, password_hash, color)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [householdId, name, email.toLowerCase(), passwordHash, USER_COLORS[0]]
    );

    await client.query('COMMIT');

    const token = signToken(userResult.rows[0]);
    res.status(201).json({ token, inviteCode });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.post('/join', async (req, res) => {
  const { name, email, password, inviteCode } = req.body || {};
  if (!name || !email || !password || !inviteCode) {
    return res.status(400).json({ error: 'name, email, password, and inviteCode are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const householdResult = await pool.query('SELECT * FROM households WHERE invite_code = $1', [
    inviteCode.toUpperCase(),
  ]);
  const household = householdResult.rows[0];
  if (!household) return res.status(404).json({ error: 'Invalid invite code' });

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const memberCountResult = await pool.query(
    'SELECT COUNT(*)::int AS c FROM users WHERE household_id = $1',
    [household.id]
  );
  const color = USER_COLORS[memberCountResult.rows[0].c % USER_COLORS.length];

  const passwordHash = bcrypt.hashSync(password, 10);
  const userResult = await pool.query(
    `INSERT INTO users (household_id, name, email, password_hash, color)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [household.id, name, email.toLowerCase(), passwordHash, color]
  );

  const token = signToken(userResult.rows[0]);
  res.status(201).json({ token });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({ token });
});

router.get('/me', requireAuth, async (req, res) => {
  const userResult = await pool.query(
    'SELECT id, name, email, color, household_id FROM users WHERE id = $1',
    [req.userId]
  );
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const householdResult = await pool.query('SELECT * FROM households WHERE id = $1', [user.household_id]);
  const household = householdResult.rows[0];
  const membersResult = await pool.query(
    'SELECT id, name, email, color FROM users WHERE household_id = $1 ORDER BY id',
    [user.household_id]
  );
  res.json({
    user: { id: user.id, name: user.name, email: user.email, color: user.color },
    household: { id: household.id, name: household.name, inviteCode: household.invite_code },
    members: membersResult.rows,
  });
});

export default router;
