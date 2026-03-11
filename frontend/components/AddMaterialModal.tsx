// === FILE: components/AddMaterialModal.tsx ===
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen, CheckCircle, ExternalLink, FileText,
  Globe, Loader2, Plus, Sparkles, X, Youtube,
} from "lucide-react";
import {
  materialsApi,
  type CompetencyOut,
  type MaterialCreate,
  type MaterialPreviewResponse,
} from "@/lib/api";

// ── Constants ──────────────────────────────────────────────────────────────────

const SUBJECTS = ["Mathematics", "Physics"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const CONTENT_TYPES = ["PDF", "Video", "Article", "Interactive Exercise"];
const GRADE_LEVELS = ["S1", "S2", "S3"];

// ── Link-type badge ────────────────────────────────────────────────────────────

function LinkTypeBadge({ type }: { type: "youtube" | "pdf" | "webpage" }) {
  const map = {
    youtube: {
      icon: <Youtube className="w-3 h-3" />,
      label: "YouTube",
      cls: "bg-red-500/15 text-red-300 border-red-400/25",
    },
    pdf: {
      icon: <FileText className="w-3 h-3" />,
      label: "PDF",
      cls: "bg-orange-500/15 text-orange-300 border-orange-400/25",
    },
    webpage: {
      icon: <Globe className="w-3 h-3" />,
      label: "Web Page",
      cls: "bg-sky-500/15 text-sky-300 border-sky-400/25",
    },
  } as const;

  const { icon, label, cls } = map[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ── Field ──────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-white/60 tracking-wide uppercase">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-white/5 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-colors";
const selectCls = `${inputCls} cursor-pointer`;

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (material: { title: string; competency_name: string }) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AddMaterialModal({ open, onClose, onSuccess }: Props) {
  type Phase = "url" | "extracting" | "review" | "saving" | "result";

  const [phase, setPhase] = useState<Phase>("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<MaterialPreviewResponse | null>(null);
  const [competencies, setCompetencies] = useState<CompetencyOut[]>([]);
  const [saved, setSaved] = useState<{ title: string; competency_name: string } | null>(null);

  // Review form state
  const [form, setForm] = useState<{
    title: string;
    description: string;
    subject: string;
    competency_id: number | "";
    difficulty_level: string;
    content_type: string;
    duration_minutes: string;
  }>({
    title: "",
    description: "",
    subject: "",
    competency_id: "",
    difficulty_level: "",
    content_type: "",
    duration_minutes: "",
  });

  // Load competencies once
  useEffect(() => {
    if (!open) return;
    materialsApi
      .competencies()
      .then(setCompetencies)
      .catch(() => {});
  }, [open]);

  // Prefill form when preview arrives
  useEffect(() => {
    if (!preview) return;
    const matchedComp = competencies.find(
      (c) => c.competency_name === preview.competency_name
    );
    setForm({
      title: preview.title ?? "",
      description: preview.description ?? "",
      subject: preview.subject ?? "",
      competency_id: matchedComp ? matchedComp.competency_id : "",
      difficulty_level: preview.difficulty_level ?? "",
      content_type: preview.content_type ?? "",
      duration_minutes: preview.duration_minutes != null ? String(preview.duration_minutes) : "",
    });
  }, [preview, competencies]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPhase("url");
      setUrl("");
      setError("");
      setPreview(null);
      setSaved(null);
    }
  }, [open]);

  const filteredCompetencies = form.subject
    ? competencies.filter((c) => c.subject === form.subject)
    : competencies;

  // Group by grade
  const gradeGroups = filteredCompetencies.reduce<Record<string, CompetencyOut[]>>((acc, c) => {
    (acc[c.grade_level] ??= []).push(c);
    return acc;
  }, {});

  async function handleAnalyze() {
    if (!url.trim()) { setError("Please enter a URL"); return; }
    setError("");
    setPhase("extracting");
    try {
      const result = await materialsApi.preview(url.trim());
      setPreview(result);
      setPhase("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to analyze URL");
      setPhase("url");
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (!form.subject) { setError("Subject is required"); return; }
    if (!form.competency_id) { setError("Competency is required"); return; }
    if (!form.difficulty_level) { setError("Difficulty is required"); return; }
    setError("");
    setPhase("saving");

    const payload: MaterialCreate = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      file_url: preview?.file_url || url.trim() || undefined,
      subject: form.subject,
      competency_id: Number(form.competency_id),
      difficulty_level: form.difficulty_level,
      content_type: form.content_type || undefined,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
    };

    try {
      const material = await materialsApi.create(payload);
      const comp = competencies.find((c) => c.competency_id === material.competency_id);
      const result = {
        title: material.title,
        competency_name: comp?.competency_name ?? material.competency_name ?? "",
      };
      setSaved(result);
      setPhase("result");
      onSuccess?.(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save material");
      setPhase("review");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gcard w-full max-w-lg flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="shrink-0 flex items-start justify-between gap-4 p-5 border-b border-white/8">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-violet-400" />
                    Add Learning Material
                  </h2>
                  <p className="text-xs text-white/45 mt-0.5">
                    Paste any link — AI will extract the metadata for you
                  </p>
                </div>
                <button
                  type="button"
                  title="Close"
                  onClick={onClose}
                  className="shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* ── URL Phase ── */}
                {phase === "url" && (
                  <div className="space-y-4">
                    <p className="text-sm text-white/55">
                      Enter a YouTube video URL, PDF link, or any web page — Claude AI will extract
                      the title, subject, competency, and more.
                    </p>
                    <Field label="Material URL" required>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        placeholder="https://youtube.com/watch?v=… or https://reb.rw/..."
                        className={inputCls}
                        autoFocus
                      />
                    </Field>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                  </div>
                )}

                {/* ── Extracting Phase ── */}
                {phase === "extracting" && (
                  <div className="py-8 flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Analyzing with AI…</p>
                      <p className="text-xs text-white/45 mt-1">
                        Fetching the link and extracting curriculum metadata
                      </p>
                    </div>
                    <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                  </div>
                )}

                {/* ── Review Phase ── */}
                {(phase === "review" || phase === "saving") && preview && (
                  <div className="space-y-4">
                    {/* Link info */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white/4 border border-white/8">
                      <LinkTypeBadge type={preview.link_type} />
                      <a
                        href={preview.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white/45 hover:text-white/70 truncate flex items-center gap-1 transition-colors"
                      >
                        {preview.file_url}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    {/* AI note */}
                    <div className="flex items-center gap-1.5 text-xs text-violet-300/80">
                      <Sparkles className="w-3 h-3" />
                      AI pre-filled the fields below — review and adjust as needed
                    </div>

                    <Field label="Title" required>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Material title"
                        className={inputCls}
                        disabled={phase === "saving"}
                      />
                    </Field>

                    <Field label="Description">
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Brief description of this material…"
                        rows={2}
                        className={`${inputCls} resize-none`}
                        disabled={phase === "saving"}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Subject" required>
                        <select
                          title="Subject"
                          value={form.subject}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, subject: e.target.value, competency_id: "" }))
                          }
                          className={selectCls}
                          disabled={phase === "saving"}
                        >
                          <option value="">Select…</option>
                          {SUBJECTS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Difficulty" required>
                        <select
                          title="Difficulty"
                          value={form.difficulty_level}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, difficulty_level: e.target.value }))
                          }
                          className={selectCls}
                          disabled={phase === "saving"}
                        >
                          <option value="">Select…</option>
                          {DIFFICULTIES.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <Field label="Competency" required>
                      <select
                        title="Competency"
                        value={form.competency_id}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, competency_id: e.target.value ? Number(e.target.value) : "" }))
                        }
                        className={selectCls}
                        disabled={phase === "saving"}
                      >
                        <option value="">Select competency…</option>
                        {Object.entries(gradeGroups).sort().map(([grade, comps]) => (
                          <optgroup key={grade} label={grade}>
                            {comps.map((c) => (
                              <option key={c.competency_id} value={c.competency_id}>
                                {c.competency_name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Content Type">
                        <select
                          title="Content Type"
                          value={form.content_type}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, content_type: e.target.value }))
                          }
                          className={selectCls}
                          disabled={phase === "saving"}
                        >
                          <option value="">Select…</option>
                          {CONTENT_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Duration (min)">
                        <input
                          type="number"
                          min={1}
                          max={300}
                          value={form.duration_minutes}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, duration_minutes: e.target.value }))
                          }
                          placeholder="e.g. 30"
                          className={inputCls}
                          disabled={phase === "saving"}
                        />
                      </Field>
                    </div>

                    {error && <p className="text-xs text-red-400">{error}</p>}
                  </div>
                )}

                {/* ── Result Phase ── */}
                {phase === "result" && saved && (
                  <div className="py-6 flex flex-col items-center gap-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Material Added!</p>
                      <p className="text-xs text-white/50 mt-1 max-w-xs">
                        <span className="text-white/80 font-medium">{saved.title}</span>
                        {" "}has been added to the library and will appear in student recommendations.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/12 border border-blue-400/20 text-xs text-blue-300">
                      <BookOpen className="w-3 h-3" />
                      {saved.competency_name}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 flex gap-2 p-4 border-t border-white/8">
                {phase === "url" && (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      className="flex-1 btn-grad flex items-center justify-center gap-2 text-sm font-semibold"
                    >
                      <Sparkles className="w-4 h-4" />
                      Analyze Link
                    </button>
                  </>
                )}

                {phase === "extracting" && (
                  <button
                    type="button"
                    disabled
                    className="flex-1 btn-grad flex items-center justify-center gap-2 text-sm font-semibold opacity-60 cursor-wait"
                  >
                    <Spinner />
                    Analyzing…
                  </button>
                )}

                {(phase === "review" || phase === "saving") && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setPhase("url"); setError(""); }}
                      disabled={phase === "saving"}
                      className="py-2.5 px-4 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 transition-colors disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={phase === "saving"}
                      className="flex-1 btn-grad flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
                    >
                      {phase === "saving" ? (
                        <><Spinner /> Saving…</>
                      ) : (
                        <><Plus className="w-4 h-4" /> Add Material</>
                      )}
                    </button>
                  </>
                )}

                {phase === "result" && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 btn-grad flex items-center justify-center gap-2 text-sm font-semibold"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Done
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
