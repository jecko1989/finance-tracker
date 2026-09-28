export interface Project {
  id: number;
  name: string;
  balance: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  project_id: number;
  amount: string;
  date: string;
  note: string | null;
  category: string | null;
  created_at: string;
}

export interface RecentTransaction {
  id: number;
  project_id: number;
  project_name: string;
  amount: string;
  date: string;
  note: string | null;
  category: string | null;
}

export interface BalancePoint {
  date: string;
  balance: string;
}

export interface FlowPoint {
  period: string;
  income: string;
  expense: string;
}

export interface ProjectSummary {
  balance: string;
  cumulative: BalancePoint[];
  flow: FlowPoint[];
}
