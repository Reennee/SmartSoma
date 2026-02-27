"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Clock, Zap, Filter, Upload, ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { materialsApi, type MaterialOut } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";
import TestUploadModal from "@/components/TestUploadModal";

// ─── Color maps ───────────────────────────────────────────────────────────────

const subjectColors: Record<string, string> = {
  Mathematics: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  Physics:     "bg-purple-500/15 text-purple-300 border-purple-500/25",
  Chemistry:   "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  Biology:     "bg-green-500/15 text-green-300 border-green-500/25",
  English:     "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
};

const difficultyColors: Record<string, string> = {
  Beginner:     "bg-green-500/15 text-green-300 border-green-500/25",
  Intermediate: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  Advanced:     "bg-red-500/15 text-red-300 border-red-500/25",
};

const contentTypeIcons: Record<string, string> = {
  PDF: "📄",
  Video: "🎬",
  "Interactive Exercise": "🧩",
};

const DIFFICULTIES = ["All", "Beginner", "Intermediate", "Advanced"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const PAGE_SIZE = 12;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MaterialsSkeleton() {
  return (
    <div className="app-bg">
      <div className="blob blob-blue  w-[500px] h-[500px] top-[-100px] left-[-120px] opacity-35" />
      <div className="blob blob-purple w-[380px] h-[380px] top-[250px] right-[-80px] opacity-28" />
      <div className="dot-grid absolute inset-0 pointer-events-none" />
      <div className="page-wrap">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          <div className="skeleton h-10 w-64 rounded-xl" />
          <div className="skeleton h-5 w-48 rounded-lg" />
          <div className="skeleton h-16 rounded-2xl" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-52 rounded-2xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Material card ────────────────────────────────────────────────────────────

interface MaterialCardProps {
  material: MaterialOut;
  index: number;
  interacting: boolean;
  done: boolean;
  onStudy: (m: MaterialOut) => void;
}

function MaterialCard({ material: m, index, interacting, done, onStudy }: MaterialCardProps) {
  const subjectCls = subjectColors[m.subject] ?? "bg-white/10 text-white/60 border-white/15";
  const diffCls = difficultyColors[m.difficulty_level] ?? "bg-white/10 text-white/60 border-white/15";
  const typeEmoji = contentTypeIcons[m.content_type ?? ""] ?? "📚";

  return (
    <motion.div
      className="gcard p-5 flex flex-col gap-4 h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {/* Top row: type emoji + difficulty badge */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none">{typeEmoji}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${diffCls}`}>
          {m.difficulty_level}
        </span>
      </div>

      {/* Title */}
      <div className="flex-1 space-y-1.5">
        <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{m.title}</h3>
        <p className="text-xs text-white/40 truncate">{m.competency_name}</p>
      </div>

      {/* Subject + duration row */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${subjectCls}`}>
          {m.subject}
        </span>
        {m.duration_minutes != null && (
          <span className="flex items-center gap-1 text-xs text-white/35">
            <Clock className="w-3 h-3" />
            {m.duration_minutes}m
          </span>
        )}
      </div>

      {/* Study button */}
      <button
        type="button"
        onClick={() => onStudy(m)}
        disabled={interacting || done}
        className={`btn-grad w-full py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none ${
          done ? "bg-linear-to-br from-green-500 to-emerald-600 shadow-green-500/30" : ""
        }`}
      >
        {interacting ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Logging…
          </>
        ) : done ? (
          <><Zap className="w-3.5 h-3.5" />Studied!</>
        ) : (
          <><BookOpen className="w-3.5 h-3.5" />Study this</>
        )}
      </button>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MaterialsPage() {
  const router = useRouter();
  const user = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    getUser,
    () => null,
  );

  const [materials, setMaterials] = useState<MaterialOut[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const [interacting, setInteracting] = useState<number | null>(null);
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [flashId, setFlashId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [difficulty, setDifficulty] = useState<Difficulty>("All");

  const [showUpload, setShowUpload] = useState(false);

  // Derived unique subjects from loaded materials
  const subjects = Array.from(new Set(materials.map((m) => m.subject))).sort();

  // Client-side filter of what we've loaded
  const filtered = materials.filter((m) => {
    if (subject !== "all" && m.subject !== subject) return false;
    if (difficulty !== "All" && m.difficulty_level !== difficulty) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!m.title.toLowerCase().includes(q) && !(m.competency_name?.toLowerCase().includes(q) ?? false)) return false;
    }
    return true;
  });

  function buildParams(newSkip: number) {
    return {
      grade_level: user?.role === "student" ? (user as { grade_level?: string }).grade_level ?? undefined : undefined,
      skip: newSkip,
      limit: PAGE_SIZE,
    };
  }

  // Initial load
  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    materialsApi
      .list(buildParams(0))
      .then((data) => {
        setMaterials(data.items);
        setTotal(data.total);
        setSkip(0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadMore() {
    const nextSkip = skip + PAGE_SIZE;
    setLoadingMore(true);
    try {
      const data = await materialsApi.list(buildParams(nextSkip));
      setMaterials((prev) => [...prev, ...data.items]);
      setSkip(nextSkip);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }

  async function handleStudy(m: MaterialOut) {
    setInteracting(m.material_id);
    try {
      await materialsApi.interact(m.material_id, { time_spent_seconds: 300, quiz_score: 70 });
      setDoneIds((prev) => new Set(prev).add(m.material_id));
      setFlashId(m.material_id);
      setTimeout(() => setFlashId(null), 2000);
    } catch { /* silent */ }
    finally { setInteracting(null); }
  }

  const hasMore = materials.length < total;

  if (loading) return <MaterialsSkeleton />;

  return (
    <div className="app-bg">
      <div className="blob blob-blue  w-[520px] h-[520px] top-[-110px] left-[-130px] opacity-35" />
      <div className="blob blob-purple w-[400px] h-[400px] top-[300px] right-[-90px] opacity-28" />
      <div className="blob blob-cyan   w-[280px] h-[280px] bottom-[100px] left-[40%] opacity-20" />
      <div className="dot-grid absolute inset-0 pointer-events-none" />

      <div className="page-wrap">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-start justify-between gap-4 flex-wrap"
          >
            <div>
              <p className="text-sm text-white/40 font-medium tracking-wide uppercase mb-1">
                CBC-aligned resources
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                Browse&nbsp;<span className="grad-text">Materials</span>
              </h1>
              <p className="mt-2 text-white/40 text-sm">
                Showing {filtered.length} of {total} resource{total !== 1 ? "s" : ""}
                {subject !== "all" ? ` in ${subject}` : ""}
              </p>
            </div>

            {/* Upload Test Results button */}
            <motion.button
              type="button"
              onClick={() => setShowUpload(true)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl btn-grad text-sm font-semibold shrink-0"
            >
              <Upload className="w-4 h-4" />
              Upload Test Results
            </motion.button>
          </motion.div>

          {/* ── Filter bar ── */}
          <motion.div
            className="glass p-4 rounded-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search materials or competencies…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-premium pl-10"
                />
              </div>

              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-full sm:w-[160px] glass-sm border-white/10 text-white text-sm rounded-xl h-[52px]">
                  <Filter className="w-3.5 h-3.5 text-white/40 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1b35] border-white/12 text-white">
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5 flex-wrap">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      difficulty === d
                        ? "btn-grad border-transparent"
                        : "glass-sm border-white/10 text-white/55 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Flash success toast ── */}
          <AnimatePresence>
            {flashId !== null && (
              <motion.div
                key="flash"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed top-20 left-1/2 -translate-x-1/2 z-50 glass-sm px-5 py-3 rounded-2xl flex items-center gap-2 border border-green-500/30 text-green-300 text-sm font-semibold shadow-2xl"
              >
                <Zap className="w-4 h-4" />
                Session logged — mastery updated!
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Materials grid ── */}
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-4 text-center"
              >
                <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40 text-base font-medium">No materials match your filters.</p>
                <p className="text-white/25 text-sm">Try adjusting your search or clearing the filters.</p>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {filtered.map((m, i) => (
                  <MaterialCard
                    key={m.material_id}
                    material={m}
                    index={i}
                    interacting={interacting === m.material_id}
                    done={doneIds.has(m.material_id)}
                    onStudy={handleStudy}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Load More ── */}
          {hasMore && (
            <motion.div
              className="flex flex-col items-center gap-2 pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-xs text-white/30">
                Loaded {materials.length} of {total} materials
              </p>
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-3 rounded-xl glass-sm border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Loading…
                  </>
                ) : (
                  <><ChevronDown className="w-4 h-4" />Load more</>
                )}
              </button>
            </motion.div>
          )}
        </main>
      </div>

      {/* ── Test Upload Modal ── */}
      <TestUploadModal open={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  );
}
