import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FlowPoint } from "../types";

export function FlowChart({ data }: { data: FlowPoint[] }) {
  if (data.length === 0) {
    return <p className="text-slate-500">Nessun dato ancora da mostrare.</p>;
  }

  const chartData = data.map((point) => ({
    period: point.period,
    income: Number(point.income),
    expense: Number(point.expense),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="income" fill="#059669" name="Entrate" />
        <Bar dataKey="expense" fill="#dc2626" name="Uscite" />
      </BarChart>
    </ResponsiveContainer>
  );
}
