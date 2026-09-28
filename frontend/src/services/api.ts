import type {
  Project,
  ProjectSummary,
  RecentTransaction,
  Transaction,
} from "../types";

const TOKEN_KEY = "finance_tracker_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, body.detail ?? "Errore sconosciuto");
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<string> {
  const data = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return data.access_token;
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return request<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

export function getProjects(): Promise<Project[]> {
  return request<Project[]>("/projects");
}

export function getProject(id: number): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export function createProject(name: string): Promise<Project> {
  return request<Project>("/projects", { method: "POST", body: JSON.stringify({ name }) });
}

export function updateProject(id: number, name: string): Promise<Project> {
  return request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export function deleteProject(id: number): Promise<void> {
  return request<void>(`/projects/${id}`, { method: "DELETE" });
}

export function getProjectSummary(id: number): Promise<ProjectSummary> {
  return request<ProjectSummary>(`/projects/${id}/summary`);
}

export function suggestCategories(projectId: number): Promise<string[]> {
  return request<string[]>(`/projects/${projectId}/categories/suggest`);
}

export interface TransactionFilters {
  fromDate?: string;
  toDate?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export function getTransactions(
  projectId: number,
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (filters.fromDate) params.set("from_date", filters.fromDate);
  if (filters.toDate) params.set("to_date", filters.toDate);
  if (filters.category) params.set("category", filters.category);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  const query = params.toString();
  return request<Transaction[]>(`/projects/${projectId}/transactions${query ? `?${query}` : ""}`);
}

export interface TransactionInput {
  amount: number;
  date: string;
  note: string | null;
  category: string | null;
}

export function createTransaction(projectId: number, data: TransactionInput): Promise<Transaction> {
  return request<Transaction>(`/projects/${projectId}/transactions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTransaction(
  projectId: number,
  txId: number,
  data: Partial<TransactionInput>,
): Promise<Transaction> {
  return request<Transaction>(`/projects/${projectId}/transactions/${txId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(projectId: number, txId: number): Promise<void> {
  return request<void>(`/projects/${projectId}/transactions/${txId}`, { method: "DELETE" });
}

export function getRecentTransactions(limit = 10): Promise<RecentTransaction[]> {
  return request<RecentTransaction[]>(`/dashboard/recent?limit=${limit}`);
}
