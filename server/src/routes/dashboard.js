import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

function computeBalance(householdId) {
  const members = db
    .prepare('SELECT id, name, color FROM users WHERE household_id = ? ORDER BY id')
    .all(householdId);

  const paid = db
    .prepare(
      `SELECT payer_id AS userId, COALESCE(SUM(amount), 0) AS total
       FROM expenses WHERE household_id = ? GROUP BY payer_id`
    )
    .all(householdId);
  const owed = db
    .prepare(
      `SELECT es.user_id AS userId, COALESCE(SUM(es.share_amount), 0) AS total
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.household_id = ?
       GROUP BY es.user_id`
    )
    .all(householdId);

  const paidMap = Object.fromEntries(paid.map((p) => [p.userId, p.total]));
  const owedMap = Object.fromEntries(owed.map((o) => [o.userId, o.total]));

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

router.get('/balance', (req, res) => {
  res.json(computeBalance(req.householdId));
});

router.get('/', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const spendByCategory = db
    .prepare(
      `SELECT c.id AS categoryId, c.name, c.icon, c.color,
              COALESCE(SUM(e.amount), 0) AS spent,
              COALESCE((SELECT amount FROM budgets b WHERE b.category_id = c.id AND b.month = ?), 0) AS budget
       FROM categories c
       LEFT JOIN expenses e ON e.category_id = c.id AND substr(e.date, 1, 7) = ? AND e.household_id = ?
       WHERE c.household_id = ?
       GROUP BY c.id
       ORDER BY spent DESC`
    )
    .all(month, month, req.householdId, req.householdId);

  const totalSpent = spendByCategory.reduce((s, c) => s + c.spent, 0);
  const totalBudget = spendByCategory.reduce((s, c) => s + c.budget, 0);

  const recentExpenses = db
    .prepare(
      `SELECT e.id, e.amount, e.description, e.date, e.payer_id AS payerId,
              c.name AS categoryName, c.icon AS categoryIcon
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.household_id = ?
       ORDER BY e.date DESC, e.id DESC
       LIMIT 8`
    )
    .all(req.householdId);

  const upcomingBills = db
    .prepare(
      `SELECT rb.id, rb.name, rb.amount, rb.due_day AS dueDay,
              (SELECT COUNT(*) FROM recurring_bill_payments p WHERE p.recurring_bill_id = rb.id AND p.month = ?) AS paidCount
       FROM recurring_bills rb
       WHERE rb.household_id = ? AND rb.active = 1
       ORDER BY rb.due_day`
    )
    .all(month, req.householdId)
    .map((b) => ({ ...b, paid: b.paidCount > 0 }));

  const goals = db
    .prepare('SELECT * FROM savings_goals WHERE household_id = ? ORDER BY created_at')
    .all(req.householdId)
    .map((g) => {
      const current = db
        .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM savings_contributions WHERE goal_id = ?')
        .get(g.id).total;
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        targetAmount: g.target_amount,
        currentAmount: Math.round(current * 100) / 100,
      };
    });

  res.json({
    month,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalBudget: Math.round(totalBudget * 100) / 100,
    spendByCategory,
    recentExpenses,
    balance: computeBalance(req.householdId),
    upcomingBills,
    goals,
  });
});

export default router;
