"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TrendingUp, BookOpen, Brain, Clock, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Navbar from "@/components/Navbar";
import MasteryRadar from "@/components/MasteryRadar";
import { studentApi, type StudentProgressOut } from "@/lib/api";
import { getToken } from "@/lib/auth";

// ─── Animated counter ─────────────────────────────────────────────────────────

function useCounter(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const start = performance.now();
    const from = valueRef.current;
    if (from === target) return;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);
      valueRef.current = next;
      setValue(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return value;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  rawValue: number;
  suffix?: string;
  icon: React.ReactNode;
  iconBg: string;
  index: number;
}

function StatCard({ label, rawValue, suffix = "", icon, iconBg, index }: StatCardProps) {
  const counted = useCounter(rawValue);
  return (
    <motion.div
      className="gcard p-5 flex items-center gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-white tabular-nums">
          {counted}{suffix}
        </p>
        <p className="text-xs text-white/45 mt-0.5 truncate">{label}</p>
      </div>
    </motion.div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-white/30">—</span>;
  }
  const cls =
    score >= 75
      ? "bg-green-500/15 text-green-300 border-green-500/25"
      : score >= 50
      ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25"
      : "bg-red-500/15 text-red-300 border-red-500/25";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {score}%
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProgressSkeleton() {
  return (
    <div className="app-bg">
      <div className="blob blob-blue  w-[480px] h-[480px] top-[-80px] left-[-120px] opacity-35" />
      <div className="blob blob-purple w-[380px] h-[380px] top-[300px] right-[-80px] opacity-28" />
      <div className="dot-grid absolute inset-0 pointer-events-none" />
      <div className="page-wrap">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          <div className="skeleton h-10 w-64 rounded-xl" />
          <div className="skeleton h-5 w-44 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="skeleton h-80 rounded-2xl" />
            <div className="skeleton h-80 rounded-2xl" />
          </div>
          <div className="skeleton h-64 rounded-2xl" />
        </main>
      </div>
    </div>
  );
}

// ─── Custom bar tooltip ───────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#0d1b35",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "white",
    fontSize: 12,
  },
};

function barTooltipFormatter(v: number | undefined): [string, string] {
  return [`${v ?? 0}%`, "Mastery"];
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<StudentProgressOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    studentApi.myProgress()
      .then(setProgress)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <ProgressSkeleton />;

  const overallPct = progress ? Math.round(progress.overall_mastery * 100) : 0;

  const barData = (progress?.competency_mastery ?? [])
    .sort((a, b) => b.mastery_score - a.mastery_score)
    .slice(0, 10)
    .map((d) => ({
      name:
        d.competency_name.length > 16
          ? d.competency_name.slice(0, 16) + "…"
          : d.competency_name,
      mastery: Math.round(d.mastery_score * 100),
    }));

  return (
    <div className="app-bg">
      {/* Blobs */}
      <div className="blob blob-blue  w-[500px] h-[500px] top-[-100px] left-[-130px] opacity-35" />
      <div className="blob blob-purple w-[400px] h-[400px] top-[280px] right-[-90px] opacity-28" />
      <div className="blob blob-cyan   w-[300px] h-[300px] bottom-[80px] left-[25%] opacity-20" />
      <div className="dot-grid absolute inset-0 pointer-events-none" />

      <div className="page-wrap">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-sm text-white/40 font-medium tracking-wide uppercase mb-1">
                  Learning analytics
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">
                  My&nbsp;<span className="grad-text">Progress</span>
                </h1>
              </div>
              {progress?.grade_level && (
                <span className="glass-sm px-3 py-1 text-sm font-semibold text-blue-300 rounded-full ml-2 mt-1">
                  Grade {progress.grade_level}
                </span>
              )}
            </div>
            {progress?.full_name && (
              <p className="mt-2 text-white/40 text-sm">{progress.full_name}</p>
            )}
          </motion.div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              index={0}
              label="Overall Mastery"
              rawValue={overallPct}
              suffix="%"
              iconBg="bg-linear-to-br from-blue-500/30 to-blue-600/20"
              icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
            />
            <StatCard
              index={1}
              label="Total Sessions"
              rawValue={progress?.total_interactions ?? 0}
              iconBg="bg-linear-to-br from-purple-500/30 to-purple-600/20"
              icon={<BookOpen className="w-5 h-5 text-purple-400" />}
            />
            <StatCard
              index={2}
              label="Competencies Tracked"
              rawValue={progress?.competency_mastery.length ?? 0}
              iconBg="bg-linear-to-br from-cyan-500/30 to-cyan-600/20"
              icon={<Brain className="w-5 h-5 text-cyan-400" />}
            />
          </div>

          {/* ── Charts row ── */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Bar chart */}
            <motion.div
              className="gcard p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">
                  Top 10 Competencies by Mastery
                </h2>
              </div>
              {barData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-white/30 text-sm">
                  No competency data yet — start studying!
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="barGradBlue" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                      unit="%"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={108}
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={barTooltipFormatter}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar
                      dataKey="mastery"
                      fill="url(#barGradBlue)"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* Radar chart */}
            <motion.div
              className="gcard p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
            >
              <div className="flex items-center gap-2 mb-5">
                <Brain className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white">Competency Radar</h2>
                <span className="text-xs text-white/35 ml-auto">top 8 skills</span>
              </div>
              <MasteryRadar data={(progress?.competency_mastery ?? []).slice(0, 8).map(m => ({ subject: m.competency_name, mastery: Math.round(m.mastery_score * 100) }))} />
            </motion.div>
          </div>

          {/* ── Recent sessions ── */}
          {progress && progress.recent_interactions.length > 0 && (
            <motion.div
              className="gcard p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Recent Sessions</h2>
                <span className="text-xs text-white/35 ml-auto">
                  {progress.recent_interactions.length} sessions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/30 border-b border-white/5">
                      <th className="pb-3 pr-4 font-medium">Material</th>
                      <th className="pb-3 pr-4 font-medium">Subject</th>
                      <th className="pb-3 pr-4 font-medium text-center">Score</th>
                      <th className="pb-3 pr-4 font-medium text-right">Time</th>
                      <th className="pb-3 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.recent_interactions.map((item, idx) => (
                      <motion.tr
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 + idx * 0.05 }}
                        className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors"
                      >
                        <td className="py-3 pr-4 font-medium text-white/85 max-w-[200px]">
                          <span className="block truncate">{item.material_title}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20 font-medium">
                            {item.subject}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <ScoreBadge score={item.quiz_score} />
                        </td>
                        <td className="py-3 pr-4 text-right text-white/40 text-xs">
                          {item.time_spent_seconds
                            ? `${Math.round(item.time_spent_seconds / 60)}m`
                            : "—"}
                        </td>
                        <td className="py-3 text-right text-white/30 text-xs whitespace-nowrap">
                          {new Date(item.timestamp).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
