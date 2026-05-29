"use client";
import { useMemo } from "react";

interface Props {
  score: number; // 0.0 – 1.0
  size?: number;
}

export default function DriftGauge({ score, size = 220 }: Props) {
  const pct = Math.max(0, Math.min(1, score));
  const displayScore = Math.round(pct * 100);

  const color = useMemo(() => {
    if (pct < 0.3) return "#22c55e";   // green  – focused
    if (pct < 0.6) return "#f59e0b";   // amber  – drifting
    return "#ef4444";                   // red    – deeply drifted
  }, [pct]);

  // SVG arc math
  const r = 80;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;  // half-circle

  // Start at 180° (left), end at 0° (right), bottom half facing down
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center select-none">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#1e293b"
          strokeWidth="18"
          strokeLinecap="round"
        />
        {/* Animated foreground arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease",
          }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fill={color}
          fontSize="42"
          fontWeight="700"
          fontFamily="monospace"
          style={{ transition: "fill 0.4s ease" }}
        >
          {displayScore}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fill="#64748b"
          fontSize="13"
          fontFamily="monospace"
        >
          DRIFT SCORE
        </text>
        {/* Min / Max labels */}
        <text x={cx - r - 2} y={cy + 24} fill="#334155" fontSize="11" textAnchor="middle">0</text>
        <text x={cx + r + 2} y={cy + 24} fill="#334155" fontSize="11" textAnchor="middle">100</text>
      </svg>
    </div>
  );
}
