import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { api } from '../api/client';
import { useMonth } from '../context/MonthContext';
import { useAuth } from '../context/AuthContext';
import type { Balance, CategorySpend, DashboardData, GoalSummary, PersonSpend, YearDashboardData } from '../types';
import { formatMoney } from '../utils';

type ViewMode = 'month' | 'year';

export function DashboardPage() {
  const { month } = useMonth();
  const { members } = useAuth();
  const [mode, setMode] = useState<ViewMode>('month');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthData, setMonthData] = useState<DashboardData | null>(null);
  const [yearData, setYearData] = useState<YearDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (mode === 'month') {
      api
        .get<DashboardData>('/dashboard', { params: { month } })
        .then((res) => setMonthData(res.data))
        .finally(() => setLoading(false));
    } else {
      api
        .get<YearDashboardData>('/dashboard/year', { params: { year } })
        .then((res) => setYearData(res.data))
        .finally(() => setLoading(false));
    }
  }, [mode, month, year]);

  const data = mode === 'month' ? monthData : yearData;
  if (loading || !data) {
    return <p className="text-slate-400">Loading dashboard…</p>;
  }

  const memberName = (id: number) => members.find((m) => m.id === id)?.name ?? 'Someone';
  const periodLabel = mode === 'month' ? 'this month' : 'this year';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(['month', 'year'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                mode === m ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {mode === 'year' && (
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Previous year"
            >
              ‹
            </button>
            <span className="min-w-[3.5rem] text-center text-sm font-medium text-slate-700 dark:text-slate-200">
              {year}
            </span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Next year"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Spent ${periodLabel}`} value={formatMoney(data.totalSpent)} accent="text-slate-900 dark:text-slate-50" />
        <StatCard label={`Budget ${periodLabel}`} value={formatMoney(data.totalBudget)} accent="text-slate-900 dark:text-slate-50" />
        <StatCard
          label="Remaining"
          value={formatMoney(data.totalBudget - data.totalSpent)}
          accent={data.totalBudget - data.totalSpent < 0 ? 'text-rose-500' : 'text-emerald-500'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CategoryBreakdownCard spendByCategory={data.spendByCategory} periodLabel={periodLabel} />
        <div className="space-y-4">
          <BalanceCard balance={data.balance} memberName={memberName} />
          <SpendByPersonCard spendByPerson={data.spendByPerson} periodLabel={periodLabel} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {mode === 'month' && monthData ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Recent expenses
              </h2>
              <Link to="/expenses" className="text-sm font-medium text-indigo-600 hover:underline">
                View all
              </Link>
            </div>
            {monthData.recentExpenses.length === 0 ? (
              <p className="text-sm text-slate-400">No expenses yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {monthData.recentExpenses.map((e) => (
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
        ) : yearData ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Monthly trend
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearData.monthlyTrend} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(m: string) => m.slice(5)}
                    tick={{ fontSize: 12 }}
                    stroke="currentColor"
                    className="text-slate-400"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" width={48} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} contentStyle={{ fontSize: 13 }} />
                  <Bar dataKey="spent" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {mode === 'month' && monthData && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Upcoming bills
                </h2>
                <Link to="/bills" className="text-xs font-medium text-indigo-600 hover:underline">
                  Manage
                </Link>
              </div>
              {monthData.upcomingBills.length === 0 ? (
                <p className="text-sm text-slate-400">No recurring bills set up.</p>
              ) : (
                <ul className="space-y-2">
                  {monthData.upcomingBills.map((b) => (
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
          )}

          <GoalsCard goals={data.goals} />
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

function CategoryBreakdownCard({
  spendByCategory,
  periodLabel,
}: {
  spendByCategory: CategorySpend[];
  periodLabel: string;
}) {
  const pieData = spendByCategory.filter((c) => c.spent > 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Spending by category
      </h2>
      {pieData.length === 0 ? (
        <p className="text-sm text-slate-400">No expenses logged {periodLabel} yet.</p>
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
  );
}

function BalanceCard({ balance, memberName }: { balance: Balance; memberName: (id: number) => string }) {
  const settlement = balance.settlement;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Balance
      </h2>
      <div className="space-y-3">
        {balance.members.map((m) => (
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
  );
}

function SpendByPersonCard({ spendByPerson, periodLabel }: { spendByPerson: PersonSpend[]; periodLabel: string }) {
  const total = spendByPerson.reduce((s, p) => s + p.spent, 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Spending by person
      </h2>
      {total === 0 ? (
        <p className="text-sm text-slate-400">No expenses logged {periodLabel} yet.</p>
      ) : (
        <div className="space-y-3">
          {spendByPerson.map((p) => {
            const pct = total > 0 ? Math.round((p.spent / total) * 100) : 0;
            return (
              <div key={p.userId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{formatMoney(p.spent)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GoalsCard({ goals }: { goals: GoalSummary[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Savings goals
        </h2>
        <Link to="/goals" className="text-xs font-medium text-indigo-600 hover:underline">
          Manage
        </Link>
      </div>
      {goals.length === 0 ? (
        <p className="text-sm text-slate-400">No goals yet.</p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
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
  );
}
