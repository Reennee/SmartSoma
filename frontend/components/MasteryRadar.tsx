"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { MasteryEntry } from "@/lib/api";

interface Props {
  data: MasteryEntry[];
}

export default function MasteryRadar({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-white/40 text-sm">
        No mastery data yet — start studying!
      </div>
    );
  }

  const chartData = data.slice(0, 8).map((d) => ({
    subject: d.competency_name.length > 18
      ? d.competency_name.slice(0, 18) + "…"
      : d.competency_name,
    mastery: Math.round(d.mastery_score * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
        />
        <Radar
          name="Mastery"
          dataKey="mastery"
          stroke="#60a5fa"
          fill="#60a5fa"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e3a5f",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "8px",
            color: "white",
            fontSize: 12,
          }}
          formatter={(value: number | undefined) => [`${value ?? 0}%`, "Mastery"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
