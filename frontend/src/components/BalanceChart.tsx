import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BalancePoint } from "../types";
import { useChartColors } from "./chartTheme";

export function BalanceChart({ data }: { data: BalancePoint[] }) {
  const c = useChartColors();

  if (data.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">Nessun dato ancora da mostrare.</p>;
  }

  const chartData = data.map((point) => ({ date: point.date, balance: Number(point.balance) }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis dataKey="date" stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} />
        <YAxis stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} />
        <Tooltip {...c.tooltip} />
        <Line type="monotone" dataKey="balance" stroke={c.line} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
