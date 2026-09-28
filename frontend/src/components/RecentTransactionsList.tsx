import { Link } from "react-router-dom";
import type { RecentTransaction } from "../types";

export function RecentTransactionsList({ transactions }: { transactions: RecentTransaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-slate-500">Nessuna transazione registrata.</p>;
  }

  return (
    <ul className="divide-y rounded-lg border bg-white">
      {transactions.map((tx) => {
        const amount = Number(tx.amount);
        return (
          <li key={tx.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div>
              <Link to={`/projects/${tx.project_id}`} className="font-medium hover:underline">
                {tx.project_name}
              </Link>
              <p className="text-slate-500">{tx.note ?? tx.category ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className={amount >= 0 ? "text-emerald-600" : "text-red-600"}>
                {amount.toFixed(2)} €
              </p>
              <p className="text-slate-400">{tx.date}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
