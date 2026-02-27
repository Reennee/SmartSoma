"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Brain, Zap, BarChart3, BookOpen, Shield, ArrowRight, Sparkles } from "lucide-react";
import { isAuthenticated, getUser } from "@/lib/auth";

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let cur = 0;
    const step = 16;
    const inc = to / (1400 / step);
    const t = setInterval(() => {
      cur += inc;
      if (cur >= to) { setCount(to); clearInterval(t); }
      else setCount(Math.floor(cur));
    }, step);
    return () => clearInterval(t);
  }, [inView, to]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const features = [
  { icon: Brain, title: "BiLSTM Knowledge Tracing", desc: "Bidirectional LSTM neural network models each student's evolving mastery state across CBC competencies.", color: "from-blue-500/20 to-blue-600/10", border: "rgba(59,130,246,0.25)", ic: "text-blue-400" },
  { icon: Zap, title: "Adaptive Recommendations", desc: "Hybrid CBF + CF filtering surfaces the right material at the right difficulty — uniquely personalized per student.", color: "from-purple-500/20 to-purple-600/10", border: "rgba(139,92,246,0.25)", ic: "text-purple-400" },
  { icon: BarChart3, title: "Real-Time Analytics", desc: "Teachers see competency heatmaps, mastery distributions and student drill-downs for targeted interventions.", color: "from-cyan-500/20 to-cyan-600/10", border: "rgba(6,182,212,0.25)", ic: "text-cyan-400" },
  { icon: BookOpen, title: "CBC-Aligned Content", desc: "Every material maps to Rwanda's Competency-Based Curriculum for S1–S3 across Maths, Physics, Chemistry and more.", color: "from-green-500/20 to-green-600/10", border: "rgba(16,185,129,0.25)", ic: "text-green-400" },
  { icon: Shield, title: "Secure & Role-Based", desc: "JWT auth, role isolation, and encrypted storage keep student records protected at every layer.", color: "from-orange-500/20 to-orange-600/10", border: "rgba(249,115,22,0.25)", ic: "text-orange-400" },
  { icon: Sparkles, title: "Offline-Ready Design", desc: "Designed for low-connectivity schools — core features run on Raspberry Pi hardware deployed locally.", color: "from-pink-500/20 to-pink-600/10", border: "rgba(236,72,153,0.25)", ic: "text-pink-400" },
];

const stats = [
  { v: 50,   s: "+", l: "Students tracked" },
  { v: 100,  s: "+", l: "Learning materials" },
  { v: 1200, s: "+", l: "Interactions logged" },
  { v: 98,   s: "%", l: "Model accuracy" },
];

// Reusable inline animation props — avoids Framer Motion Variants typing issues
const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 28 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay },
});

export default function LandingPage() {
  const router = useRouter();
  useEffect(() => {
    if (isAuthenticated()) {
      const u = getUser();
      router.replace(u?.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
    }
  }, [router]);

  return (
    <div className="app-bg min-h-screen text-white overflow-hidden">
      {/* Background blobs */}
      <div className="blob blob-blue  w-[700px] h-[700px] -top-52 -left-52 opacity-25 pulse-glow" />
      <div className="blob blob-purple w-[550px] h-[550px] top-1/2 -right-40 opacity-20" style={{ animationDelay:"-6s" }} />
      <div className="blob blob-cyan   w-[450px] h-[450px] bottom-24 left-1/4 opacity-15" style={{ animationDelay:"-11s" }} />
      <div className="dot-grid absolute inset-0 pointer-events-none" style={{ opacity: 0.35 }} />

      <div className="page-wrap">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 sm:px-12 py-7 max-w-7xl mx-auto">
          <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5 }}
            className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">SmartSoma</span>
          </motion.div>
          <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5 }}
            className="flex items-center gap-3">
            <Link href="/login">
              <button className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all">
                Sign in
              </button>
            </Link>
            <Link href="/register">
              <button className="btn-grad px-5 py-2.5 text-sm rounded-xl">Get started</button>
            </Link>
          </motion.div>
        </nav>

        {/* Hero */}
        <section className="flex flex-col items-center text-center px-6 pt-12 pb-28 max-w-5xl mx-auto">
          <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-8"
            style={{ background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.3)", color:"#93c5fd" }}>
            <Sparkles className="w-3 h-3" />
            AI-Powered Learning for Rwanda&apos;s CBC Curriculum
          </motion.div>

          <motion.h1 {...fadeUp(0)}
            className="text-5xl sm:text-7xl font-black leading-[1.1] tracking-tight mb-6">
            Learn Smarter with<br />
            <span className="grad-text">AI-Guided</span> Education
          </motion.h1>

          <motion.p {...fadeUp(0.15)}
            className="text-lg sm:text-xl text-white/45 max-w-2xl leading-relaxed mb-10">
            SmartSoma uses BiLSTM Deep Knowledge Tracing to build a personalized
            learning path for every Rwandan secondary student — updating in real time.
          </motion.p>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
            className="flex flex-col sm:flex-row gap-4">
            <Link href="/register">
              <button className="btn-grad flex items-center gap-2 text-base px-8 py-4 rounded-xl">
                Start learning free <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/login">
              <button className="px-8 py-4 rounded-xl text-base font-medium text-white/55 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all">
                I have an account
              </button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-20 w-full max-w-3xl">
            {stats.map((s) => (
              <div key={s.l} className="gcard p-5 text-center">
                <p className="text-3xl sm:text-4xl font-black grad-text-blue mb-1">
                  <Counter to={s.v} suffix={s.s} />
                </p>
                <p className="text-xs text-white/40 font-medium">{s.l}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* Features */}
        <section className="px-6 pb-32 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }}
            transition={{ duration:0.55 }} viewport={{ once:true }}
            className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to <span className="grad-text">excel</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Purpose-built for CBC secondary schools, combining ML intelligence with classroom practicality.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }} transition={{ delay: i * 0.08, duration:0.55 }}
                whileHover={{ y:-6, transition:{ duration:0.2 } }}
                className="gcard p-7 cursor-default" style={{ border:`1px solid ${f.border}` }}>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5`}
                  style={{ border:`1px solid ${f.border}` }}>
                  <f.icon className={`w-6 h-6 ${f.ic}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-24 max-w-4xl mx-auto">
          <motion.div initial={{ opacity:0, scale:0.97 }} whileInView={{ opacity:1, scale:1 }}
            viewport={{ once:true }} transition={{ duration:0.6 }}
            className="gcard p-12 text-center"
            style={{ background:"linear-gradient(135deg,rgba(59,130,246,0.1),rgba(139,92,246,0.07))" }}>
            <h2 className="text-3xl font-bold mb-4">Ready to transform how you learn?</h2>
            <p className="text-white/40 mb-8 max-w-lg mx-auto">
              Join SmartSoma and let AI guide your path through Rwanda&apos;s CBC competencies.
            </p>
            <Link href="/register">
              <button className="btn-grad text-base px-10 py-4 flex items-center gap-2 mx-auto rounded-xl">
                Create free account <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </motion.div>
        </section>

        <footer className="border-t border-white/5 py-8 px-6 text-center text-white/20 text-sm">
          © {new Date().getFullYear()} SmartSoma · AI-Powered CBC Learning · Rwanda
        </footer>
      </div>
    </div>
  );
}
