"use client";

// === FILE: app/teacher/analytics/page.tsx ===

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { X, Loader2, AlertTriangle, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import { analyticsApi, studentApi, type ClassAnalyticsOut, type StudentProgressOut } from "@/lib/api";
import { getToken } from "@/lib/auth";

// ─── Constants ─────────────────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#0d1b35",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "white",
  fontSize: 12,
};

const MASTERY_BUCKET_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80"];

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
      <div className="skeleton h-96 rounded-2xl" />
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  );
}

// ─── Mastery Bar (inline, no animation needed for table) ──────────────────────

function MasteryBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75
      ? "from-emerald-500 to-green-400"
      : pct >= 50
      ? "from-blue-500 to-cyan-400"
      : pct >= 25
      ? "from-amber-500 to-yellow-400"
      : "from-red-500 to-rose-400";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-linear-to-r ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-semibold text-white/65 w-9 text-right tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

// ─── Grade Filter Pill ─────────────────────────────────────────────────────────

function GradePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
        active
          ? "bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/40"
          : "bg-white/8 text-white/55 hover:bg-white/14 hover:text-white/80"
      }`}
    >
      {label}
    </motion.button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<ClassAnalyticsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  // Student detail panel
  const [detailStudent, setDetailStudent] = useState<{ id: number; name: string } | null>(null);
  const [detailData, setDetailData] = useState<StudentProgressOut | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [warnMsg, setWarnMsg] = useState("");
  const [warning, setWarning] = useState<"idle" | "sending" | "sent">("idle");

  function openDetail(userId: number, name: string) {
    setDetailStudent({ id: userId, name });
    setDetailData(null);
    setDetailError(null);
    setWarnMsg("");
    setWarning("idle");
    setDetailLoading(true);
    studentApi
      .studentProgress(userId)
      .then((p) => setDetailData(p))
      .catch((e: unknown) => setDetailError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setDetailLoading(false));
  }

  function closeDetail() {
    setDetailStudent(null);
    setDetailData(null);
  }

  async function sendWarning() {
    if (!detailStudent) return;
    setWarning("sending");
    try {
      await analyticsApi.warnStudent(detailStudent.id, warnMsg || undefined);
      setWarning("sent");
    } catch {
      setWarning("idle");
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    analyticsApi
      .classOverview()
      .then(setData)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const gradeDistData = (() => {
    if (!data) return [];
    const groups: Record<string, number> = {};
    data.students.forEach((s) => {
      const g = s.grade_level ?? "Unknown";
      groups[g] = (groups[g] ?? 0) + 1;
    });
    return Object.entries(groups)
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => a.grade.localeCompare(b.grade));
  })();

  const masteryDistData = (() => {
    if (!data) return [];
    const buckets: Record<string, number> = {
      "0–25%": 0,
      "26–50%": 0,
      "51–75%": 0,
      "76–100%": 0,
    };
    data.students.forEach((s) => {
      const pct = s.overall_mastery * 100;
      if (pct <= 25) buckets["0–25%"]++;
      else if (pct <= 50) buckets["26–50%"]++;
      else if (pct <= 75) buckets["51–75%"]++;
      else buckets["76–100%"]++;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  })();

  const heatmapRows = data
    ? [...data.competency_heatmap].sort((a, b) => a.avg_mastery - b.avg_mastery)
    : [];

  const grades = data
    ? Array.from(
        new Set(data.students.map((s) => s.grade_level ?? "Unknown"))
      ).sort()
    : [];

  const filteredStudents = data
    ? (gradeFilter === "all"
        ? [...data.students]
        : data.students.filter((s) => (s.grade_level ?? "Unknown") === gradeFilter)
      ).sort((a, b) => b.overall_mastery - a.overall_mastery)
    : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-bg min-h-screen">
      {/* Background blobs */}
      <div className="blob blob-purple w-96 h-96 top-[-60px] right-[-80px] opacity-55" />
      <div className="blob blob-blue w-72 h-72 top-60 left-[-50px] opacity-45" />
      <div className="blob blob-cyan w-64 h-64 bottom-32 right-1/4 opacity-38" />

      {/* Dot grid */}
      <div className="dot-grid fixed inset-0 pointer-events-none" />

      <div className="page-wrap">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <h1 className="text-4xl font-extrabold tracking-tight grad-text">
              Analytics
            </h1>
            <p className="text-white/40 text-sm mt-1.5 font-medium">
              Deep dive into class performance across competencies and grade levels.
            </p>
          </motion.div>

          {/* ── Content ── */}
          {loading ? (
            <AnalyticsSkeleton />
          ) : data ? (
            <>
              {/* ── Chart Row ── */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Students by Grade */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="gcard p-6"
                >
                  <div className="mb-5">
                    <h2 className="text-lg font-bold text-white">
                      Students by Grade Level
                    </h2>
                    <p className="text-white/38 text-xs mt-0.5">
                      Enrollment count per grade
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={gradeDistData}
                      margin={{ left: -10, right: 10, top: 4, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="grade"
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        formatter={(v: number | string | undefined) => [v ?? 0, "Students"]}
                      />
                      <Bar
                        dataKey="count"
                        fill="url(#blueGrad)"
                        radius={[6, 6, 0, 0]}
                      >
                        <defs>
                          <linearGradient
                            id="blueGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Mastery Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.18 }}
                  className="gcard p-6"
                >
                  <div className="mb-5">
                    <h2 className="text-lg font-bold text-white">
                      Mastery Distribution
                    </h2>
                    <p className="text-white/38 text-xs mt-0.5">
                      Students grouped by overall mastery range
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={masteryDistData}
                      margin={{ left: -10, right: 10, top: 4, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="range"
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        formatter={(v: number | string | undefined) => [v ?? 0, "Students"]}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {masteryDistData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={MASTERY_BUCKET_COLORS[i]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>

              {/* ── Competency Heatmap ── */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.28 }}
                className="gcard p-6"
              >
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white">
                    Competency Heatmap
                  </h2>
                  <p className="text-white/38 text-xs mt-0.5">
                    Sorted weakest to strongest — class average mastery per competency
                  </p>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {heatmapRows.map((row, idx) => {
                    const pct = Math.round(row.avg_mastery * 100);
                    const barColor =
                      pct >= 75
                        ? "from-emerald-500 to-green-400"
                        : pct >= 50
                        ? "from-blue-500 to-cyan-400"
                        : pct >= 25
                        ? "from-amber-500 to-yellow-400"
                        : "from-red-500 to-rose-400";
                    const badgeColor =
                      pct < 25
                        ? "bg-red-500/18 text-red-400 border-red-500/28"
                        : pct < 50
                        ? "bg-amber-500/18 text-amber-400 border-amber-500/28"
                        : pct < 75
                        ? "bg-blue-500/18 text-blue-400 border-blue-500/28"
                        : "bg-emerald-500/18 text-emerald-400 border-emerald-500/28";

                    return (
                      <motion.div
                        key={`${row.competency_name}-${row.grade_level}-${idx}`}
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(idx * 0.03, 0.6) }}
                        className="glass-sm p-3"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-sm font-semibold text-white truncate">
                              {row.competency_name}
                            </span>
                            <span className="glass-sm px-2 py-0.5 text-[10px] font-semibold text-blue-300 shrink-0">
                              {row.grade_level}
                            </span>
                            <span className="text-[10px] text-white/35 shrink-0">
                              {row.student_count} students
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor} shrink-0`}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full bg-linear-to-r ${barColor}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              duration: 0.8,
                              delay: Math.min(idx * 0.03 + 0.3, 0.9),
                            }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                  {heatmapRows.length === 0 && (
                    <p className="text-center text-white/28 text-sm py-10">
                      No competency data available yet.
                    </p>
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-5 mt-5 pt-4 border-t border-white/8 text-xs text-white/40">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                    Below 25%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                    25–50%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                    50–75%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                    Above 75%
                  </span>
                </div>
              </motion.div>

              {/* ── Student Table ── */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.38 }}
                className="gcard p-6"
              >
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Student Details
                    </h2>
                    <p className="text-white/38 text-xs mt-0.5">
                      Sorted by mastery — high to low
                    </p>
                  </div>
                  {/* Grade filter pills */}
                  <div className="flex flex-wrap gap-2">
                    <GradePill
                      label="All"
                      active={gradeFilter === "all"}
                      onClick={() => setGradeFilter("all")}
                    />
                    {grades.map((g) => (
                      <GradePill
                        key={g}
                        label={g}
                        active={gradeFilter === g}
                        onClick={() => setGradeFilter(g)}
                      />
                    ))}
                  </div>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_76px_80px_1fr] gap-3 px-3 mb-2">
                  {["Name", "Grade", "Sessions", "Mastery"].map((h) => (
                    <span
                      key={h}
                      className="text-[10px] font-semibold text-white/30 uppercase tracking-widest"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {filteredStudents.length === 0 ? (
                  <p className="text-center text-white/28 text-sm py-12">
                    No students found for this grade.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredStudents.map((s, i) => (
                      <motion.button
                        key={s.user_id}
                        type="button"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => openDetail(s.user_id, s.full_name)}
                        className="w-full grid grid-cols-[1fr_76px_80px_1fr] gap-3 items-center px-3 py-3 rounded-xl hover:bg-white/7 hover:border-white/10 active:bg-white/10 transition-colors border border-transparent text-left cursor-pointer"
                      >
                        <span className="text-sm font-semibold text-white truncate">
                          {s.full_name}
                        </span>
                        <span className="text-xs text-white/48 font-medium">
                          {s.grade_level ?? "—"}
                        </span>
                        <span className="text-xs text-white/48 font-medium tabular-nums">
                          {s.total_interactions}
                        </span>
                        <MasteryBar value={s.overall_mastery} />
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            </>
          ) : null}
        </main>
      </div>

      {/* ── Student Detail Panel ── */}
      <AnimatePresence>
        {detailStudent && (
          <>
            {/* Backdrop */}
            <motion.div
              key="detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={closeDetail}
            />

            {/* Side panel */}
            <motion.div
              key="detail-panel"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col detail-panel"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white">{detailStudent.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">Student progress overview</p>
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="w-8 h-8 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {detailLoading && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  </div>
                )}

                {detailError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm py-6">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {detailError}
                  </div>
                )}

                {detailData && (
                  <>
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Overall Mastery", value: `${Math.round(detailData.overall_mastery * 100)}%` },
                        { label: "Sessions", value: detailData.total_interactions },
                        { label: "Grade", value: detailData.grade_level ?? "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="glass-sm p-3 text-center">
                          <p className="text-lg font-bold text-white">{value}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Competency mastery */}
                    {detailData.competency_mastery.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">
                          Competency Mastery
                        </h4>
                        <div className="space-y-2">
                          {[...detailData.competency_mastery]
                            .sort((a, b) => a.mastery_score - b.mastery_score)
                            .map((c) => (
                              <div key={c.competency_name} className="glass-sm p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-medium text-white/80 truncate max-w-[75%]">
                                    {c.competency_name}
                                  </span>
                                  <span className="text-xs font-bold text-white/60 tabular-nums">
                                    {Math.round(c.mastery_score * 100)}%
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-linear-to-r from-blue-500 to-purple-500"
                                    style={{ width: `${Math.round(c.mastery_score * 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Recent interactions */}
                    {detailData.recent_interactions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">
                          Recent Activity
                        </h4>
                        <div className="space-y-2">
                          {detailData.recent_interactions.slice(0, 5).map((r, i) => (
                            <div key={i} className="glass-sm p-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white/80 truncate">{r.material_title}</p>
                                <p className="text-[10px] text-white/35 mt-0.5">{r.subject}</p>
                              </div>
                              <div className="text-right shrink-0">
                                {r.quiz_score != null && (
                                  <p className="text-xs font-bold text-blue-400">{r.quiz_score}%</p>
                                )}
                                <p className="text-[10px] text-white/30 mt-0.5">
                                  {new Date(r.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer — send warning */}
              <div className="px-6 py-4 border-t border-white/8 shrink-0 space-y-3">
                <p className="text-xs text-white/40 font-medium">Send a warning to this student</p>
                <textarea
                  value={warnMsg}
                  onChange={(e) => setWarnMsg(e.target.value)}
                  placeholder="Optional custom message…"
                  rows={2}
                  className="input-premium resize-none text-sm"
                  disabled={warning === "sent"}
                />
                <button
                  type="button"
                  onClick={sendWarning}
                  disabled={warning !== "idle"}
                  className="btn-grad w-full flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-60"
                >
                  {warning === "sending" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : warning === "sent" ? (
                    "Warning sent ✓"
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Warning
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
