// === FILE: app/login/page.tsx ===
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
  Sparkles,
  Zap,
  BarChart3,
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

const featureCards = [
  {
    icon: Sparkles,
    title: "AI-Powered Learning",
    desc: "Personalized paths built by machine learning",
    color: "text-blue-400",
    border: "border-blue-500/25",
  },
  {
    icon: Zap,
    title: "USSD Offline Access",
    desc: "Learn anywhere — no internet required",
    color: "text-purple-400",
    border: "border-purple-500/25",
  },
  {
    icon: BarChart3,
    title: "Real-Time Progress",
    desc: "Track mastery across every competency",
    color: "text-cyan-400",
    border: "border-cyan-500/25",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      saveAuth(data.access_token, {
        user_id: data.user_id,
        full_name: data.full_name,
        role: data.role,
        school_id: data.school_id,
      });
      router.push( 
        data.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard"
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-bg min-h-screen flex">
      {/* ── Blobs ── */}
      <div className="blob blob-blue w-[520px] h-[520px] top-[-80px] left-[-120px] opacity-60 pulse-glow" />
      <div className="blob blob-purple w-[420px] h-[420px] top-[40%] left-[20%] opacity-40 pulse-glow" />
      <div className="blob blob-cyan w-[300px] h-[300px] bottom-[-60px] left-[30%] opacity-30" />

      {/* Dot grid overlay */}
      <div className="dot-grid fixed inset-0 pointer-events-none" />

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT PANEL — brand showcase (hidden on mobile)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-[52%] min-h-screen page-wrap">
        {/* Logo */}
        <motion.div
          {...fadeUpProps(0)}
          className="flex items-center gap-4 mb-10"
        >
          <div className="gcard p-4 glow-blue">
            <Brain className="h-10 w-10 text-blue-400" />
          </div>
          <span className="text-4xl font-extrabold tracking-tight grad-text">
            SmartSoma
          </span>
        </motion.div>

        {/* Tagline */}
        <motion.h1
          {...fadeUpProps(0.1)}
          className="text-5xl font-extrabold text-white leading-tight mb-4"
        >
          The smartest way
          <br />
          <span className="grad-text">to learn in Rwanda.</span>
        </motion.h1>

        <motion.p
          {...fadeUpProps(0.2)}
          className="text-white/50 text-lg mb-14 max-w-md"
        >
          AI-driven, curriculum-aligned, and accessible even without internet —
          powered by USSD.
        </motion.p>

        {/* Feature cards */}
        <div className="flex flex-col gap-4 max-w-sm">
          {featureCards.map((card, i) => (
            <motion.div
              key={card.title}
              {...fadeUpProps(0.3 + i * 0.12)}
              className={`glass glass-hover flex items-start gap-4 px-5 py-4 border ${card.border}`}
            >
              <div className="mt-0.5">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{card.title}</p>
                <p className="text-white/45 text-xs mt-0.5">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          RIGHT PANEL — auth form
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center px-6 py-16 page-wrap overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <motion.div
            {...fadeUpProps(0)}
            className="flex lg:hidden items-center justify-center gap-3 mb-8"
          >
            <Brain className="h-7 w-7 text-blue-400" />
            <span className="text-2xl font-extrabold grad-text">SmartSoma</span>
          </motion.div>

          {/* Form card */}
          <motion.div {...fadeUpProps(0.05)} className="gcard px-8 py-10">
            {/* Heading */}
            <motion.div {...fadeUpProps(0.12)} className="mb-8">
              <h2 className="text-3xl font-extrabold text-white mb-1">
                Welcome back
              </h2>
              <p className="text-white/45 text-sm">
                Sign in to continue your learning journey
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

              {/* Email */}
              <motion.div
                {...fadeUpProps(0.18)}
                className="flex flex-col gap-1.5"
              >
                <label htmlFor="login-email" className="text-white/70 text-sm font-medium">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@smartsoma.rw"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-premium pl-11"
                  />
                </div>
              </motion.div>

              {/* Password */}
              <motion.div
                {...fadeUpProps(0.24)}
                className="flex flex-col gap-1.5"
              >
                <label htmlFor="login-password" className="text-white/70 text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input-premium pl-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>

              {/* Submit */}
              <motion.div {...fadeUpProps(0.3)}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-grad w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </motion.div>
            </form>
            <motion.p
              {...fadeUpProps(0.44)}
              className="text-center text-sm text-white/40 mt-6"
            >
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
              >
                Create one free
              </Link>
            </motion.p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
