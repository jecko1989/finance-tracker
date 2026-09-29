import { Link } from "react-router-dom";
import { cardClass, negativeText, positiveText } from "../styles";
import type { RecentTransaction } from "../types";

export function RecentTransactionsList({ transactions }: { transactions: RecentTransaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">Nessuna transazione registrata.</p>;
  }

  return (
    <ul className={`divide-y divide-gray-100 dark:divide-gray-700 ${cardClass}`}>
      {transactions.map((tx) => {
        const amount = Number(tx.amount);
        return (
          <li key={tx.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div>
              <Link to={`/projects/${tx.project_id}`} className="font-medium text-gray-900 hover:underline dark:text-gray-100">
                {tx.project_name}
              </Link>
              <p className="text-gray-500 dark:text-gray-400">{tx.note ?? tx.category ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className={amount >= 0 ? positiveText : negativeText}>
                {amount.toFixed(2)} €
              </p>
              <p className="text-gray-400 dark:text-gray-500">{tx.date}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
