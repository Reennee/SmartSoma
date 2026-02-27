// === FILE: components/MasteryRadar.tsx ===
"use client";

import { motion } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

interface RadarDatum {
  subject: string;
  mastery: number;
}

interface Props {
  data: Array<{ subject: string; mastery: number }>;
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

function GlassTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-sm px-3 py-2.5 rounded-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <p className="text-xs text-white/50 mb-1 font-medium truncate max-w-[140px]">
        {label}
      </p>
      <p className="text-sm font-bold text-white">
        {payload[0].value ?? 0}
        <span className="text-white/40 font-normal">% mastery</span>
      </p>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-[280px] gap-3"
    >
      <span className="w-12 h-12 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
        <svg
          className="w-5 h-5 text-white/20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </span>
      <p className="text-sm text-white/30 font-medium">No competency data yet</p>
      <p className="text-xs text-white/20">Start studying to build your mastery map</p>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MasteryRadar({ data }: Props) {
  if (!data.length) return <EmptyState />;

  const chartData: RadarDatum[] = data.slice(0, 8).map((d) => ({
    subject:
      d.subject.length > 16 ? d.subject.slice(0, 16) + "…" : d.subject,
    mastery: Math.round(d.mastery),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart
          data={chartData}
          margin={{ top: 12, right: 24, bottom: 12, left: 24 }}
        >
          {/* Grid rings */}
          <PolarGrid
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="3 3"
            gridType="polygon"
          />

          {/* Axis labels */}
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: "rgba(255,255,255,0.45)",
              fontSize: 10,
              fontWeight: 500,
            }}
            tickLine={false}
          />

          {/* Filled area */}
          <Radar
            name="Mastery"
            dataKey="mastery"
            stroke="transparent"
            fill="rgba(139,92,246,0.28)"
            fillOpacity={1}
            isAnimationActive
            animationBegin={100}
            animationDuration={900}
            animationEasing="ease-out"
          />

          {/* Stroke line on top */}
          <Radar
            name="Mastery outline"
            dataKey="mastery"
            stroke="#a78bfa"
            strokeWidth={2}
            fill="transparent"
            dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#c4b5fd", strokeWidth: 0 }}
            isAnimationActive={false}
          />

          <Tooltip
            content={GlassTooltip}
            cursor={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
