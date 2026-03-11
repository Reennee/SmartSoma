"use client";

// === FILE: app/teacher/dashboard/page.tsx ===

import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  BookOpen,
  Activity,
  TrendingUp,
  Search,
  ChevronRight,
  X,
  Plus,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import AddMaterialModal from "@/components/AddMaterialModal";
import {
  analyticsApi,
  studentApi,
  type ClassAnalyticsOut,
  type StudentProgressOut,
  type StudentSummary,
} from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";

// ─── Animated Counter ──────────────────────────────────────────────────────────

function AnimatedCounter({
  target,
  suffix = "",
}: {
  target: number;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setCount(Math.round(eased * target));
      if (elapsed < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return (
    <span>
      {count}
      {suffix}
    </span>
  );
}

// ─── Mastery Bar ───────────────────────────────────────────────────────────────

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
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-semibold text-white/70 w-9 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ─── Skeleton Loading ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-96 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}

// ─── Student Drill-Down Panel ──────────────────────────────────────────────────

function StudentPanel({
  studentId,
  onClose,
}: {
  studentId: number;
  onClose: () => void;
}) {
  const [state, setState] = useState<{
    studentId: number;
    data: StudentProgressOut | null;
  }>(() => ({ studentId, data: null }));

  useEffect(() => {
    let cancelled = false;
    studentApi
      .studentProgress(studentId)
      .then((d) => {
        if (cancelled) return;
        setState({ studentId, data: d });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ studentId, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const loading = state.studentId !== studentId || state.data === null;
  const data = state.studentId === studentId ? state.data : null;

  const topCompetencies = data
    ? [...data.competency_mastery]
        .sort((a, b) => b.mastery_score - a.mastery_score)
        .slice(0, 5)
    : [];

  const recentInteractions = data?.recent_interactions.slice(0, 5) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.32 }}
      className="gcard p-6 mt-3"
    >
      {/* Panel header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          {loading ? (
            <div className="skeleton h-5 w-44 rounded mb-2" />
          ) : (
            <h3 className="text-lg font-bold text-white">{data?.full_name}</h3>
          )}
          {!loading && data && (
            <p className="text-xs text-white/45 mt-0.5">
              Grade {data.grade_level ?? "—"} &middot; Overall{" "}
              {Math.round((data.overall_mastery ?? 0) * 100)}% mastery &middot;{" "}
              {data.total_interactions} sessions
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close student panel"
          aria-label="Close student panel"
          className="p-2 rounded-xl text-white/35 hover:text-white hover:bg-white/8 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Top Competencies */}
          <div>
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">
              Top Competencies
            </p>
            <div className="space-y-2.5">
              {topCompetencies.map((c, i) => (
                <motion.div
                  key={c.competency_name}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="glass-sm p-3"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-white/75 font-semibold truncate pr-2">
                      {c.competency_name}
                    </span>
                    <span className="text-xs font-bold text-blue-400 shrink-0">
                      {Math.round(c.mastery_score * 100)}%
                    </span>
                  </div>
                  <MasteryBar value={c.mastery_score} />
                </motion.div>
              ))}
              {topCompetencies.length === 0 && (
                <p className="text-xs text-white/30">No competency data yet.</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">
              Recent Activity
            </p>
            <div className="space-y-2">
              {recentInteractions.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="glass-sm p-3"
                >
                  <p className="text-xs font-semibold text-white/85 truncate">
                    {r.material_title}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-white/40">{r.subject}</span>
                    {r.quiz_score !== null && (
                      <span className="text-[10px] text-blue-400 font-semibold">
                        Score {Math.round(r.quiz_score * 100)}%
                      </span>
                    )}
                    {r.time_spent_seconds !== null && (
                      <span className="text-[10px] text-white/35">
                        {Math.round(r.time_spent_seconds / 60)}m
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
              {recentInteractions.length === 0 && (
                <p className="text-xs text-white/30">No interactions yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  gradient: string;
  delay: number;
}

function StatCard({
  label,
  value,
  suffix,
  icon,
  gradient,
  delay,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="gcard p-5"
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center bg-linear-to-br ${gradient} shrink-0`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-extrabold text-white tracking-tight">
          <AnimatedCounter target={value} suffix={suffix} />
        </p>
        <p className="text-[10px] text-white/40 font-semibold mt-1.5 uppercase tracking-widest">
          {label}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<ClassAnalyticsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addMaterialOpen, setAddMaterialOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user?.role !== "teacher") {
      router.replace("/student/dashboard");
      return;
    }
    analyticsApi
      .classOverview()
      .then(setData)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const user = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    getUser,
    () => null,
  );

  const avgMastery =
    data && data.students.length > 0
      ? data.students.reduce((s, st) => s + st.overall_mastery, 0) /
        data.students.length
      : 0;

  const filteredStudents: StudentSummary[] = data
    ? data.students.filter((s) =>
        s.full_name.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const weakestCompetencies = data
    ? [...data.competency_heatmap]
        .sort((a, b) => a.avg_mastery - b.avg_mastery)
        .slice(0, 8)
    : [];

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
  };

  const rowVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.28 } },
  };

  return (
    <div className="app-bg min-h-screen">
      {/* Background blobs */}
      <div className="blob blob-blue w-96 h-96 top-[-80px] left-[-60px] opacity-60" />
      <div className="blob blob-purple w-80 h-80 top-40 right-[-40px] opacity-50" />
      <div className="blob blob-cyan w-64 h-64 bottom-40 left-1/3 opacity-40" />

      {/* Dot grid */}
      <div className="dot-grid fixed inset-0 pointer-events-none" />

      <div className="page-wrap">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          {/* ── Page Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          >
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight grad-text">
                Class Dashboard
              </h1>
              <p className="text-white/40 text-sm mt-1.5 font-medium">
                Monitor student performance and learning outcomes in real time.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setAddMaterialOpen(true)}
                className="btn-grad flex items-center gap-2 text-sm font-semibold px-4 py-2.5"
              >
                <Plus className="w-4 h-4" />
                Add Material
              </button>
              {user && (
                <div className="glass-sm px-4 py-2.5 flex items-center gap-2.5 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-white/65 font-medium">
                    {user.full_name}
                  </span>
                </div>
              )}
            </div>

            <AddMaterialModal
              open={addMaterialOpen}
              onClose={() => setAddMaterialOpen(false)}
              onSuccess={() => {
                // Refresh the materials count by reloading analytics
                analyticsApi.classOverview().then(setData).catch(() => {});
              }}
            />
          </motion.div>

          {/* ── Content ── */}
          {loading ? (
            <DashboardSkeleton />
          ) : data ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Students"
                  value={data.total_students}
                  icon={<Users className="w-5 h-5 text-white" />}
                  gradient="from-blue-600 to-blue-400"
                  delay={0}
                />
                <StatCard
                  label="Total Materials"
                  value={data.total_materials}
                  icon={<BookOpen className="w-5 h-5 text-white" />}
                  gradient="from-purple-600 to-violet-400"
                  delay={0.08}
                />
                <StatCard
                  label="Total Interactions"
                  value={data.total_interactions}
                  icon={<Activity className="w-5 h-5 text-white" />}
                  gradient="from-cyan-600 to-sky-400"
                  delay={0.16}
                />
                <StatCard
                  label="Avg Mastery"
                  value={Math.round(avgMastery * 100)}
                  suffix="%"
                  icon={<TrendingUp className="w-5 h-5 text-white" />}
                  gradient="from-emerald-600 to-green-400"
                  delay={0.24}
                />
              </div>

              {/* ── Student Table ── */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="gcard p-6"
              >
                {/* Table toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Students</h2>
                    <p className="text-white/38 text-xs mt-0.5">
                      {data.students.length} enrolled &mdash; click a row to inspect
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/28" />
                    <input
                      className="input-premium pl-9 py-2.5 text-sm"
                      placeholder="Search students…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_76px_76px_1fr_24px] gap-3 px-3 mb-2">
                  {["Name", "Grade", "Sessions", "Mastery", ""].map((h) => (
                    <span
                      key={h}
                      className="text-[10px] font-semibold text-white/30 uppercase tracking-widest"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  {filteredStudents.length === 0 ? (
                    <p className="text-center text-white/28 text-sm py-12">
                      No students match your search.
                    </p>
                  ) : (
                    filteredStudents.map((student) => (
                      <motion.div key={student.user_id} variants={rowVariants}>
                        <motion.button
                          type="button"
                          whileHover={{
                            backgroundColor: "rgba(255,255,255,0.05)",
                            x: 2,
                          }}
                          onClick={() =>
                            setSelectedId(
                              selectedId === student.user_id
                                ? null
                                : student.user_id
                            )
                          }
                          className={`w-full grid grid-cols-[1fr_76px_76px_1fr_24px] gap-3 items-center px-3 py-3 rounded-xl transition-colors text-left ${
                            selectedId === student.user_id
                              ? "bg-blue-500/10 border border-blue-500/25"
                              : "border border-transparent"
                          }`}
                        >
                          <span className="text-sm font-semibold text-white truncate">
                            {student.full_name}
                          </span>
                          <span className="text-xs text-white/48 font-medium">
                            {student.grade_level ?? "—"}
                          </span>
                          <span className="text-xs text-white/48 font-medium">
                            {student.total_interactions}
                          </span>
                          <MasteryBar value={student.overall_mastery} />
                          <ChevronRight
                            className={`w-4 h-4 text-white/28 transition-transform duration-200 ${
                              selectedId === student.user_id
                                ? "rotate-90 text-blue-400"
                                : ""
                            }`}
                          />
                        </motion.button>

                        <AnimatePresence>
                          {selectedId === student.user_id && (
                            <StudentPanel
                              studentId={student.user_id}
                              onClose={() => setSelectedId(null)}
                            />
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              </motion.div>

              {/* ── Competency Heatmap Preview ── */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.44 }}
                className="gcard p-6"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-white">
                    Weakest Competencies
                  </h2>
                  <p className="text-white/38 text-xs mt-0.5">
                    Top 8 areas needing the most attention across all students
                  </p>
                </div>

                <div className="space-y-2.5">
                  {weakestCompetencies.map((c, i) => {
                    const pct = Math.round(c.avg_mastery * 100);
                    const barColor =
                      pct >= 75
                        ? "from-emerald-500 to-green-400"
                        : pct >= 50
                        ? "from-blue-500 to-cyan-400"
                        : pct >= 25
                        ? "from-amber-500 to-yellow-400"
                        : "from-red-500 to-rose-400";
                    const labelColor =
                      pct < 25
                        ? "text-red-400"
                        : pct < 50
                        ? "text-amber-400"
                        : pct < 75
                        ? "text-blue-400"
                        : "text-emerald-400";

                    return (
                      <motion.div
                        key={`${c.competency_name}-${c.grade_level}-${i}`}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i + 0.46 }}
                        className="glass-sm p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-white/22 w-5 shrink-0 tabular-nums">
                              {i + 1}
                            </span>
                            <span className="text-sm font-semibold text-white truncate">
                              {c.competency_name}
                            </span>
                            <span className="glass-sm px-2 py-0.5 text-[10px] font-semibold text-blue-300 shrink-0">
                              {c.grade_level}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-[10px] text-white/32">
                              {c.student_count} students
                            </span>
                            <span
                              className={`text-xs font-bold ${labelColor}`}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden ml-8">
                          <motion.div
                            className={`h-full rounded-full bg-linear-to-r ${barColor}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              duration: 0.9,
                              delay: 0.05 * i + 0.52,
                            }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                  {weakestCompetencies.length === 0 && (
                    <p className="text-center text-white/28 text-sm py-8">
                      No competency data available yet.
                    </p>
                  )}
                </div>
              </motion.div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
