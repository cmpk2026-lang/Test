import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://budget_app:budget_app_dev@localhost:5432/budget',
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS households (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(household_id, name)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '💰',
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id SERIAL PRIMARY KEY,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      UNIQUE(category_id, month)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      payer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      split_type TEXT NOT NULL DEFAULT 'equal',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      id SERIAL PRIMARY KEY,
      expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_amount DOUBLE PRECISION NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_bills (
      id SERIAL PRIMARY KEY,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      due_day INTEGER NOT NULL DEFAULT 1,
      split_type TEXT NOT NULL DEFAULT 'equal',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS recurring_bill_payments (
      id SERIAL PRIMARY KEY,
      recurring_bill_id INTEGER NOT NULL REFERENCES recurring_bills(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      paid_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      paid_date TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      UNIQUE(recurring_bill_id, month)
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id SERIAL PRIMARY KEY,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_amount DOUBLE PRECISION NOT NULL,
      target_date TEXT,
      icon TEXT NOT NULL DEFAULT '🎯',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS savings_contributions (
      id SERIAL PRIMARY KEY,
      goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      date TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// This app is single-tenant in practice (one shared access code, one
// household for the two of you), so there's always exactly one row here —
// created lazily on first use rather than through any signup flow.
export async function getOrCreateHousehold() {
  const existing = await pool.query('SELECT * FROM households ORDER BY id LIMIT 1');
  if (existing.rows[0]) return existing.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      "INSERT INTO households (name) VALUES ('Our Household') RETURNING *"
    );
    await seedDefaultCategories(client, result.rows[0].id);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', icon: '🛒', color: '#22c55e' },
  { name: 'Rent', icon: '🏠', color: '#6366f1' },
  { name: 'Dining Out', icon: '🍽️', color: '#f97316' },
  { name: 'Transport', icon: '🚗', color: '#0ea5e9' },
  { name: 'Utilities', icon: '💡', color: '#eab308' },
  { name: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { name: 'Health', icon: '💊', color: '#14b8a6' },
  { name: 'Shopping', icon: '🛍️', color: '#a855f7' },
  { name: 'Travel', icon: '✈️', color: '#f43f5e' },
  { name: 'Other', icon: '💰', color: '#64748b' },
];

export async function seedDefaultCategories(client, householdId) {
  const values = [];
  const params = [];
  DEFAULT_CATEGORIES.forEach((c, i) => {
    const base = i * 4;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    params.push(householdId, c.name, c.icon, c.color);
  });
  await client.query(
    `INSERT INTO categories (household_id, name, icon, color) VALUES ${values.join(', ')}`,
    params
  );
}
