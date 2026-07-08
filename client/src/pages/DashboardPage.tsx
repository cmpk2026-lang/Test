import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../api/client';
import { useMonth } from '../context/MonthContext';
import { useAuth } from '../context/AuthContext';
import type { DashboardData } from '../types';
import { formatMoney } from '../utils';

export function DashboardPage() {
  const { month } = useMonth();
  const { members } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<DashboardData>('/dashboard', { params: { month } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [month]);

  if (loading || !data) {
    return <p className="text-slate-400">Loading dashboard…</p>;
  }

  const memberName = (id: number) => members.find((m) => m.id === id)?.name ?? 'Someone';
  const settlement = data.balance.settlement;
  const pieData = data.spendByCategory.filter((c) => c.spent > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Spent this month" value={formatMoney(data.totalSpent)} accent="text-slate-900 dark:text-slate-50" />
        <StatCard label="Budget this month" value={formatMoney(data.totalBudget)} accent="text-slate-900 dark:text-slate-50" />
        <StatCard
          label="Remaining"
          value={formatMoney(data.totalBudget - data.totalSpent)}
          accent={data.totalBudget - data.totalSpent < 0 ? 'text-rose-500' : 'text-emerald-500'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Spending by category
          </h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-slate-400">No expenses logged yet this month.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="spent" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {pieData.map((c) => (
                        <Cell key={c.categoryId} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2">
                {pieData.map((c) => (
                  <li key={c.categoryId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.icon} {c.name}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{formatMoney(c.spent)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Balance
          </h2>
          <div className="space-y-3">
            {data.balance.members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.name}
                </span>
                <span className={m.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {m.net >= 0 ? '+' : ''}
                  {formatMoney(m.net)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {settlement && settlement.amount > 0 ? (
              <>
                <strong>{memberName(settlement.fromUserId!)}</strong> owes{' '}
                <strong>{memberName(settlement.toUserId!)}</strong> {formatMoney(settlement.amount)}
              </>
            ) : (
              "You're all settled up 🎉"
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Recent expenses
            </h2>
            <Link to="/expenses" className="text-sm font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {data.recentExpenses.length === 0 ? (
            <p className="text-sm text-slate-400">No expenses yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentExpenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{e.categoryIcon ?? '💰'}</span>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {e.description || e.categoryName || 'Expense'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {e.date} · paid by {memberName(e.payerId)}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{formatMoney(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Upcoming bills
              </h2>
              <Link to="/bills" className="text-xs font-medium text-indigo-600 hover:underline">
                Manage
              </Link>
            </div>
            {data.upcomingBills.length === 0 ? (
              <p className="text-sm text-slate-400">No recurring bills set up.</p>
            ) : (
              <ul className="space-y-2">
                {data.upcomingBills.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      Day {b.dueDay} · {b.name}
                    </span>
                    <span className={b.paid ? 'text-emerald-500' : 'text-slate-500'}>
                      {b.paid ? 'Paid' : formatMoney(b.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Savings goals
              </h2>
              <Link to="/goals" className="text-xs font-medium text-indigo-600 hover:underline">
                Manage
              </Link>
            </div>
            {data.goals.length === 0 ? (
              <p className="text-sm text-slate-400">No goals yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.goals.map((g) => {
                  const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                  return (
                    <li key={g.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                          {g.icon} {g.name}
                        </span>
                        <span className="text-xs text-slate-400">{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}
