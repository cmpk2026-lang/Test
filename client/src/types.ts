export interface Member {
  id: number;
  name: string;
  color: string;
}

export interface Household {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  household_id: number;
  name: string;
  icon: string;
  color: string;
}

export type SplitType = 'equal' | 'custom' | 'personal';

export interface ExpenseSplit {
  userId: number;
  shareAmount: number;
}

export interface Expense {
  id: number;
  categoryId: number | null;
  payerId: number;
  amount: number;
  description: string;
  date: string;
  splitType: SplitType;
  createdAt: string;
  splits: ExpenseSplit[];
}

export interface Budget {
  id: number;
  categoryId: number;
  month: string;
  amount: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  spent: number;
}

export interface RecurringBill {
  id: number;
  categoryId: number | null;
  name: string;
  amount: number;
  dueDay: number;
  splitType: SplitType;
  active: boolean;
  paidThisMonth: boolean;
  payment: { paidBy: number; paidDate: string; amount: number } | null;
}

export interface SavingsContribution {
  id: number;
  userId: number;
  amount: number;
  date: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  icon: string;
  targetAmount: number;
  targetDate: string | null;
  currentAmount: number;
  contributions: SavingsContribution[];
}

export interface BalanceMember {
  userId: number;
  name: string;
  color: string;
  paid: number;
  owed: number;
  net: number;
}

export interface Balance {
  members: BalanceMember[];
  settlement: { fromUserId: number | null; toUserId: number | null; amount: number } | null;
}

export interface CategorySpend {
  categoryId: number | null;
  name: string;
  icon: string;
  color: string;
  spent: number;
  budget: number;
}

export interface GoalSummary {
  id: number;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
}

export interface PersonSpend {
  userId: number;
  name: string;
  color: string;
  spent: number;
}

export interface DashboardData {
  month: string;
  totalSpent: number;
  totalBudget: number;
  spendByCategory: CategorySpend[];
  spendByPerson: PersonSpend[];
  recentExpenses: Array<{
    id: number;
    amount: number;
    description: string;
    date: string;
    payerId: number;
    categoryName: string | null;
    categoryIcon: string | null;
  }>;
  balance: Balance;
  upcomingBills: Array<{ id: number; name: string; amount: number; dueDay: number; paid: boolean }>;
  goals: GoalSummary[];
}

export interface YearDashboardData {
  year: string;
  totalSpent: number;
  totalBudget: number;
  spendByCategory: CategorySpend[];
  spendByPerson: PersonSpend[];
  monthlyTrend: Array<{ month: string; spent: number }>;
  balance: Balance;
  goals: GoalSummary[];
}
