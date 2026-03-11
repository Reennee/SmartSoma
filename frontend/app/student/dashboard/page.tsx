"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, BookOpen, Brain, Clock, Sparkles, ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import RecommendationCard from "@/components/RecommendationCard";
import MasteryRadar from "@/components/MasteryRadar";
import SubjectGradeModal from "@/components/SubjectGradeModal";
import {
  recommendApi,
  studentApi,
  type RecommendedMaterial,
  type StudentProgressOut,
  type SubjectGradeOut,
} from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";

// ─── Animated counter hook ────────────────────────────────────────────────────

function useCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const start = performance.now();
    const from = valueRef.current;
    if (from === target) return;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
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

// ─── Greeting helper ─────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Stat card with animated counter ────────────────────────────────────────

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

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="app-bg">
      <div className="blob blob-blue w-[500px] h-[500px] top-[-100px] left-[-100px] opacity-40" />
      <div className="blob blob-purple w-[400px] h-[400px] top-[200px] right-[-80px] opacity-30" />
      <div className="dot-grid absolute inset-0 pointer-events-none" />
      <div className="page-wrap">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          <div className="skeleton h-10 w-72 rounded-xl" />
          <div className="skeleton h-5 w-48 rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-52 rounded-2xl" />
              ))}
            </div>
            <div className="space-y-4">
              <div className="skeleton h-72 rounded-2xl" />
              <div className="skeleton h-40 rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-white/30 font-medium">—</span>;
  }
  const color =
    score >= 75
      ? "bg-green-500/15 text-green-300 border-green-500/25"
      : score >= 50
      ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25"
      : "bg-red-500/15 text-red-300 border-red-500/25";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {score}%
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<RecommendedMaterial[]>([]);
  const [progress, setProgress] = useState<StudentProgressOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [subjectGrades, setSubjectGrades] = useState<SubjectGradeOut[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  const user = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    getUser,
    () => null,
  );

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    if (user?.role === "teacher") { router.push("/teacher/dashboard"); return; }
  }, [router, user]);

  const loadGrades = useCallback(async () => {
    try {
      const grades = await studentApi.getSubjectGrades();
      setSubjectGrades(grades);
    } catch { /* no grades yet */ }
  }, []);

  const load = useCallback(async (subject?: string) => {
    try {
      const [recs, prog] = await Promise.all([
        recommendApi.get(6, subject || undefined),
        studentApi.myProgress(),
      ]);
      setRecommendations(recs);
      setProgress(prog);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadGrades(); }, [load, loadGrades]);

  const overallPct = progress ? Math.round(progress.overall_mastery * 100) : 0;
  const firstName = user?.full_name?.split(" ")[0] ?? "Student";

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="app-bg">
      {/* Background blobs */}
      <div className="blob blob-blue  w-[560px] h-[560px] top-[-120px] left-[-140px] opacity-35" />
      <div className="blob blob-purple w-[440px] h-[440px] top-[280px] right-[-100px] opacity-28" />
      <div className="blob blob-cyan   w-[320px] h-[320px] bottom-[60px] left-[30%] opacity-22" />
      <div className="dot-grid absolute inset-0 pointer-events-none" />

      <SubjectGradeModal
        open={gradeModalOpen}
        onClose={() => setGradeModalOpen(false)}
        onSuccess={() => { loadGrades(); load(selectedSubject || undefined); }}
      />

      <div className="page-wrap">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-end justify-between gap-4 flex-wrap"
          >
            <div>
              <p className="text-sm text-white/40 font-medium mb-1 tracking-wide uppercase">
                {getGreeting()}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                {firstName},&nbsp;
                <span className="grad-text">ready to learn?</span>
              </h1>
              {progress?.grade_level && (
                <p className="mt-2 text-white/45 text-sm">
                  Grade {progress.grade_level} &mdash; keep building your mastery
                </p>
              )}
            </div>

            {/* ── Actions: subject filter + grade upload ── */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Subject filter dropdown */}
              {subjectGrades.length > 0 && (
                <div className="relative">
                  <select
                    title="Filter by subject"
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      load(e.target.value || undefined);
                    }}
                    className="input-premium text-sm pr-8 appearance-none"
                  >
                    <option value="">All subjects</option>
                    {subjectGrades.map((g) => (
                      <option key={g.subject} value={g.subject}>{g.subject}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                </div>
              )}

              {/* Upload grades button */}
              <button
                type="button"
                onClick={() => setGradeModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium glass-sm border border-white/10 hover:border-purple-500/40 hover:text-purple-300 text-white/60 transition-all"
              >
                <BookOpen className="w-4 h-4" />
                {subjectGrades.length > 0 ? "Update Grades" : "Upload Report Card"}
              </button>
            </div>
          </motion.div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              label="Competencies"
              rawValue={progress?.competency_mastery.length ?? 0}
              iconBg="bg-linear-to-br from-cyan-500/30 to-cyan-600/20"
              icon={<Brain className="w-5 h-5 text-cyan-400" />}
            />
            <StatCard
              index={3}
              label="Materials Available"
              rawValue={recommendations.length}
              iconBg="bg-linear-to-br from-green-500/30 to-green-600/20"
              icon={<Sparkles className="w-5 h-5 text-green-400" />}
            />
          </div>

          {/* ── Main content: recommendations + sidebar ── */}
          <div className="grid lg:grid-cols-3 gap-8">

            {/* ── Recommendations (2/3 width) ── */}
            <div className="lg:col-span-2 space-y-5">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-yellow-500/30 to-orange-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Recommended for You</h2>
                <span className="text-xs text-white/35 font-medium ml-1">by AI</span>
              </motion.div>

              <AnimatePresence>
                {recommendations.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="gcard p-10 text-center text-white/40 text-sm"
                  >
                    No recommendations yet — study a few materials to train the AI.
                  </motion.div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recommendations.slice(0, 6).map((r, i) => (
                      <motion.div
                        key={r.material_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + i * 0.07 }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      >
                        <RecommendationCard material={r} onStudied={load} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Sidebar: radar + recent activity ── */}
            <div className="space-y-6">

              {/* Mastery radar */}
              <motion.div
                className="gcard p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Mastery Radar</h3>
                  <span className="text-xs text-white/35 ml-auto">
                    {progress?.competency_mastery.length ?? 0} skills
                  </span>
                </div>
                <MasteryRadar data={(progress?.competency_mastery ?? []).slice(0, 8).map(m => ({ subject: m.competency_name, mastery: Math.round(m.mastery_score * 100) }))} />
              </motion.div>

              {/* Recent activity */}
              {progress && progress.recent_interactions.length > 0 && (
                <motion.div
                  className="gcard p-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                  </div>
                  <div className="space-y-3">
                    {progress.recent_interactions.slice(0, 5).map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55 + idx * 0.06 }}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/80 truncate leading-tight">
                            {item.material_title}
                          </p>
                          <p className="text-xs text-white/35 mt-0.5">{item.subject}</p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          <ScoreBadge score={item.quiz_score} />
                          {item.time_spent_seconds && (
                            <span className="text-xs text-white/30">
                              {Math.round(item.time_spent_seconds / 60)}m
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
