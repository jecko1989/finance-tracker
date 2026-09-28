import type { Transaction } from "../types";

interface Props {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TransactionList({ transactions, onEdit, onDelete }: Props) {
  if (transactions.length === 0) {
    return <p className="text-slate-500">Nessuna transazione in questo periodo.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-slate-500">
          <th className="py-2">Data</th>
          <th>Nota</th>
          <th>Categoria</th>
          <th className="text-right">Importo</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => {
          const amount = Number(tx.amount);
          return (
            <tr key={tx.id} className="border-b">
              <td className="py-2">{tx.date}</td>
              <td>{tx.note ?? "—"}</td>
              <td>{tx.category ?? "—"}</td>
              <td className={`text-right ${amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {amount.toFixed(2)} €
              </td>
              <td className="text-right">
                <button onClick={() => onEdit(tx)} className="mr-2 text-slate-500 hover:underline">
                  Modifica
                </button>
                <button onClick={() => onDelete(tx)} className="text-red-500 hover:underline">
                  Elimina
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
