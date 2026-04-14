"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  PlayCircle,
  Globe,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Filter,
  SortDesc,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { materialsApi, type MaterialOut, type MaterialUpdate } from "@/lib/api";
import { getToken } from "@/lib/auth";
import AddMaterialModal from "@/components/AddMaterialModal";
import Navbar from "@/components/Navbar";

// ── helpers ───────────────────────────────────────────────────────────────────

function typeIcon(contentType: string | null) {
  if (contentType === "Video") return <PlayCircle className="w-3.5 h-3.5" />;
  if (contentType === "PDF") return <FileText className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

function typeBadge(contentType: string | null) {
  if (contentType === "Video")
    return "bg-red-500/15 text-red-400 border-red-400/20";
  if (contentType === "PDF")
    return "bg-blue-500/15 text-blue-400 border-blue-400/20";
  return "bg-white/8 text-white/50 border-white/12";
}

function difficultyColor(level: string) {
  if (level === "Beginner") return "text-emerald-400";
  if (level === "Intermediate") return "text-amber-400";
  return "text-rose-400";
}

function extractionBadge(status: string | null, contentType: string | null, error?: string | null) {
  if (contentType === "Video") return null;
  if (status === "done")
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
        <CheckCircle2 className="w-3 h-3" /> Text ready
      </span>
    );
  if (status === "pending")
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-400">
        <Loader2 className="w-3 h-3 animate-spin" /> Extracting…
      </span>
    );
  if (status === "failed")
    return (
      <span
        className="flex items-center gap-1 text-[10px] text-rose-400 cursor-help"
        title={error ?? "Extraction failed"}
      >
        <AlertCircle className="w-3 h-3" /> Extract failed
        {error && <span className="underline underline-offset-2">(?)</span>}
      </span>
    );
  return null;
}

const SUBJECT_OPTS = ["All", "Mathematics", "Physics"];
const CONTENT_OPTS = ["All", "PDF", "Video", "Article", "Interactive Exercise"];
const DIFFICULTY_OPTS = ["Beginner", "Intermediate", "Advanced"];

// ── Edit modal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  material: MaterialOut;
  onClose: () => void;
  onSaved: (updated: MaterialOut) => void;
}

function EditMaterialModal({ material, onClose, onSaved }: EditModalProps) {
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description ?? "");
  const [fileUrl, setFileUrl] = useState(material.file_url ?? "");
  const [difficulty, setDifficulty] = useState(material.difficulty_level);
  const [contentType, setContentType] = useState(material.content_type ?? "");
  const [duration, setDuration] = useState(
    material.duration_minutes != null ? String(material.duration_minutes) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: MaterialUpdate = {
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      file_url: fileUrl.trim() || undefined,
      difficulty_level: difficulty,
      content_type: contentType || undefined,
      duration_minutes: duration ? Number(duration) : undefined,
    };
    try {
      const updated = await materialsApi.update(material.material_id, payload);
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="glass w-full max-w-lg rounded-2xl p-6 border border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Edit Material</h2>
          <button
            type="button"
            aria-label="Close edit modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 font-medium" htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              title="Material title"
              placeholder="e.g. Introduction to Algebra"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 font-medium" htmlFor="edit-description">Description</label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              title="Material description"
              placeholder="Brief summary of what this unit covers…"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 resize-none"
            />
          </div>

          {/* File URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 font-medium" htmlFor="edit-url">File / URL</label>
            <input
              id="edit-url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              title="File or external URL"
              placeholder="https://…"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50"
            />
          </div>

          {/* Difficulty + Content type + Duration row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 font-medium" htmlFor="edit-difficulty">Difficulty</label>
              <select
                id="edit-difficulty"
                title="Difficulty level"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50 cursor-pointer"
              >
                {DIFFICULTY_OPTS.map((d) => (
                  <option key={d} value={d} className="bg-[#0d0d14]">{d}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 font-medium" htmlFor="edit-type">Type</label>
              <select
                id="edit-type"
                title="Content type"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50 cursor-pointer"
              >
                {CONTENT_OPTS.filter((t) => t !== "All").map((t) => (
                  <option key={t} value={t} className="bg-[#0d0d14]">{t}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 font-medium">Duration (min)</label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="45"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/6 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-grad flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-60"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              ) : (
                <><Save className="w-4 h-4" />Save changes</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function TeacherMaterialsPage() {
  const [materials, setMaterials] = useState<MaterialOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Edit / delete state
  const [editMaterial, setEditMaterial] = useState<MaterialOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await materialsApi.list({ limit: 500 });
      // Newest first — highest material_id added most recently
      const sorted = [...data.items].sort(
        (a, b) => b.material_id - a.material_id
      );
      setMaterials(sorted);
    } catch {
      setError("Failed to load materials. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) return;
    load();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await materialsApi.delete(deleteTarget.material_id);
      setMaterials((prev) => prev.filter((m) => m.material_id !== deleteTarget.material_id));
      setDeleteTarget(null);
    } catch { /* silent — backend error would be surfaced by the global handler */ }
    finally { setDeleting(false); }
  }

  const filtered = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch =
        !search ||
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        m.subject.toLowerCase().includes(search.toLowerCase());
      const matchSubject =
        subjectFilter === "All" || m.subject === subjectFilter;
      const matchType =
        typeFilter === "All" || m.content_type === typeFilter;
      return matchSearch && matchSubject && matchType;
    });
  }, [materials, search, subjectFilter, typeFilter]);

  // stat counts
  const totalPDF   = materials.filter((m) => m.content_type === "PDF").length;
  const totalVideo = materials.filter((m) => m.content_type === "Video").length;
  const totalText  = materials.filter((m) => m.extraction_status === "done").length;

  return (
    <div className="app-bg min-h-screen">
      <Navbar />

      {/* background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="blob blob-blue top-[5%] left-[10%]" />
        <div className="blob blob-purple top-[40%] right-[8%]" />
        <div className="blob blob-cyan bottom-[10%] left-[30%]" />
      </div>

      <div className="page-wrap max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-start justify-between mb-8 gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Materials Library
            </h1>
            <p className="text-sm text-white/45">
              {materials.length} material{materials.length !== 1 ? "s" : ""} · newest first
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="btn-grad flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        </motion.div>

        {/* ── Stats strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid grid-cols-3 gap-3 mb-6"
        >
          {[
            { label: "PDFs", value: totalPDF, icon: FileText, color: "text-blue-400" },
            { label: "Videos", value: totalVideo, icon: PlayCircle, color: "text-red-400" },
            { label: "Text extracted", value: totalText, icon: CheckCircle2, color: "text-emerald-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div>
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-[11px] text-white/40">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials…"
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>

          {/* Subject filter */}
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <select
              title="Filter by subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-transparent text-sm text-white/70 focus:outline-none cursor-pointer"
            >
              {SUBJECT_OPTS.map((s) => (
                <option key={s} value={s} className="bg-[#0d0d14]">{s}</option>
              ))}
            </select>
          </div>

          {/* Content type filter */}
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-1.5">
            <SortDesc className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <select
              title="Filter by content type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-sm text-white/70 focus:outline-none cursor-pointer"
            >
              {CONTENT_OPTS.map((t) => (
                <option key={t} value={t} className="bg-[#0d0d14]">{t}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 text-violet-400/60 animate-spin" />
            <p className="text-white/40 text-sm">Loading materials…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <AlertCircle className="w-10 h-10 text-rose-400/50" />
            <p className="text-rose-300/70 text-sm">{error}</p>
            <button
              type="button"
              onClick={load}
              className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <BookOpen className="w-12 h-12 text-white/10" />
            <p className="text-white/40 text-sm">
              {materials.length === 0
                ? "No materials yet. Add one to get started."
                : "No materials match your filters."}
            </p>
            {materials.length === 0 && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="btn-grad flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl mt-1"
              >
                <Plus className="w-4 h-4" />
                Add first material
              </button>
            )}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {filtered.map((mat) => (
                <motion.div
                  key={mat.material_id}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                  }}
                  layout
                  className="glass rounded-2xl p-5 flex flex-col gap-3 hover:bg-white/5 transition-colors"
                >
                  {/* Top row: type badge + difficulty */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${typeBadge(mat.content_type)}`}
                    >
                      {typeIcon(mat.content_type)}
                      {mat.content_type ?? "Material"}
                    </span>
                    <span className={`text-[11px] font-medium ${difficultyColor(mat.difficulty_level)}`}>
                      {mat.difficulty_level}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                    {mat.title}
                  </h3>

                  {/* Description */}
                  {mat.description && (
                    <p className="text-xs text-white/40 leading-relaxed line-clamp-2">
                      {mat.description}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-auto pt-1 border-t border-white/6">
                    <span className="text-[11px] text-white/50 font-medium">
                      {mat.subject}
                    </span>
                    {mat.grade_level && (
                      <span className="text-[11px] text-white/35">
                        {mat.grade_level}
                      </span>
                    )}
                    {mat.competency_name && (
                      <span className="text-[11px] text-white/30 truncate max-w-[140px]">
                        {mat.competency_name}
                      </span>
                    )}
                    {mat.duration_minutes && (
                      <span className="flex items-center gap-1 text-[11px] text-white/35 ml-auto">
                        <Clock className="w-3 h-3" />
                        {mat.duration_minutes} min
                      </span>
                    )}
                  </div>

                  {/* Extraction status + link */}
                  <div className="flex items-center justify-between">
                    {extractionBadge(mat.extraction_status, mat.content_type, mat.extraction_error)}
                    {mat.file_url && (
                      <a
                        href={mat.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors ml-auto"
                      >
                        Open ↗
                      </a>
                    )}
                  </div>

                  {/* Edit / Delete actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/6">
                    <button
                      type="button"
                      aria-label={`Edit ${mat.title}`}
                      onClick={() => setEditMaterial(mat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${mat.title}`}
                      onClick={() => setDeleteTarget(mat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Add Material modal */}
      <AddMaterialModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {
          setAddOpen(false);
          load();
        }}
      />

      {/* Edit modal */}
      <AnimatePresence>
        {editMaterial && (
          <EditMaterialModal
            material={editMaterial}
            onClose={() => setEditMaterial(null)}
            onSaved={(updated) => {
              setMaterials((prev) =>
                prev.map((m) => (m.material_id === updated.material_id ? updated : m))
              );
              setEditMaterial(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="glass w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </div>
                <h2 className="text-sm font-bold text-white">Delete material?</h2>
              </div>
              <p className="text-xs text-white/50 leading-relaxed mb-5">
                <span className="text-white/80 font-medium">&ldquo;{deleteTarget.title}&rdquo;</span>{" "}
                will be permanently removed along with all student interaction logs for it.
                This cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/6 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 transition-colors disabled:opacity-60"
                >
                  {deleting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Deleting…</>
                  ) : (
                    <><Trash2 className="w-4 h-4" />Yes, delete</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
