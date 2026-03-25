"use client";

/**
 * QuizModal — post-study knowledge check.
 * Shown after a student clicks "Mark Complete" in StudyModal.
 * Draws 4 questions from the quiz bank matched to the material's
 * subject + difficulty, calculates a percentage score, and returns
 * it via onComplete so StudyModal can submit it to the backend.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  ChevronRight,
  Trophy,
  Brain,
  RotateCcw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { getQuizQuestions, type QuizQuestion } from "@/lib/quizBank";
import { materialsApi } from "@/lib/api";

interface Props {
  open: boolean;
  materialId: number;
  subject: string;
  difficulty: string;
  materialTitle: string;
  onComplete: (score: number) => void; // score 0-100
  onSkip: () => void;
}

type Phase = "loading" | "quiz" | "result";

export default function QuizModal({
  open,
  materialId,
  subject,
  difficulty,
  materialTitle,
  onComplete,
  onSkip,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [score, setScore] = useState(0);
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function initQuiz(qs: QuizQuestion[], fromAI: boolean) {
    setQuestions(qs);
    setCurrent(0);
    setSelected(null);
    setAnswers(new Array(qs.length).fill(null));
    setScore(0);
    setAiGenerated(fromAI);
    setPhase("quiz");
  }

  // Fetch AI questions on open, fall back to static bank
  useEffect(() => {
    if (!open) return;
    setPhase("loading");

    materialsApi.generateQuiz(materialId)
      .then((aiQs) => {
        // Map API shape to QuizQuestion
        const qs: QuizQuestion[] = aiQs.map((q, i) => ({
          id: `ai-${materialId}-${i}`,
          text: q.text,
          options: q.options,
          correct: q.correct,
        }));
        initQuiz(qs, true);
      })
      .catch(() => {
        // API unavailable or key not set — use static bank silently
        const qs = getQuizQuestions(subject, difficulty, 4);
        initQuiz(qs, false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, materialId]);

  function handleSelect(idx: number) {
    if (selected !== null) return; // already answered
    setSelected(idx);
    const updated = [...answers];
    updated[current] = idx;
    setAnswers(updated);
  }

  function handleNext() {
    if (selected === null) return;
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setSelected(answers[current + 1]);
    } else {
      // Calculate score
      const correct = answers.filter(
        (ans, i) => ans === questions[i].correct
      ).length;
      const pct = Math.round((correct / questions.length) * 100);
      setScore(pct);
      setPhase("result");
    }
  }

  if (!mounted || !open) return null;

  const q = questions[current];
  const isAnswered = selected !== null;
  const isLast = current === questions.length - 1;
  const correct = answers.filter((a, i) => a === questions[i].correct).length;

  const scoreLabel =
    score >= 80 ? "Excellent!" : score >= 60 ? "Good job!" : score >= 40 ? "Keep going!" : "Needs review";

  const scoreBadgeColor =
    score >= 80
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/15"
      : score >= 60
      ? "text-blue-300 border-blue-400/30 bg-blue-500/15"
      : score >= 40
      ? "text-amber-300 border-amber-400/30 bg-amber-500/15"
      : "text-red-300 border-red-400/30 bg-red-500/15";

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg glass rounded-2xl border border-white/10 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-400/25">
                  <Brain className="w-4 h-4 text-violet-300" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-white/40 font-medium">Knowledge Check</p>
                    {aiGenerated && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white line-clamp-1 max-w-[260px]">
                    {materialTitle}
                  </p>
                </div>
              </div>
              {phase === "quiz" && (
                <span className="text-xs text-white/35 font-mono shrink-0">
                  {current + 1} / {questions.length}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {phase === "quiz" && (
              <div className="w-full h-1 bg-white/5">
                <motion.div
                  className="h-full bg-linear-to-r from-violet-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${((current + (isAnswered ? 1 : 0)) / questions.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {/* Loading phase */}
            {phase === "loading" && (
              <div className="p-10 flex flex-col items-center gap-4 text-center">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                <p className="text-sm text-white/50">Generating questions…</p>
              </div>
            )}

            {/* Quiz phase */}
            {phase === "quiz" && (
              <div className="p-6">
                <p className="text-white font-medium leading-relaxed mb-6 text-sm sm:text-base">
                  {q.text}
                </p>

                <div className="flex flex-col gap-2.5 mb-6">
                  {q.options.map((opt, idx) => {
                    const isSelected = selected === idx;
                    const isCorrect = idx === q.correct;
                    const showResult = selected !== null;

                    let cls =
                      "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-left border transition-all duration-200 cursor-pointer";

                    if (!showResult) {
                      cls += isSelected
                        ? " bg-violet-500/20 border-violet-400/40 text-white"
                        : " bg-white/3 border-white/8 text-white/70 hover:bg-white/6 hover:border-white/15 hover:text-white";
                    } else if (isCorrect) {
                      cls += " bg-emerald-500/15 border-emerald-400/35 text-emerald-200";
                    } else if (isSelected && !isCorrect) {
                      cls += " bg-red-500/12 border-red-400/30 text-red-300";
                    } else {
                      cls += " bg-white/2 border-white/5 text-white/35";
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        className={cls}
                        onClick={() => handleSelect(idx)}
                        disabled={showResult}
                      >
                        <span className="flex-1">{opt}</span>
                        {showResult && isCorrect && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        {showResult && isSelected && !isCorrect && (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation when answered */}
                {isAnswered && selected !== q.correct && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-300/80 text-xs leading-relaxed">
                    The correct answer is: <strong className="text-amber-200">{q.options[q.correct]}</strong>
                  </div>
                )}
                {isAnswered && selected === q.correct && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-400/20 text-emerald-300/80 text-xs">
                    Correct!
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={onSkip}
                    className="text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    Skip quiz
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!isAnswered}
                    className={[
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                      isAnswered
                        ? "btn-grad"
                        : "bg-white/5 border border-white/8 text-white/30 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {isLast ? "See Results" : "Next"}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Result phase */}
            {phase === "result" && (
              <div className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-500/30 to-blue-500/20 border border-violet-400/25 flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-1">{score}%</h3>
                <p className={`inline-block text-xs font-bold px-3 py-1 rounded-full border mb-4 ${scoreBadgeColor}`}>
                  {scoreLabel}
                </p>

                <p className="text-white/50 text-sm mb-6">
                  You answered {correct} out of {questions.length} questions correctly.
                  {score < 60 && " Review the material to strengthen your understanding."}
                </p>

                {/* Per-question summary */}
                <div className="flex flex-col gap-2 mb-6 text-left">
                  {questions.map((qs, i) => {
                    const ans = answers[i];
                    const ok = ans === qs.correct;
                    return (
                      <div
                        key={qs.id}
                        className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs ${
                          ok
                            ? "bg-emerald-500/8 border border-emerald-400/15 text-emerald-300/80"
                            : "bg-red-500/8 border border-red-400/15 text-red-300/80"
                        }`}
                      >
                        {ok ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                        )}
                        <span className="line-clamp-2">{qs.text}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Retry: regenerate questions
                      const qs = getQuizQuestions(subject, difficulty, 4);
                      setQuestions(qs);
                      setCurrent(0);
                      setSelected(null);
                      setAnswers(new Array(qs.length).fill(null));
                      setPhase("quiz");
                      setScore(0);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/8 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => onComplete(score)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-grad"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Save & Close
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
