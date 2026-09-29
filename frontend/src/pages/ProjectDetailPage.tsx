import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BalanceChart } from "../components/BalanceChart";
import { FlowChart } from "../components/FlowChart";
import { TransactionFormModal } from "../components/TransactionFormModal";
import { TransactionList } from "../components/TransactionList";
import { useCategorySuggestions } from "../hooks/useCategorySuggestions";
import { useProjectSummary } from "../hooks/useProjectSummary";
import { useTransactions } from "../hooks/useTransactions";
import * as api from "../services/api";
import { btnPrimary, btnSecondary, cardClass, filterInputClass, negativeText, positiveText } from "../styles";
import type { Transaction } from "../types";

const PAGE_SIZE = 20;

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);

  const [filters, setFilters] = useState<{ fromDate?: string; toDate?: string; category?: string }>({});
  const [offset, setOffset] = useState(0);

  const { summary, loading: summaryLoading, refresh: refreshSummary } = useProjectSummary(id);
  const { transactions, refresh: refreshTransactions } = useTransactions(id, {
    ...filters,
    limit: PAGE_SIZE,
    offset,
  });
  const { suggestions: categorySuggestions, refresh: refreshCategories } = useCategorySuggestions(id);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  async function refreshAll() {
    await Promise.all([refreshTransactions(), refreshSummary(), refreshCategories()]);
  }

  async function handleDelete(tx: Transaction) {
    await api.deleteTransaction(id, tx.id);
    await refreshAll();
  }

  if (Number.isNaN(id)) {
    return <p className={`p-6 ${negativeText}`}>Progetto non valido.</p>;
  }

  if (summaryLoading || !summary) {
    return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Caricamento...</p>;
  }

  const balance = Number(summary.balance);

  return (
    <div>
      <Link to="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
        ← Progetti
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <p className={`text-3xl font-bold ${balance >= 0 ? positiveText : negativeText}`}>
          {balance.toFixed(2)} €
        </p>
        <button onClick={() => setCreating(true)} className={btnPrimary}>
          Nuova transazione
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className={`p-4 ${cardClass}`}>
          <h2 className="mb-2 text-lg font-semibold">Andamento saldo</h2>
          <BalanceChart data={summary.cumulative} />
        </div>
        <div className={`p-4 ${cardClass}`}>
          <h2 className="mb-2 text-lg font-semibold">Entrate/uscite per mese</h2>
          <FlowChart data={summary.flow} />
        </div>
      </div>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Transazioni</h2>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <input
          type="date"
          value={filters.fromDate ?? ""}
          onChange={(e) => {
            setOffset(0);
            setFilters((f) => ({ ...f, fromDate: e.target.value || undefined }));
          }}
          className={filterInputClass}
        />
        <input
          type="date"
          value={filters.toDate ?? ""}
          onChange={(e) => {
            setOffset(0);
            setFilters((f) => ({ ...f, toDate: e.target.value || undefined }));
          }}
          className={filterInputClass}
        />
        <input
          placeholder="Categoria"
          value={filters.category ?? ""}
          onChange={(e) => {
            setOffset(0);
            setFilters((f) => ({ ...f, category: e.target.value || undefined }));
          }}
          className={filterInputClass}
        />
      </div>

      <TransactionList transactions={transactions} onEdit={setEditing} onDelete={handleDelete} />

      <div className="mt-3 flex items-center justify-end gap-2 text-sm">
        <button
          onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          disabled={offset === 0}
          className={btnSecondary}
        >
          Precedenti
        </button>
        <button
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
          disabled={transactions.length < PAGE_SIZE}
          className={btnSecondary}
        >
          Successive
        </button>
      </div>

      {creating && (
        <TransactionFormModal
          categorySuggestions={categorySuggestions}
          onSubmit={async (data) => {
            await api.createTransaction(id, data);
            await refreshAll();
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
            await refreshAll();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
