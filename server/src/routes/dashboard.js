import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

async function computeBalance(householdId) {
  const membersResult = await pool.query(
    'SELECT id, name, color FROM users WHERE household_id = $1 ORDER BY id',
    [householdId]
  );
  const members = membersResult.rows;

  const paidResult = await pool.query(
    `SELECT payer_id AS "userId", COALESCE(SUM(amount), 0) AS total
     FROM expenses WHERE household_id = $1 GROUP BY payer_id`,
    [householdId]
  );
  const owedResult = await pool.query(
    `SELECT es.user_id AS "userId", COALESCE(SUM(es.share_amount), 0) AS total
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.household_id = $1
     GROUP BY es.user_id`,
    [householdId]
  );

  const paidMap = Object.fromEntries(paidResult.rows.map((p) => [p.userId, Number(p.total)]));
  const owedMap = Object.fromEntries(owedResult.rows.map((o) => [o.userId, Number(o.total)]));

  const net = members.map((m) => ({
    userId: m.id,
    name: m.name,
    color: m.color,
    paid: Math.round((paidMap[m.id] || 0) * 100) / 100,
    owed: Math.round((owedMap[m.id] || 0) * 100) / 100,
    net: Math.round(((paidMap[m.id] || 0) - (owedMap[m.id] || 0)) * 100) / 100,
  }));

  let summary = null;
  if (net.length >= 2) {
    const [a, b] = net;
    if (a.net > b.net) {
      summary = { fromUserId: b.userId, toUserId: a.userId, amount: Math.round(((a.net - b.net) / 2) * 100) / 100 };
    } else if (b.net > a.net) {
      summary = { fromUserId: a.userId, toUserId: b.userId, amount: Math.round(((b.net - a.net) / 2) * 100) / 100 };
    } else {
      summary = { fromUserId: null, toUserId: null, amount: 0 };
    }
  }

  return { members: net, settlement: summary };
}

async function getSpendByPerson(householdId, datePrefixLength, period) {
  const result = await pool.query(
    `SELECT u.id AS "userId", u.name, u.color, COALESCE(SUM(e.amount), 0) AS spent
     FROM users u
     LEFT JOIN expenses e ON e.payer_id = u.id AND substr(e.date, 1, $1) = $2 AND e.household_id = $3
     WHERE u.household_id = $3
     GROUP BY u.id, u.name, u.color
     ORDER BY u.id`,
    [datePrefixLength, period, householdId]
  );
  return result.rows.map((p) => ({ ...p, spent: Math.round(Number(p.spent) * 100) / 100 }));
}

async function getGoalsSummary(householdId) {
  const goalsResult = await pool.query(
    'SELECT * FROM savings_goals WHERE household_id = $1 ORDER BY created_at',
    [householdId]
  );
  return Promise.all(
    goalsResult.rows.map(async (g) => {
      const currentResult = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM savings_contributions WHERE goal_id = $1',
        [g.id]
      );
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        targetAmount: g.target_amount,
        currentAmount: Math.round(Number(currentResult.rows[0].total) * 100) / 100,
      };
    })
  );
}

router.get('/balance', async (req, res) => {
  res.json(await computeBalance(req.householdId));
});

router.get('/year', async (req, res) => {
  const year = req.query.year || String(new Date().getFullYear());

  const spendByCategoryResult = await pool.query(
    `SELECT c.id AS "categoryId", c.name, c.icon, c.color,
            COALESCE(SUM(e.amount), 0) AS spent,
            COALESCE((SELECT SUM(amount) FROM budgets b
                      WHERE b.category_id = c.id AND substr(b.month, 1, 4) = $1), 0) AS budget
     FROM categories c
     LEFT JOIN expenses e ON e.category_id = c.id AND substr(e.date, 1, 4) = $1 AND e.household_id = $2
     WHERE c.household_id = $2
     GROUP BY c.id
     ORDER BY spent DESC`,
    [year, req.householdId]
  );
  const spendByCategory = spendByCategoryResult.rows.map((c) => ({
    ...c,
    spent: Number(c.spent),
    budget: Number(c.budget),
  }));

  const totalSpent = spendByCategory.reduce((s, c) => s + c.spent, 0);
  const totalBudget = spendByCategory.reduce((s, c) => s + c.budget, 0);

  const monthlyResult = await pool.query(
    `SELECT substr(date, 1, 7) AS month, COALESCE(SUM(amount), 0) AS spent
     FROM expenses
     WHERE household_id = $1 AND substr(date, 1, 4) = $2
     GROUP BY month`,
    [req.householdId, year]
  );
  const monthlySpend = Object.fromEntries(monthlyResult.rows.map((m) => [m.month, Number(m.spent)]));
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { month, spent: Math.round((monthlySpend[month] || 0) * 100) / 100 };
  });

  res.json({
    year,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalBudget: Math.round(totalBudget * 100) / 100,
    spendByCategory,
    spendByPerson: await getSpendByPerson(req.householdId, 4, year),
    monthlyTrend,
    balance: await computeBalance(req.householdId),
    goals: await getGoalsSummary(req.householdId),
  });
});

router.get('/', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const spendByCategoryResult = await pool.query(
    `SELECT c.id AS "categoryId", c.name, c.icon, c.color,
            COALESCE(SUM(e.amount), 0) AS spent,
            COALESCE((SELECT amount FROM budgets b WHERE b.category_id = c.id AND b.month = $1), 0) AS budget
     FROM categories c
     LEFT JOIN expenses e ON e.category_id = c.id AND substr(e.date, 1, 7) = $1 AND e.household_id = $2
     WHERE c.household_id = $2
     GROUP BY c.id
     ORDER BY spent DESC`,
    [month, req.householdId]
  );
  const spendByCategory = spendByCategoryResult.rows.map((c) => ({
    ...c,
    spent: Number(c.spent),
    budget: Number(c.budget),
  }));

  const totalSpent = spendByCategory.reduce((s, c) => s + c.spent, 0);
  const totalBudget = spendByCategory.reduce((s, c) => s + c.budget, 0);

  const recentExpensesResult = await pool.query(
    `SELECT e.id, e.amount, e.description, e.date, e.payer_id AS "payerId",
            c.name AS "categoryName", c.icon AS "categoryIcon"
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.household_id = $1
     ORDER BY e.date DESC, e.id DESC
     LIMIT 8`,
    [req.householdId]
  );

  const upcomingBillsResult = await pool.query(
    `SELECT rb.id, rb.name, rb.amount, rb.due_day AS "dueDay",
            (SELECT COUNT(*) FROM recurring_bill_payments p WHERE p.recurring_bill_id = rb.id AND p.month = $1) AS "paidCount"
     FROM recurring_bills rb
     WHERE rb.household_id = $2 AND rb.active = true
     ORDER BY rb.due_day`,
    [month, req.householdId]
  );
  const upcomingBills = upcomingBillsResult.rows.map((b) => ({
    ...b,
    paid: Number(b.paidCount) > 0,
  }));

  res.json({
    month,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalBudget: Math.round(totalBudget * 100) / 100,
    spendByCategory,
    spendByPerson: await getSpendByPerson(req.householdId, 7, month),
    recentExpenses: recentExpensesResult.rows,
    balance: await computeBalance(req.householdId),
    upcomingBills,
    goals: await getGoalsSummary(req.householdId),
  });
});

export default router;
