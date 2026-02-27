"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";
import { BookOpen, Brain, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      router.replace(user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-linear-to-br from-blue-950 via-blue-900 to-indigo-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Brain className="h-7 w-7 text-blue-300" />
          <span className="text-xl font-bold tracking-tight">SmartSoma</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 bg-transparent">
              Log in
            </Button>
          </Link>
          <Link href="/register">
            <Button className="bg-blue-500 hover:bg-blue-400 text-white">
              Get started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-16 gap-6">
        <div className="inline-flex items-center gap-2 bg-blue-800/50 border border-blue-600/40 rounded-full px-4 py-1.5 text-sm text-blue-200 mb-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Powered by BiLSTM Deep Knowledge Tracing
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight max-w-3xl">
          Your personal AI tutor,{" "}
          <span className="text-blue-300">offline-first</span>
        </h1>
        <p className="text-lg text-blue-100/80 max-w-xl">
          SmartSoma adapts to your unique learning pace and recommends CBC-aligned
          STEM materials — even without internet access.
        </p>
        <div className="flex gap-4 mt-2">
          <Link href="/register">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-400 text-white px-8">
              Start learning free
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 bg-transparent px-8">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-6 px-8 pb-24 max-w-5xl mx-auto">
        {[
          {
            icon: <Brain className="h-8 w-8 text-blue-300" />,
            title: "AI-Powered Recommendations",
            desc: "BiLSTM Deep Knowledge Tracing predicts your mastery level and surfaces the right material at the right time.",
          },
          {
            icon: <BookOpen className="h-8 w-8 text-blue-300" />,
            title: "CBC-Aligned Content",
            desc: "All materials are mapped to Rwanda's Competence-Based Curriculum for S1–S3 Math and Physics.",
          },
          {
            icon: <Wifi className="h-8 w-8 text-blue-300" />,
            title: "Works Offline",
            desc: "Edge-computing architecture keeps SmartSoma running even when school internet is unavailable.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3">
            {f.icon}
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="text-blue-100/70 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
