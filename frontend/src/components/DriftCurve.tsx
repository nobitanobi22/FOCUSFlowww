"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { DriftPoint } from "@/types";

interface Props {
  data: DriftPoint[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DriftPoint;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs max-w-52">
      <p className="text-slate-300 font-semibold mb-1">
        Drift: {Math.round(d.drift_score * 100)}%
      </p>
      <p className="text-slate-500 truncate">{d.url}</p>
    </div>
  );
};

export default function DriftCurve({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
        No data yet
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    ...d,
    index: i + 1,
    score: Math.round(d.drift_score * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="index"
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 4" opacity={0.4} />
        <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="4 4" opacity={0.4} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#818cf8" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
