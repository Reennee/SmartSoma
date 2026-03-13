"use client";

/**
 * StudyModal — opens a PDF / YouTube / webpage viewer in a full-screen overlay.
 * Tracks cumulative time spent per material in localStorage.
 * "Mark Complete" logs the interaction to the backend.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  Clock,
  ExternalLink,
  CheckCircle,
  Loader2,
  Youtube,
  FileText,
  Globe,
} from "lucide-react";
import { materialsApi, type RecommendedMaterial } from "@/lib/api";

// ── helpers ────────────────────────────────────────────────────────────────

function youtubeEmbedUrl(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=0&rel=0` : null;
}

function storageKey(material_id: number) {
  return `smartsoma_study_${material_id}`;
}

function loadSavedSeconds(material_id: number): number {
  try {
    const raw = localStorage.getItem(storageKey(material_id));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

function saveSeconds(material_id: number, seconds: number) {
  try {
    localStorage.setItem(storageKey(material_id), String(seconds));
  } catch {
    /* ignore */
  }
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  material: RecommendedMaterial;
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function StudyModal({ material, open, onClose, onCompleted }: Props) {
  const [elapsed, setElapsed] = useState(0);       // current session seconds
  const [saved, setSaved] = useState(0);            // previously saved seconds
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine viewer type
  const isYouTube =
    material.file_url != null &&
    (material.file_url.includes("youtube.com") || material.file_url.includes("youtu.be"));
  const isPDF =
    material.content_type === "PDF" ||
    (material.file_url != null && material.file_url.toLowerCase().endsWith(".pdf"));
  const embedUrl = isYouTube && material.file_url ? youtubeEmbedUrl(material.file_url) : null;

  // Load saved time when opening
  useEffect(() => {
    if (!open) return;
    const prev = loadSavedSeconds(material.material_id);
    setSaved(prev);
    setElapsed(0);
    setCompleted(false);

    // Start timer
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, material.material_id]);

  // Save progress and stop timer on close
  function handleClose() {
    if (timerRef.current) clearInterval(timerRef.current);
    saveSeconds(material.material_id, saved + elapsed);
    onClose();
  }

  async function markComplete() {
    if (completing || completed) return;
    setCompleting(true);
    const totalSeconds = saved + elapsed;
    try {
      await materialsApi.interact(material.material_id, {
        time_spent_seconds: totalSeconds,
        quiz_score: Math.round(material.confidence_score * 100),
      });
      saveSeconds(material.material_id, totalSeconds);
      setCompleted(true);
      if (timerRef.current) clearInterval(timerRef.current);
      onCompleted?.();
    } catch {
      /* silent */
    } finally {
      setCompleting(false);
    }
  }

  const totalSeconds = saved + elapsed;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col w-full h-full max-w-5xl mx-auto"
          >
            {/* ── Header bar ── */}
            <div className="flex items-start justify-between px-5 py-4 gap-4 shrink-0 border-b border-white/10 bg-[#0d0d14]/90">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {isYouTube ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-400/25">
                      <Youtube className="w-3 h-3" /> YouTube
                    </span>
                  ) : isPDF ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-400/25">
                      <FileText className="w-3 h-3" /> PDF
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white/55 border border-white/15">
                      <Globe className="w-3 h-3" /> Web
                    </span>
                  )}
                  <span className="text-[10px] text-white/35 font-medium truncate">
                    {material.competency_name}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white leading-snug line-clamp-1">
                  {material.title}
                </h2>
              </div>

              {/* Timer + close */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-sm">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-sm font-mono font-bold text-white">
                    {fmtTime(totalSeconds)}
                  </span>
                  {saved > 0 && !completed && (
                    <span className="text-[10px] text-white/35 ml-0.5">
                      (resumed)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/8 transition-colors"
                  aria-label="Close study panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Content viewer ── */}
            <div className="flex-1 min-h-0 relative bg-[#0a0a12]">
              {isYouTube && embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={material.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : isPDF && material.file_url ? (
                <iframe
                  src={material.file_url}
                  title={material.title}
                  className="w-full h-full border-0"
                />
              ) : material.file_url ? (
                /* Webpage — can't embed, show open-in-tab prompt */
                <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
                  <Globe className="w-16 h-16 text-white/15" />
                  <p className="text-white/60 text-sm max-w-sm leading-relaxed">
                    This material is a web page and can&apos;t be embedded here.
                    Open it in a new tab to study, then come back and mark it as complete.
                  </p>
                  <a
                    href={material.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-grad flex items-center gap-2 text-sm font-semibold px-5 py-2.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Material
                  </a>
                </div>
              ) : (
                /* No URL at all */
                <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                  <BookOpen className="w-16 h-16 text-white/10" />
                  <p className="text-white/45 text-sm">
                    No URL is attached to this material yet.
                  </p>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="px-5 py-4 shrink-0 border-t border-white/10 bg-[#0d0d14]/90 flex items-center justify-between gap-4">
              <div className="text-xs text-white/40">
                {material.description && (
                  <p className="line-clamp-1 max-w-xs">{material.description}</p>
                )}
                {material.duration_minutes && (
                  <p className="mt-0.5">Estimated: {material.duration_minutes} min</p>
                )}
              </div>

              <button
                type="button"
                onClick={markComplete}
                disabled={completing || completed}
                className={[
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300",
                  completed
                    ? "bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 cursor-default"
                    : "btn-grad",
                  completing ? "opacity-70 cursor-wait" : "",
                ].join(" ")}
              >
                {completing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : completed ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Completed!
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Mark Complete
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
