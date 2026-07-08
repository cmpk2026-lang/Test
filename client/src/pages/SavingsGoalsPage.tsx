import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { SavingsGoal } from '../types';
import { formatMoney, todayISO } from '../utils';

const ICONS = ['🎯', '✈️', '🏡', '💍', '🚗', '🎓', '🐣', '🎉'];

export function SavingsGoalsPage() {
  const { user, members } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [error, setError] = useState('');

  const [contributingId, setContributingId] = useState<number | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribUser, setContribUser] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get<SavingsGoal[]>('/savings-goals')
      .then((res) => setGoals(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

  const submit = async () => {
    setError('');
    if (!name || !targetAmount) {
      setError('Name and target amount are required');
      return;
    }
    try {
      await api.post('/savings-goals', {
        name,
        targetAmount: Number(targetAmount),
        targetDate: targetDate || null,
        icon,
      });
      setShowForm(false);
      setName('');
      setTargetAmount('');
      setTargetDate('');
      setIcon(ICONS[0]);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create goal'));
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this savings goal?')) return;
    await api.delete(`/savings-goals/${id}`);
    load();
  };

  const startContribute = (goal: SavingsGoal) => {
    setContributingId(goal.id);
    setContribAmount('');
    setContribUser(String(user?.id ?? members[0]?.id ?? ''));
  };

  const confirmContribute = async (goal: SavingsGoal) => {
    if (!contribAmount || Number(contribAmount) <= 0) return;
    try {
      await api.post(`/savings-goals/${goal.id}/contribute`, {
        userId: Number(contribUser),
        amount: Number(contribAmount),
        date: todayISO(),
      });
      setContributingId(null);
      load();
    } catch (err) {
      alert(apiErrorMessage(err, 'Could not add contribution'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Savings goals</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Save toward the things you both want</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setError('');
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Add goal
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex gap-2">
            {ICONS.map((i) => (
              <button
                key={i}
                onClick={() => setIcon(i)}
                className={`grid h-9 w-9 place-items-center rounded-lg text-lg ${
                  icon === i ? 'bg-indigo-100 dark:bg-indigo-900' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Goal name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Trip to Japan"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Target amount</label>
              <input
                type="number"
                min="0"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Target date (optional)</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={submit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-slate-400">No savings goals yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
            return (
              <div
                key={g.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <span className="text-xl">{g.icon}</span> {g.name}
                  </span>
                  <button onClick={() => remove(g.id)} className="text-xs text-rose-500 hover:underline">
                    Delete
                  </button>
                </div>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                    {formatMoney(g.currentAmount)}
                  </span>
                  <span className="text-xs text-slate-400">of {formatMoney(g.targetAmount)}</span>
                </div>
                <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
                {g.targetDate && <p className="mb-2 text-xs text-slate-400">Target: {g.targetDate}</p>}

                {contributingId === g.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={contribUser}
                      onChange={(e) => setContribUser(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={contribAmount}
                      onChange={(e) => setContribAmount(e.target.value)}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <button
                      onClick={() => confirmContribute(g)}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                    >
                      Add
                    </button>
                    <button onClick={() => setContributingId(null)} className="text-xs text-slate-500 hover:underline">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startContribute(g)}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    + Add contribution
                  </button>
                )}

                {g.contributions.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-slate-800">
                    {g.contributions.slice(0, 3).map((c) => (
                      <li key={c.id} className="flex justify-between">
                        <span>
                          {memberMap[c.userId]?.name ?? 'Someone'} · {c.date}
                        </span>
                        <span>{formatMoney(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
