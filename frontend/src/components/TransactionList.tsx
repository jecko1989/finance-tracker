import { cardClass, negativeText, positiveText } from "../styles";
import type { Transaction } from "../types";

interface Props {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TransactionList({ transactions, onEdit, onDelete }: Props) {
  if (transactions.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">Nessuna transazione in questo periodo.</p>;
  }

  return (
    <div className={`overflow-x-auto ${cardClass}`}>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <th className="px-4 py-2 font-medium">Data</th>
          <th className="px-2 font-medium">Nota</th>
          <th className="px-2 font-medium">Categoria</th>
          <th className="px-2 text-right font-medium">Importo</th>
          <th className="px-4" />
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => {
          const amount = Number(tx.amount);
          return (
            <tr key={tx.id} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
              <td className="px-4 py-2">{tx.date}</td>
              <td className="px-2">{tx.note ?? "—"}</td>
              <td className="px-2">{tx.category ?? "—"}</td>
              <td className={`px-2 text-right tabular-nums ${amount >= 0 ? positiveText : negativeText}`}>
                {amount.toFixed(2)} €
              </td>
              <td className="whitespace-nowrap px-4 text-right">
                <button onClick={() => onEdit(tx)} className="mr-2 text-gray-500 hover:underline dark:text-gray-400">
                  Modifica
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Eliminare questa transazione?")) {
                      onDelete(tx);
                    }
                  }}
                  className="text-red-500 hover:underline dark:text-red-400"
                >
                  Elimina
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
