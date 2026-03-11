"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Upload, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";
import { materialsApi, studentApi, type CompetencyOut, type TestUploadResponse } from "@/lib/api";

interface Row {
  id: number;
  competency_name: string;
  score: string; // string so the input is controlled cleanly
}

let rowCounter = 0;
function newRow(): Row {
  return { id: ++rowCounter, competency_name: "", score: "" };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

type Phase = "form" | "submitting" | "result";

export default function TestUploadModal({ open, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [competencies, setCompetencies] = useState<CompetencyOut[]>([]);
  const [loadingCompetencies, setLoadingCompetencies] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<TestUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fetchCompetencies() {
    setLoadingCompetencies(true);
    setLoadError(false);
    materialsApi
      .competencies()
      .then(setCompetencies)
      .catch(() => setLoadError(true))
      .finally(() => setLoadingCompetencies(false));
  }

  // Fetch competency list once when modal opens
  useEffect(() => {
    if (!open) return;
    fetchCompetencies();
  }, [open]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setRows([newRow()]);
      setPhase("form");
      setResult(null);
      setError(null);
      setLoadError(false);
    }
  }, [open]);

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, field: keyof Omit<Row, "id">, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const valid = rows.filter(
      (r) => r.competency_name.trim() && r.score !== "" && !isNaN(Number(r.score))
    );
    if (valid.length === 0) {
      setError("Add at least one competency score before submitting.");
      return;
    }

    // Validate score range
    const outOfRange = valid.find((r) => Number(r.score) < 0 || Number(r.score) > 100);
    if (outOfRange) {
      setError(`Score for "${outOfRange.competency_name}" must be between 0 and 100.`);
      return;
    }

    setPhase("submitting");
    try {
      const res = await studentApi.uploadResults(
        valid.map((r) => ({ competency_name: r.competency_name.trim(), score: Number(r.score) }))
      );
      setResult(res);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
      setPhase("form");
    }
  }

  // Group competencies by "Subject — Grade" for clear optgroup labels
  const gradeGroups = competencies.reduce<Record<string, CompetencyOut[]>>((acc, c) => {
    const key = c.subject ? `${c.subject} — ${c.grade_level}` : c.grade_level;
    (acc[key] ??= []).push(c);
    return acc;
  }, {});

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
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 24 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="gcard w-full max-w-lg max-h-[90vh] flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/6 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-white">Upload Test Results</h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    Enter your exam scores — the AI will update your mastery profile instantly.
                  </p>
                </div>
                <button
                  title="Close"
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 px-6 py-5">
                {phase === "result" && result ? (
                  /* ── Result view ── */
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-green-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Results processed!</p>
                        <p className="text-xs text-white/40">
                          {result.updated} competenc{result.updated === 1 ? "y" : "ies"} updated
                          {result.skipped > 0 ? `, ${result.skipped} not found` : ""}.
                        </p>
                      </div>
                    </div>

                    {/* New overall mastery */}
                    <div className="gcard p-4 text-center">
                      <p className="text-xs text-white/40 uppercase tracking-wide mb-1">New Overall Mastery</p>
                      <p className="text-4xl font-black grad-text">
                        {Math.round(result.new_overall_mastery * 100)}%
                      </p>
                    </div>

                    {/* Per-competency table */}
                    <div className="space-y-2">
                      <p className="text-xs text-white/50 font-medium uppercase tracking-wide">
                        Updated competencies
                      </p>
                      {result.updated_competencies.map((c) => (
                        <div
                          key={c.competency_name}
                          className="flex items-center justify-between glass-sm px-4 py-2.5 rounded-xl"
                        >
                          <span className="text-sm text-white/70 truncate pr-2">{c.competency_name}</span>
                          <span className="text-sm font-bold text-blue-300 shrink-0">
                            {Math.round(c.mastery_score * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  /* ── Form view ── */
                  <form id="upload-form" onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-xs text-white/40 leading-relaxed">
                      Select a competency and enter your score (0–100). The model blends your
                      test score with your existing mastery to produce an updated estimate.
                    </p>

                    {/* Row list */}
                    <div className="space-y-3">
                      {rows.map((row, idx) => (
                        <motion.div
                          key={row.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="flex gap-2 items-center"
                        >
                          {/* Competency select */}
                          <div className="relative flex-1">
                            <select
                              title="Competency"
                              value={row.competency_name}
                              onChange={(e) => updateRow(row.id, "competency_name", e.target.value)}
                              disabled={loadingCompetencies || loadError}
                              className="input-premium appearance-none pr-8 text-sm w-full disabled:opacity-50"
                            >
                              <option value="">
                                {loadingCompetencies ? "Loading…" : loadError ? "Failed to load — retry below" : "Select competency…"}
                              </option>
                              {Object.entries(gradeGroups).map(([group, comps]) => (
                                <optgroup key={group} label={group}>
                                  {comps.map((c) => (
                                    <option key={c.competency_id} value={c.competency_name}>
                                      {c.competency_name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                          </div>

                          {/* Score input */}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="Score"
                            value={row.score}
                            onChange={(e) => updateRow(row.id, "score", e.target.value)}
                            className="input-premium w-24 text-sm text-center"
                          />

                          {/* Remove row */}
                          <button
                            title="trash"
                            type="button"
                            onClick={() => removeRow(row.id)}
                            disabled={rows.length === 1}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-20 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    {/* Load error retry */}
                    {loadError && (
                      <p className="text-xs text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Couldn&apos;t load competencies.{" "}
                        <button type="button" onClick={fetchCompetencies} className="underline hover:text-red-300">
                          Retry
                        </button>
                      </p>
                    )}

                    {/* Add row */}
                    <button
                      type="button"
                      onClick={addRow}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add another competency
                    </button>

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 text-xs text-red-400 glass-sm px-4 py-3 rounded-xl border border-red-500/20"
                        >
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-4 border-t border-white/6 shrink-0 flex gap-3">
                {phase === "result" ? (
                  <button type="button" onClick={onClose} className="btn-grad w-full py-3 text-sm rounded-xl">
                    Done — view updated recommendations
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white glass-sm border border-white/10 hover:border-white/20 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="upload-form"
                      disabled={phase === "submitting"}
                      className="flex-1 btn-grad py-3 text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {phase === "submitting" ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Processing…
                        </>
                      ) : (
                        <><Upload className="w-4 h-4" />Submit Results</>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
