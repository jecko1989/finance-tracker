import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BalancePoint } from "../types";

export function BalanceChart({ data }: { data: BalancePoint[] }) {
  if (data.length === 0) {
    return <p className="text-slate-500">Nessun dato ancora da mostrare.</p>;
  }

  const chartData = data.map((point) => ({ date: point.date, balance: Number(point.balance) }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="balance" stroke="#1e293b" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
