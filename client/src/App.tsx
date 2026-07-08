import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MonthProvider } from './context/MonthContext';
import { Layout } from './components/Layout';
import { EnterPage } from './pages/EnterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { RecurringBillsPage } from './pages/RecurringBillsPage';
import { SavingsGoalsPage } from './pages/SavingsGoalsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/enter" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route
        path="/enter"
        element={!loading && user ? <Navigate to="/" replace /> : <EnterPage />}
      />
      <Route
        element={
          <ProtectedRoute>
            <MonthProvider>
              <Layout />
            </MonthProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/bills" element={<RecurringBillsPage />} />
        <Route path="/goals" element={<SavingsGoalsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
