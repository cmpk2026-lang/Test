import { useEffect, useMemo, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { useMonth } from '../context/MonthContext';
import { useAuth } from '../context/AuthContext';
import type { Category, Expense, SplitType } from '../types';
import { formatMoney, todayISO } from '../utils';

interface FormState {
  id?: number;
  categoryId: string;
  payerId: string;
  amount: string;
  description: string;
  date: string;
  splitType: SplitType;
  customSplits: Record<number, string>;
}

function emptyForm(defaultPayer: number | undefined): FormState {
  return {
    categoryId: '',
    payerId: defaultPayer ? String(defaultPayer) : '',
    amount: '',
    description: '',
    date: todayISO(),
    splitType: 'equal',
    customSplits: {},
  };
}

export function ExpensesPage() {
  const { month } = useMonth();
  const { user, members } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(user?.id));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Expense[]>('/expenses', { params: { month } }),
      api.get<Category[]>('/categories'),
    ])
      .then(([e, c]) => {
        setExpenses(e.data);
        setCategories(c.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [month]);

  useEffect(() => {
    if (user && !form.payerId) setForm((f) => ({ ...f, payerId: String(user.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setForm(emptyForm(user?.id));
    setError('');
    setShowForm(true);
  };

  const openEdit = (e: Expense) => {
    const customSplits: Record<number, string> = {};
    for (const s of e.splits) customSplits[s.userId] = String(s.shareAmount);
    setForm({
      id: e.id,
      categoryId: e.categoryId ? String(e.categoryId) : '',
      payerId: String(e.payerId),
      amount: String(e.amount),
      description: e.description,
      date: e.date,
      splitType: e.splitType,
      customSplits,
    });
    setError('');
    setShowForm(true);
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    load();
  };

  const submit = async () => {
    setError('');
    if (!form.payerId || !form.amount || !form.date) {
      setError('Payer, amount, and date are required');
      return;
    }
    const payload: Record<string, unknown> = {
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      payerId: Number(form.payerId),
      amount: Number(form.amount),
      description: form.description,
      date: form.date,
      splitType: form.splitType,
    };
    if (form.splitType === 'custom') {
      payload.splits = members.map((m) => ({ userId: m.id, amount: Number(form.customSplits[m.id] || 0) }));
    }
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/expenses/${form.id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save expense'));
    } finally {
      setSaving(false);
    }
  };

  const customSplitTotal = members.reduce((s, m) => s + Number(form.customSplits[m.id] || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {expenses.length} expense{expenses.length === 1 ? '' : 's'} · {formatMoney(total)} total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Add expense
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {form.id ? 'Edit expense' : 'New expense'}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
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
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Paid by</label>
              <select
                value={form.payerId}
                onChange={(e) => setForm({ ...form, payerId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Trader Joe's"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Split</label>
              <div className="flex gap-2">
                {(['equal', 'custom', 'personal'] as SplitType[]).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setForm({ ...form, splitType: t })}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                      form.splitType === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {t === 'personal' ? 'Just me' : t}
                  </button>
                ))}
              </div>
              {form.splitType === 'custom' && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600 dark:text-slate-300">{m.name}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.customSplits[m.id] ?? ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            customSplits: { ...form.customSplits, [m.id]: e.target.value },
                          })
                        }
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  ))}
                  <p className="text-xs text-slate-400">
                    Splits total {formatMoney(customSplitTotal)} of {formatMoney(Number(form.amount || 0))}
                  </p>
                </div>
              )}
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
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
        ) : expenses.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No expenses logged for this month yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenses.map((e) => {
              const cat = e.categoryId ? categoryMap[e.categoryId] : null;
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat?.icon ?? '💰'}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {e.description || cat?.name || 'Expense'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {e.date} · paid by {memberMap[e.payerId]?.name ?? '—'} ·{' '}
                        {e.splitType === 'personal' ? 'not shared' : e.splitType === 'custom' ? 'custom split' : 'split equally'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {formatMoney(e.amount)}
                    </span>
                    <button
                      onClick={() => openEdit(e)}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(e.id)}
                      className="text-xs font-medium text-rose-500 hover:underline"
                    >
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
