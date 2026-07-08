import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, seedDefaultCategories } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const USER_COLORS = ['#6366f1', '#ec4899'];

router.post('/register', (req, res) => {
  const { name, email, password, householdName } = req.body || {};
  if (!name || !email || !password || !householdName) {
    return res.status(400).json({ error: 'name, email, password, and householdName are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  let inviteCode = generateInviteCode();
  while (db.prepare('SELECT id FROM households WHERE invite_code = ?').get(inviteCode)) {
    inviteCode = generateInviteCode();
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const result = db.transaction(() => {
    const household = db
      .prepare('INSERT INTO households (name, invite_code) VALUES (?, ?)')
      .run(householdName, inviteCode);
    const householdId = household.lastInsertRowid;
    seedDefaultCategories(householdId);
    const user = db
      .prepare(
        'INSERT INTO users (household_id, name, email, password_hash, color) VALUES (?, ?, ?, ?, ?)'
      )
      .run(householdId, name, email.toLowerCase(), passwordHash, USER_COLORS[0]);
    return { householdId, userId: user.lastInsertRowid };
  })();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.userId);
  const token = signToken(user);
  res.status(201).json({ token, inviteCode });
});

router.post('/join', (req, res) => {
  const { name, email, password, inviteCode } = req.body || {};
  if (!name || !email || !password || !inviteCode) {
    return res.status(400).json({ error: 'name, email, password, and inviteCode are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const household = db
    .prepare('SELECT * FROM households WHERE invite_code = ?')
    .get(inviteCode.toUpperCase());
  if (!household) return res.status(404).json({ error: 'Invalid invite code' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const memberCount = db
    .prepare('SELECT COUNT(*) AS c FROM users WHERE household_id = ?')
    .get(household.id).c;
  const color = USER_COLORS[memberCount % USER_COLORS.length];

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      'INSERT INTO users (household_id, name, email, password_hash, color) VALUES (?, ?, ?, ?, ?)'
    )
    .run(household.id, name, email.toLowerCase(), passwordHash, color);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ token });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({ token });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, color, household_id FROM users WHERE id = ?')
    .get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const household = db.prepare('SELECT * FROM households WHERE id = ?').get(user.household_id);
  const members = db
    .prepare('SELECT id, name, email, color FROM users WHERE household_id = ? ORDER BY id')
    .all(user.household_id);
  res.json({
    user: { id: user.id, name: user.name, email: user.email, color: user.color },
    household: { id: household.id, name: household.name, inviteCode: household.invite_code },
    members,
  });
});

export default router;
