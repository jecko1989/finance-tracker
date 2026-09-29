import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FlowPoint } from "../types";
import { useChartColors } from "./chartTheme";

export function FlowChart({ data }: { data: FlowPoint[] }) {
  const c = useChartColors();

  if (data.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">Nessun dato ancora da mostrare.</p>;
  }

  const chartData = data.map((point) => ({
    period: point.period,
    income: Number(point.income),
    expense: Number(point.expense),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis dataKey="period" stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} />
        <YAxis stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} />
        <Tooltip {...c.tooltip} />
        <Legend wrapperStyle={{ color: c.axis }} />
        <Bar dataKey="income" fill={c.income} name="Entrate" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expense" fill={c.expense} name="Uscite" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
