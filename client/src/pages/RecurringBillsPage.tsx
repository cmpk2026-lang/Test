import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { useMonth } from '../context/MonthContext';
import { useAuth } from '../context/AuthContext';
import type { Category, RecurringBill, SplitType } from '../types';
import { formatMoney, todayISO } from '../utils';

interface FormState {
  name: string;
  amount: string;
  dueDay: string;
  categoryId: string;
  splitType: SplitType;
}

function emptyForm(): FormState {
  return { name: '', amount: '', dueDay: '1', categoryId: '', splitType: 'equal' };
}

export function RecurringBillsPage() {
  const { month } = useMonth();
  const { user, members } = useAuth();
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payerId, setPayerId] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<RecurringBill[]>('/recurring-bills', { params: { month } }),
      api.get<Category[]>('/categories'),
    ])
      .then(([b, c]) => {
        setBills(b.data);
        setCategories(c.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [month]);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

  const submit = async () => {
    setError('');
    if (!form.name || !form.amount) {
      setError('Name and amount are required');
      return;
    }
    try {
      await api.post('/recurring-bills', {
        name: form.name,
        amount: Number(form.amount),
        dueDay: Number(form.dueDay) || 1,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        splitType: form.splitType,
      });
      setShowForm(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save bill'));
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this recurring bill?')) return;
    await api.delete(`/recurring-bills/${id}`);
    load();
  };

  const startPay = (bill: RecurringBill) => {
    setPayingId(bill.id);
    setPayerId(String(user?.id ?? members[0]?.id ?? ''));
  };

  const confirmPay = async (bill: RecurringBill) => {
    try {
      await api.post(`/recurring-bills/${bill.id}/pay`, {
        month,
        paidBy: Number(payerId),
        amount: bill.amount,
        date: todayISO(),
      });
      setPayingId(null);
      load();
    } catch (err) {
      alert(apiErrorMessage(err, 'Could not mark as paid'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recurring bills</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Rent, subscriptions, utilities, and more</p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm());
            setError('');
            setShowForm(true);
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Add bill
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Rent"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Due day of month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Split</label>
              <div className="flex gap-2">
                {(['equal', 'personal'] as SplitType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, splitType: t })}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                      form.splitType === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {t === 'personal' ? 'Just one person' : 'Split equally'}
                  </button>
                ))}
              </div>
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <p className="p-5 text-sm text-slate-400">Loading…</p>
        ) : bills.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No recurring bills yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {bills.map((b) => {
              const cat = b.categoryId ? categoryMap[b.categoryId] : null;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat?.icon ?? '📅'}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{b.name}</p>
                      <p className="text-xs text-slate-400">
                        Due day {b.dueDay} · {formatMoney(b.amount)} ·{' '}
                        {b.splitType === 'personal' ? 'not shared' : 'split equally'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.paidThisMonth ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                        Paid by {memberMap[b.payment!.paidBy]?.name}
                      </span>
                    ) : payingId === b.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={payerId}
                          onChange={(e) => setPayerId(e.target.value)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => confirmPay(b)}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setPayingId(null)}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startPay(b)}
                        className="rounded-lg border border-emerald-500 px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      >
                        Mark paid
                      </button>
                    )}
                    <button onClick={() => remove(b.id)} className="text-xs font-medium text-rose-500 hover:underline">
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
