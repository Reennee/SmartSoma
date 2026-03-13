// === FILE: components/RecommendationCard.tsx ===
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Clock, Sparkles, Layers } from "lucide-react";
import { type RecommendedMaterial } from "@/lib/api";
import StudyModal from "./StudyModal";

// ── Subject palette ────────────────────────────────────────────────────────

const SUBJECT_STYLES: Record<string, { badge: string; dot: string }> = {
  Mathematics: {
    badge: "bg-blue-500/15 text-blue-300 border-blue-400/25",
    dot: "bg-blue-400",
  },
  Physics: {
    badge: "bg-purple-500/15 text-purple-300 border-purple-400/25",
    dot: "bg-purple-400",
  },
  Chemistry: {
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-400/25",
    dot: "bg-cyan-400",
  },
  Biology: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
    dot: "bg-emerald-400",
  },
  English: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-400/25",
    dot: "bg-amber-400",
  },
  History: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-400/25",
    dot: "bg-rose-400",
  },
};

const SUBJECT_FALLBACK = {
  badge: "bg-white/10 text-white/60 border-white/15",
  dot: "bg-white/40",
};

// ── Difficulty palette ─────────────────────────────────────────────────────

const DIFFICULTY_STYLES: Record<string, string> = {
  Beginner:
    "bg-emerald-500/12 text-emerald-300 border-emerald-400/25",
  Intermediate:
    "bg-amber-500/12 text-amber-300 border-amber-400/25",
  Advanced:
    "bg-red-500/12 text-red-300 border-red-400/25",
};

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  material: RecommendedMaterial;
  onStudied?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function RecommendationCard({ material, onStudied }: Props) {
  const [studyOpen, setStudyOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState(false);

  const masteryPct = Math.round(material.current_mastery * 100);
  const confidencePct = Math.round(material.confidence_score * 100);

  const subjectStyle =
    SUBJECT_STYLES[material.subject] ?? SUBJECT_FALLBACK;
  const difficultyStyle =
    DIFFICULTY_STYLES[material.difficulty_level] ??
    "bg-white/10 text-white/50 border-white/15";

  function handleCompleted() {
    setDone(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
    setStudyOpen(false);
    onStudied?.();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -4, transition: { duration: 0.25, ease: "easeOut" } }}
        className={[
          "gcard p-5 flex flex-col gap-4 transition-shadow duration-300",
          flash
            ? "shadow-[0_0_0_1.5px_rgba(52,211,153,0.5),0_0_32px_rgba(52,211,153,0.18)]"
            : "shadow-[0_4px_32px_rgba(0,0,0,0.35)]",
        ].join(" ")}
      >
        {/* ── Top badges ── */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border tracking-wide",
              subjectStyle.badge,
            ].join(" ")}
          >
            <span className={["w-1.5 h-1.5 rounded-full", subjectStyle.dot].join(" ")} />
            {material.subject}
          </span>
          <span
            className={[
              "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border tracking-wide",
              difficultyStyle,
            ].join(" ")}
          >
            {material.difficulty_level}
          </span>

          {/* AI confidence pill — top-right */}
          <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border bg-violet-500/12 text-violet-300 border-violet-400/25">
            <Sparkles className="w-3 h-3" />
            {confidencePct}% match
          </span>
        </div>

        {/* ── Title + competency ── */}
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-white leading-snug line-clamp-2">
            {material.title}
          </h3>
          <p className="text-xs text-white/40 flex items-center gap-1.5 truncate">
            <Layers className="w-3 h-3 shrink-0 text-white/25" />
            {material.competency_name}
          </p>
          {material.description && (
            <p className="text-xs text-white/35 leading-relaxed line-clamp-2">
              {material.description}
            </p>
          )}
        </div>

        {/* ── Mastery bar ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50 font-medium">Current Mastery</span>
            <span className="font-bold text-white tabular-nums">{masteryPct}%</span>
          </div>
          <div className="relative h-2 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-linear-to-br from-blue-400 via-purple-400 to-cyan-400"
              initial={{ width: 0 }}
              animate={{ width: `${masteryPct}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            />
            {/* shimmer overlay */}
            <span className="absolute inset-0 bg-linear-to-br from-white/0 via-white/10 to-white/0 animate-[shimmer_2s_infinite]" />
          </div>
        </div>

        {/* ── Meta row: duration + content type ── */}
        <div className="flex items-center gap-3 text-xs text-white/35">
          {material.duration_minutes !== null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {material.duration_minutes} min
            </span>
          )}
          {material.content_type && (
            <>
              <span className="w-px h-3 bg-white/15" />
              <span className="capitalize">{material.content_type}</span>
            </>
          )}
          <span className="w-px h-3 bg-white/15" />
          <span>Grade {material.grade_level}</span>
        </div>

        {/* ── CTA button ── */}
        <button
          type="button"
          onClick={() => setStudyOpen(true)}
          className={[
            "w-full btn-grad flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300",
            done
              ? "bg-none bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shadow-none hover:transform-none"
              : "",
          ].join(" ")}
        >
          <BookOpen className="w-4 h-4" />
          {done ? "Completed ✓" : "Study This"}
        </button>
      </motion.div>

      {/* ── Study Modal ── */}
      <StudyModal
        material={material}
        open={studyOpen}
        onClose={() => setStudyOpen(false)}
        onCompleted={handleCompleted}
      />
    </>
  );
}
