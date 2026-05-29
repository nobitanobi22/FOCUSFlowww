"use client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function heat(score: number): string {
  if (score > 0.8) return "bg-emerald-500";
  if (score > 0.6) return "bg-emerald-700";
  if (score > 0.4) return "bg-amber-700";
  if (score > 0.2) return "bg-red-800";
  return "bg-slate-800";
}

interface Props {
  bestFocusHour?: number;
}

// Generate a plausible heatmap for visualisation (real data would come from backend)
function mockHeatmap(bestHour?: number) {
  const data: Record<string, number[]> = {};
  DAYS.forEach((d) => {
    data[d] = HOURS.map((h) => {
      if (bestHour !== undefined && Math.abs(h - bestHour) <= 1) {
        return 0.7 + Math.random() * 0.3;
      }
      if (h < 6 || h > 23) return 0;
      return Math.random() * 0.5;
    });
  });
  return data;
}

export default function PatternHeatmap({ bestFocusHour }: Props) {
  const data = mockHeatmap(bestFocusHour);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 text-slate-600 text-xs mb-1 ml-10">
        {HOURS.filter((h) => h % 3 === 0).map((h) => (
          <span key={h} style={{ width: 28 }} className="text-center shrink-0">
            {h}h
          </span>
        ))}
      </div>
      {DAYS.map((day) => (
        <div key={day} className="flex items-center gap-1 mb-0.5">
          <span className="text-slate-500 text-xs w-9 shrink-0 text-right pr-1">{day}</span>
          {HOURS.map((h) => (
            <div
              key={h}
              title={`${day} ${h}:00 — ${Math.round(data[day][h] * 100)}%`}
              className={`w-5 h-5 rounded-sm shrink-0 ${heat(data[day][h])}`}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
        <span>Low</span>
        {["bg-red-800","bg-amber-700","bg-emerald-700","bg-emerald-500"].map((c) => (
          <div key={c} className={`w-4 h-4 rounded-sm ${c}`} />
        ))}
        <span>High focus</span>
      </div>
    </div>
  );
}
