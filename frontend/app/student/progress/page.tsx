"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Clock, BookOpen } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { studentApi, type StudentProgressOut } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";

export default function ProgressPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<StudentProgressOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    studentApi.myProgress()
      .then(setProgress)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white/50">
      Loading progress…
    </div>
  );

  const barData = (progress?.competency_mastery ?? [])
    .sort((a, b) => b.mastery_score - a.mastery_score)
    .slice(0, 10)
    .map((d) => ({
      name: d.competency_name.length > 14 ? d.competency_name.slice(0, 14) + "…" : d.competency_name,
      mastery: Math.round(d.mastery_score * 100),
    }));

  const radarData = (progress?.competency_mastery ?? []).slice(0, 8).map((d) => ({
    subject: d.competency_name.length > 16 ? d.competency_name.slice(0, 16) + "…" : d.competency_name,
    mastery: Math.round(d.mastery_score * 100),
  }));

  const overallPct = progress ? Math.round(progress.overall_mastery * 100) : 0;

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">My Progress</h1>
          <p className="text-white/50 text-sm mt-1">
            {progress?.full_name} · {progress?.grade_level}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Overall Mastery", value: `${overallPct}%`, icon: TrendingUp, color: "text-blue-300" },
            { label: "Total Sessions", value: progress?.total_interactions ?? 0, icon: BookOpen, color: "text-purple-300" },
            { label: "Competencies Tracked", value: progress?.competency_mastery.length ?? 0, icon: Clock, color: "text-green-300" },
          ].map((s) => (
            <Card key={s.label} className="bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-6 w-6 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-white/50">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bar chart */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base">Mastery by Competency (Top 10)</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e3a5f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "white", fontSize: 12 }}
                    formatter={(v: number | undefined) => [`${v ?? 0}%`, "Mastery"]}
                  />
                  <Bar dataKey="mastery" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Radar */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base">Competency Radar</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 9 }} />
                  <Radar dataKey="mastery" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e3a5f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "white", fontSize: 12 }}
                    formatter={(v: number | undefined) => [`${v ?? 0}%`, "Mastery"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent interactions */}
        {progress && progress.recent_interactions.length > 0 && (
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2">
                {progress.recent_interactions.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{i.material_title}</p>
                      <p className="text-xs text-white/40">{i.subject}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-300">
                        {i.quiz_score != null ? `${i.quiz_score}%` : "—"}
                      </p>
                      <p className="text-xs text-white/40">
                        {i.time_spent_seconds ? `${Math.round(i.time_spent_seconds / 60)}m` : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
