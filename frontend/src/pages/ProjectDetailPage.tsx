import { useState } from "react";
import { useParams } from "react-router-dom";
import { BalanceChart } from "../components/BalanceChart";
import { FlowChart } from "../components/FlowChart";
import { TransactionFormModal } from "../components/TransactionFormModal";
import { TransactionList } from "../components/TransactionList";
import { useCategorySuggestions } from "../hooks/useCategorySuggestions";
import { useProjectSummary } from "../hooks/useProjectSummary";
import { useTransactions } from "../hooks/useTransactions";
import * as api from "../services/api";
import type { Transaction } from "../types";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);

  const { summary, loading: summaryLoading } = useProjectSummary(id);
  const [filters, setFilters] = useState<{ fromDate?: string; toDate?: string; category?: string }>({});
  const { transactions, refresh } = useTransactions(id, filters);
  const categorySuggestions = useCategorySuggestions(id);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  async function handleDelete(tx: Transaction) {
    await api.deleteTransaction(id, tx.id);
    await refresh();
  }

  if (summaryLoading || !summary) {
    return <p className="p-6">Caricamento...</p>;
  }

  const balance = Number(summary.balance);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <p className={`text-3xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {balance.toFixed(2)} €
        </p>
        <button
          onClick={() => setCreating(true)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-white"
        >
          Nuova transazione
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Andamento saldo</h2>
          <BalanceChart data={summary.cumulative} />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Entrate/uscite per mese</h2>
          <FlowChart data={summary.flow} />
        </div>
      </div>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Transazioni</h2>
      <div className="mb-3 flex gap-2 text-sm">
        <input
          type="date"
          value={filters.fromDate ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value || undefined }))}
          className="rounded border px-2 py-1"
        />
        <input
          type="date"
          value={filters.toDate ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value || undefined }))}
          className="rounded border px-2 py-1"
        />
        <input
          placeholder="Categoria"
          value={filters.category ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
          className="rounded border px-2 py-1"
        />
      </div>

      <TransactionList transactions={transactions} onEdit={setEditing} onDelete={handleDelete} />

      {creating && (
        <TransactionFormModal
          categorySuggestions={categorySuggestions}
          onSubmit={async (data) => {
            await api.createTransaction(id, data);
            await refresh();
          }}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <TransactionFormModal
          categorySuggestions={categorySuggestions}
          initial={editing}
          onSubmit={async (data) => {
            await api.updateTransaction(id, editing.id, data);
            await refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
