import { useParams } from "react-router-dom";
import { BalanceChart } from "../components/BalanceChart";
import { FlowChart } from "../components/FlowChart";
import { useProjectSummary } from "../hooks/useProjectSummary";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const { summary, loading } = useProjectSummary(id);

  if (loading || !summary) {
    return <p className="p-6">Caricamento...</p>;
  }

  const balance = Number(summary.balance);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className={`text-3xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
        {balance.toFixed(2)} €
      </p>

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
    </div>
  );
}
