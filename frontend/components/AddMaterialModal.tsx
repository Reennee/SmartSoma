"use client";

/**
 * AddMaterialModal — 4-phase teacher modal for adding new learning materials via URL.
 *
 * Phase 1 "url"        — paste any URL (PDF, YouTube, or web page)
 * Phase 2 "extracting" — Claude AI analyzes the link and fills metadata
 * Phase 3 "review"     — teacher reviews / edits all fields before saving
 * Phase 4 "result"     — success confirmation
 *
 * The "Extract text for inline reading" checkbox (PDFs / web pages) triggers
 * background PDF text extraction on the backend so students can read the
 * content inline in StudyModal.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Link2,
  Loader2,
  CheckCircle,
  Youtube,
  FileText,
  Globe,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import {
  materialsApi,
  type CompetencyOut,
  type MaterialCreate,
  type MaterialPreviewResponse,
} from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = "url" | "extracting" | "review" | "result";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SUBJECTS      = ["Mathematics", "Physics"];
const GRADES        = ["S1", "S2", "S3"];
const DIFFICULTIES  = ["Beginner", "Intermediate", "Advanced"];
const CONTENT_TYPES = ["PDF", "Video", "Article", "Interactive Exercise"];

function LinkTypeBadge({ type }: { type: string }) {
  if (type === "youtube")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-400/25">
        <Youtube className="w-3 h-3" /> YouTube
      </span>
    );
  if (type === "pdf")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-400/25">
        <FileText className="w-3 h-3" /> PDF
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/55 border border-white/15">
      <Globe className="w-3 h-3" /> Web
    </span>
  );
}

// ── Shared input styles (inline so no global CSS needed) ──────────────────────

const fieldLabel = "block text-xs font-medium text-white/60 mb-1.5";
const fieldInput =
  "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30";

// ── Main component ─────────────────────────────────────────────────────────────

export default function AddMaterialModal({ open, onClose, onSuccess }: Props) {
  const [mounted, setMounted]       = useState(false);
  const [phase, setPhase]           = useState<Phase>("url");
  const [url, setUrl]               = useState("");
  const [urlError, setUrlError]     = useState("");
  const [preview, setPreview]       = useState<MaterialPreviewResponse | null>(null);
  const [competencies, setCompetencies] = useState<CompetencyOut[]>([]);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState("");
  const [savedTitle, setSavedTitle] = useState("");

  // Form fields (seeded from preview, editable by teacher)
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [subject, setSubject]           = useState("");
  const [competencyId, setCompetencyId] = useState<number | "">("");
  const [gradeLevel, setGradeLevel]     = useState("");
  const [difficulty, setDifficulty]     = useState("");
  const [contentType, setContentType]   = useState("");
  const [duration, setDuration]         = useState<number | "">("");
  const [extractText, setExtractText]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Load competencies once on first open
  useEffect(() => {
    if (!open) return;
    materialsApi.competencies().then(setCompetencies).catch(() => {});
  }, [open]);

  function reset() {
    setPhase("url"); setUrl(""); setUrlError(""); setPreview(null);
    setSaveError(""); setSavedTitle("");
    setTitle(""); setDescription(""); setSubject(""); setCompetencyId("");
    setGradeLevel(""); setDifficulty(""); setContentType(""); setDuration("");
    setExtractText(false);
  }

  function handleClose() { reset(); onClose(); }

  // ── Phase 1 → 2/3: Analyze URL ────────────────────────────────────────────

  async function analyzeUrl() {
    if (!url.trim()) { setUrlError("Please enter a URL."); return; }
    setUrlError("");
    setPhase("extracting");
    try {
      const p = await materialsApi.preview(url.trim());
      setPreview(p);
      setTitle(p.title ?? "");
      setDescription(p.description ?? "");
      setSubject(p.subject ?? "");
      setGradeLevel(p.grade_level ?? "");
      setDifficulty(p.difficulty_level ?? "");
      setContentType(p.content_type ?? "");
      if (p.competency_name && competencies.length) {
        const match = competencies.find(c => c.competency_name === p.competency_name);
        if (match) setCompetencyId(match.competency_id);
      }
      setPhase("review");
    } catch (err: unknown) {
      setUrlError(err instanceof Error ? err.message : "Could not analyze URL");
      setPhase("url");
    }
  }

  const filteredCompetencies = competencies.filter(c => !subject || c.subject === subject);

  // ── Phase 3 → 4: Save material ────────────────────────────────────────────

  async function saveMaterial() {
    if (!title.trim())   { setSaveError("Title is required."); return; }
    if (!subject)        { setSaveError("Subject is required."); return; }
    if (!competencyId)   { setSaveError("Competency is required."); return; }
    if (!difficulty)     { setSaveError("Difficulty is required."); return; }
    setSaveError("");
    setSaving(true);
    try {
      const payload: MaterialCreate = {
        title: title.trim(),
        description: description.trim() || undefined,
        file_url: url.trim() || undefined,
        subject,
        competency_id: competencyId as number,
        difficulty_level: difficulty,
        content_type: contentType || undefined,
        duration_minutes: duration !== "" ? Number(duration) : undefined,
        extract_content: extractText,
      };
      const mat = await materialsApi.create(payload);
      setSavedTitle(mat.title);
      setPhase("result");
      onSuccess?.();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save material.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-violet-400" />
                <span className="font-bold text-white text-base">Add Learning Material</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">

              {/* ── Phase: url ── */}
              {phase === "url" && (
                <div className="space-y-4">
                  <p className="text-sm text-white/55">
                    Paste a link to a PDF, YouTube video, or web page. Claude AI will auto-fill the details.
                  </p>
                  <div>
                    <label className={fieldLabel}>Material URL</label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="url"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && analyzeUrl()}
                        placeholder="https://..."
                        className={fieldInput + " pl-9"}
                      />
                    </div>
                    {urlError && <p className="text-red-400 text-xs mt-1.5">{urlError}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={analyzeUrl}
                    disabled={!url.trim()}
                    className="w-full btn-grad py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50"
                  >
                    Analyze Link
                  </button>
                </div>
              )}

              {/* ── Phase: extracting ── */}
              {phase === "extracting" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                  <p className="text-white/60 text-sm">Analyzing with AI…</p>
                  <p className="text-white/30 text-xs max-w-xs text-center">
                    Claude is reading the page and extracting curriculum metadata.
                  </p>
                </div>
              )}

              {/* ── Phase: review ── */}
              {phase === "review" && preview && (
                <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                  {/* Link type + URL */}
                  <div className="flex items-center gap-2 p-3 bg-white/4 rounded-xl border border-white/8">
                    <LinkTypeBadge type={preview.link_type} />
                    <span className="text-xs text-white/40 truncate flex-1">{url}</span>
                  </div>

                  {/* Title */}
                  <div>
                    <label className={fieldLabel}>Title <span className="text-red-400">*</span></label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Material title" className={fieldInput} />
                  </div>

                  {/* Description */}
                  <div>
                    <label className={fieldLabel}>Description</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Brief description of the material"
                      title="Description"
                      className={fieldInput + " resize-none"}
                    />
                  </div>

                  {/* Subject + Grade */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={fieldLabel}>Subject <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <select
                          value={subject}
                          onChange={e => { setSubject(e.target.value); setCompetencyId(""); }}
                          title="Subject"
                          className={fieldInput + " appearance-none pr-8"}
                        >
                          <option value="">Select…</option>
                          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabel}>Grade Level</label>
                      <div className="relative">
                        <select
                          value={gradeLevel}
                          onChange={e => setGradeLevel(e.target.value)}
                          title="Grade level"
                          className={fieldInput + " appearance-none pr-8"}
                        >
                          <option value="">Select…</option>
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Competency */}
                  <div>
                    <label className={fieldLabel}>Competency <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <select
                        value={competencyId}
                        onChange={e => setCompetencyId(Number(e.target.value) || "")}
                        title="Competency"
                        className={fieldInput + " appearance-none pr-8"}
                      >
                        <option value="">{subject ? "Select competency…" : "Select subject first"}</option>
                        {filteredCompetencies.map(c => (
                          <option key={c.competency_id} value={c.competency_id}>
                            {c.competency_name} ({c.grade_level})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                    </div>
                  </div>

                  {/* Difficulty + Content Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={fieldLabel}>Difficulty <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <select
                          value={difficulty}
                          onChange={e => setDifficulty(e.target.value)}
                          title="Difficulty level"
                          className={fieldInput + " appearance-none pr-8"}
                        >
                          <option value="">Select…</option>
                          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabel}>Content Type</label>
                      <div className="relative">
                        <select
                          value={contentType}
                          onChange={e => setContentType(e.target.value)}
                          title="Content type"
                          className={fieldInput + " appearance-none pr-8"}
                        >
                          <option value="">Select…</option>
                          {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className={fieldLabel}>Estimated Duration (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      value={duration}
                      onChange={e => setDuration(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 30"
                      className={fieldInput}
                    />
                  </div>

                  {/* Extract text checkbox — only for PDF / webpage */}
                  {(preview.link_type === "pdf" || preview.link_type === "webpage") && (
                    <label className="flex items-start gap-3 p-3 bg-violet-500/8 border border-violet-500/20 rounded-xl cursor-pointer hover:bg-violet-500/12 transition-colors">
                      <input
                        type="checkbox"
                        checked={extractText}
                        onChange={e => setExtractText(e.target.checked)}
                        className="mt-0.5 accent-violet-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-white">Extract text for inline reading</p>
                        <p className="text-xs text-white/45 mt-0.5">
                          Downloads the {preview.link_type === "pdf" ? "PDF" : "page"} in the background and
                          extracts the full text so students can read it inside the app.
                        </p>
                      </div>
                    </label>
                  )}

                  {saveError && <p className="text-red-400 text-xs">{saveError}</p>}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setPhase("url")}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={saveMaterial}
                      disabled={saving}
                      className="flex-1 btn-grad py-2.5 text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : "Add Material"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Phase: result ── */}
              {phase === "result" && (
                <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-base">{savedTitle}</p>
                    <p className="text-sm text-white/50 mt-1">Material added successfully</p>
                    {extractText && (
                      <p className="text-xs text-violet-400/80 mt-2">
                        Text extraction is running in the background — students will see the Read tab once done.
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={handleClose} className="btn-grad px-8 py-2.5 text-sm font-semibold rounded-xl">
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
