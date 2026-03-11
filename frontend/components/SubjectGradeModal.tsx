"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, CheckCircle, AlertCircle, BookOpen } from "lucide-react";
import { studentApi, type SubjectGradeUploadResponse } from "@/lib/api";

const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Geography", "ICT"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Phase = "form" | "submitting" | "result";

export default function SubjectGradeModal({ open, onClose, onSuccess }: Props) {
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<SubjectGradeUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal closes or unmounts
  useEffect(() => {
    if (!open) return;

    return () => {
      setGrades({});
      setPhase("form");
      setResult(null);
      setError(null);
    };
  }, [open]);

  function setGrade(subject: string, value: string) {
    setGrades((prev) => ({ ...prev, [subject]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const entries = Object.entries(grades).filter(([, v]) => v.trim() !== "");
    if (entries.length === 0) {
      setError("Enter at least one subject grade before submitting.");
      return;
    }

    const outOfRange = entries.find(([, v]) => Number(v) < 0 || Number(v) > 100);
    if (outOfRange) {
      setError(`Grade for "${outOfRange[0]}" must be between 0 and 100.`);
      return;
    }

    setPhase("submitting");
    try {
      const res = await studentApi.uploadSubjectGrades(
        entries.map(([subject, grade]) => ({ subject, grade: Number(grade) }))
      );
      setResult(res);
      setPhase("result");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
      setPhase("form");
    }
  }

  function getGradeColor(grade: number) {
    if (grade >= 80) return "text-green-400";
    if (grade >= 60) return "text-blue-400";
    if (grade >= 40) return "text-yellow-400";
    return "text-red-400";
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
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    Upload Report Card Grades
                  </h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    Enter your subject grades — the AI will prioritise weak subjects in your recommendations.
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
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-green-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Grades saved!</p>
                        <p className="text-xs text-white/40">
                          {result.saved} subject{result.saved !== 1 ? "s" : ""} updated. Recommendations will now reflect your subject performance.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-white/50 font-medium uppercase tracking-wide">Saved Grades</p>
                      {result.subject_grades.map((g) => (
                        <div
                          key={g.subject}
                          className="flex items-center justify-between glass-sm px-4 py-2.5 rounded-xl"
                        >
                          <span className="text-sm text-white/70">{g.subject}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                                style={{ width: `${g.grade}%` }}
                              />
                            </div>
                            <span className={`text-sm font-bold shrink-0 ${getGradeColor(g.grade)}`}>
                              {g.grade}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <form id="grade-form" onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-xs text-white/40 leading-relaxed">
                      Enter your latest report card percentage for each subject. Leave blank to skip.
                      Subjects with lower grades will be recommended more frequently.
                    </p>

                    <div className="space-y-3">
                      {SUBJECTS.map((subject, idx) => (
                        <motion.div
                          key={subject}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="flex items-center gap-3"
                        >
                          <span className="text-sm text-white/70 flex-1">{subject}</span>
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="—"
                              value={grades[subject] ?? ""}
                              onChange={(e) => setGrade(subject, e.target.value)}
                              className="input-premium w-24 text-sm text-center"
                            />
                            {grades[subject] && (
                              <span className="absolute -right-6 top-1/2 -translate-y-1/2 text-xs font-bold text-white/30">
                                %
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>

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
                      form="grade-form"
                      disabled={phase === "submitting"}
                      className="flex-1 btn-grad py-3 text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {phase === "submitting" ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Saving…
                        </>
                      ) : (
                        <><Upload className="w-4 h-4" />Save Grades</>
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
