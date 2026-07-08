import { useMonth } from '../context/MonthContext';

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function MonthPicker() {
  const { month, shiftMonth } = useMonth();
  return (
    <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <button
        onClick={() => shiftMonth(-1)}
        className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Previous month"
      >
        ‹
      </button>
      <span className="min-w-[9rem] text-center text-sm font-medium text-slate-700 dark:text-slate-200">
        {formatMonthLabel(month)}
      </span>
      <button
        onClick={() => shiftMonth(1)}
        className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  );
}
