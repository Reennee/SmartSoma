// === FILE: app/register/page.tsx ===
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brain,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  Users,
  BookOpen,
  TrendingUp,
  Building2,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

// ── Shared transition helper ─────────────────────────────────────────────────

function fadeUpProps(delay: number = 0) {
  return {
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: "easeOut" as const, delay },
  };
}

// ── Static data ──────────────────────────────────────────────────────────────

const stats = [
  {
    icon: Users,
    value: "50+",
    label: "Active students",
    color: "text-blue-400",
    border: "border-blue-500/20",
  },
  {
    icon: BookOpen,
    value: "100+",
    label: "Learning materials",
    color: "text-purple-400",
    border: "border-purple-500/20",
  },
  {
    icon: TrendingUp,
    value: "3",
    label: "Grade levels covered",
    color: "text-cyan-400",
    border: "border-cyan-500/20",
  },
  {
    icon: Brain,
    value: "AI",
    label: "Personalized for every learner",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
  },
];

const GRADES = ["S1", "S2", "S3"] as const;
type Grade = (typeof GRADES)[number];
type Role = "student" | "teacher";

interface FormState {
  full_name: string;
  email: string;
  password: string;
  role: Role;
  grade_level: Grade;
  school_name: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    full_name: "",
    email: "",
    password: "",
    role: "student",
    grade_level: "S1",
    school_name: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        grade_level: form.role === "student" ? form.grade_level : undefined,
        school_name: form.school_name || undefined,
      };
      const data = await authApi.register(payload);
      saveAuth(data.access_token, {
        user_id: data.user_id,
        full_name: data.full_name,
        role: data.role,
        school_id: data.school_id ?? null,
      });
      router.push(
        data.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard"
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-bg min-h-screen flex">
      {/* ── Blobs ── */}
      <div className="blob blob-purple w-[480px] h-[480px] top-[-60px] left-[-100px] opacity-55 pulse-glow" />
      <div className="blob blob-blue w-[380px] h-[380px] top-[45%] left-[18%] opacity-35 pulse-glow" />
      <div className="blob blob-cyan w-[280px] h-[280px] bottom-[-40px] left-[38%] opacity-30" />

      {/* Dot grid */}
      <div className="dot-grid fixed inset-0 pointer-events-none" />

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT PANEL — animated stats (hidden on mobile)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-[52%] min-h-screen page-wrap">
        {/* Logo */}
        <motion.div
          {...fadeUpProps(0)}
          className="flex items-center gap-4 mb-10"
        >
          <div className="gcard p-4 glow-purple">
            <Brain className="h-10 w-10 text-purple-400" />
          </div>
          <span className="text-4xl font-extrabold tracking-tight grad-text">
            SmartSoma
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          {...fadeUpProps(0.1)}
          className="text-5xl font-extrabold text-white leading-tight mb-4"
        >
          Join thousands of
          <br />
          <span className="grad-text">Rwandan learners.</span>
        </motion.h1>

        <motion.p
          {...fadeUpProps(0.2)}
          className="text-white/50 text-lg mb-12 max-w-md"
        >
          Create your free account and get an AI-personalized learning path in
          seconds — no credit card needed.
        </motion.p>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              {...fadeUpProps(0.3 + i * 0.1)}
              className={`glass glass-hover flex flex-col gap-2 px-5 py-5 border ${s.border}`}
            >
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <p className="text-2xl font-extrabold text-white">{s.value}</p>
              <p className="text-white/40 text-xs leading-tight">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          RIGHT PANEL — registration form
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center px-6 py-16 page-wrap overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <motion.div
            {...fadeUpProps(0)}
            className="flex lg:hidden items-center justify-center gap-3 mb-8"
          >
            <Brain className="h-7 w-7 text-purple-400" />
            <span className="text-2xl font-extrabold grad-text">SmartSoma</span>
          </motion.div>

          {/* Form card */}
          <motion.div {...fadeUpProps(0.05)} className="gcard px-8 py-10">
            {/* Heading */}
            <motion.div {...fadeUpProps(0.12)} className="mb-8">
              <h2 className="text-3xl font-extrabold text-white mb-1">
                Create your account
              </h2>
              <p className="text-white/45 text-sm">
                Free forever. No payment required.
              </p>
            </motion.div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="glass px-4 py-3 border border-red-500/30 rounded-xl"
                >
                  <p className="text-red-400 text-sm">{error}</p>
                </motion.div>
              )}

              {/* Full name */}
              <motion.div
                {...fadeUpProps(0.16)}
                className="flex flex-col gap-1.5"
              >
                <label className="text-white/70 text-sm font-medium">
                  Full name
                </label>
                <input
                  type="text"
                  placeholder="Uwamahoro Marie"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  required
                  className="input-premium"
                />
              </motion.div>

              {/* Email */}
              <motion.div
                {...fadeUpProps(0.22)}
                className="flex flex-col gap-1.5"
              >
                <label className="text-white/70 text-sm font-medium">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="you@smartsoma.rw"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    required
                    className="input-premium pl-11"
                  />
                </div>
              </motion.div>

              {/* Password */}
              <motion.div
                {...fadeUpProps(0.28)}
                className="flex flex-col gap-1.5"
              >
                <label className="text-white/70 text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    minLength={8}
                    required
                    className="input-premium pl-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>

              {/* Role segmented control */}
              <motion.div
                {...fadeUpProps(0.34)}
                className="flex flex-col gap-2"
              >
                <label className="text-white/70 text-sm font-medium">
                  I am a
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["student", "teacher"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => update("role", r)}
                      className={[
                        "py-3 rounded-xl border text-sm font-semibold capitalize transition-all duration-200",
                        form.role === r
                          ? "btn-grad border-transparent"
                          : "glass border-white/10 text-white/55 hover:text-white/80 hover:border-white/20",
                      ].join(" ")}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* School Name */}
              <motion.div
                {...fadeUpProps(0.40)}
                className="flex flex-col gap-1.5"
              >
                <label className="text-white/70 text-sm font-medium">
                  School Name{" "}
                  <span className="text-white/30 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. Green Hills Academy Kigali"
                    value={form.school_name}
                    onChange={(e) => update("school_name", e.target.value)}
                    className="input-premium pl-11"
                  />
                </div>
              </motion.div>

              {/* Grade level — students only */}
              {form.role === "student" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="flex flex-col gap-2 overflow-hidden"
                >
                  <label className="text-white/70 text-sm font-medium">
                    Grade level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => update("grade_level", g)}
                        className={[
                          "py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200",
                          form.grade_level === g
                            ? "bg-linear-to-br from-blue-500/30 to-purple-500/20 border-blue-500/50 text-white"
                            : "glass border-white/10 text-white/50 hover:text-white/75 hover:border-white/20",
                        ].join(" ")}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Submit */}
              <motion.div {...fadeUpProps(0.42)}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-grad w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            {/* Login link */}
            <motion.p
              {...fadeUpProps(0.5)}
              className="text-center text-sm text-white/40 mt-6"
            >
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
              >
                Sign in
              </Link>
            </motion.p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
