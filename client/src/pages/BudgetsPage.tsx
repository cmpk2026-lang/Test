import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { useMonth } from '../context/MonthContext';
import type { Budget, Category } from '../types';
import { formatMoney } from '../utils';

export function BudgetsPage() {
  const { month } = useMonth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Budget[]>('/budgets', { params: { month } }),
      api.get<Category[]>('/categories'),
    ])
      .then(([b, c]) => {
        setBudgets(b.data);
        setCategories(c.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [month]);

  const budgetForCategory = (categoryId: number) => budgets.find((b) => b.categoryId === categoryId);

  const startEdit = (categoryId: number) => {
    const existing = budgetForCategory(categoryId);
    setAmountInput(existing ? String(existing.amount) : '');
    setEditingCategoryId(categoryId);
    setError('');
  };

  const save = async (categoryId: number) => {
    if (!amountInput || Number(amountInput) < 0) {
      setError('Enter a valid budget amount');
      return;
    }
    try {
      await api.post('/budgets', { categoryId, month, amount: Number(amountInput) });
      setEditingCategoryId(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save budget'));
    }
  };

  const remove = async (budgetId: number) => {
    await api.delete(`/budgets/${budgetId}`);
    load();
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Budgets</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatMoney(totalSpent)} spent of {formatMoney(totalBudget)} budgeted this month
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const budget = budgetForCategory(c.id);
            const spent = budget?.spent ?? 0;
            const amount = budget?.amount ?? 0;
            const pct = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0;
            const over = amount > 0 && spent > amount;
            const isEditing = editingCategoryId === c.id;

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <span>{c.icon}</span> {c.name}
                  </span>
                  {budget && !isEditing && (
                    <button
                      onClick={() => remove(budget.id)}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      autoFocus
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                    {error && <p className="text-xs text-rose-500">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => save(c.id)}
                        className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCategoryId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                        {formatMoney(spent)}
                      </span>
                      <span className="text-xs text-slate-400">of {formatMoney(amount)}</span>
                    </div>
                    <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${over ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <button
                      onClick={() => startEdit(c.id)}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      {budget ? 'Edit budget' : 'Set budget'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
