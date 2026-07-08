import { createContext, useContext, useState, type ReactNode } from 'react';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

interface MonthContextValue {
  month: string;
  setMonth: (m: string) => void;
  shiftMonth: (delta: number) => void;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth());

  const shiftMonth = (delta: number) => {
    setMonth((prev) => {
      const [y, m] = prev.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  };

  return <MonthContext.Provider value={{ month, setMonth, shiftMonth }}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error('useMonth must be used within MonthProvider');
  return ctx;
}
