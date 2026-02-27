"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, BookOpen, TrendingUp, Activity } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analyticsApi, studentApi, type ClassAnalyticsOut, type StudentProgressOut } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";

function MasteryBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-green-400" : pct >= 40 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white/60 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function TeacherDashboard() {
  const router = useRouter();
  const user = getUser();
  const [analytics, setAnalytics] = useState<ClassAnalyticsOut | null>(null);
  const [selected, setSelected] = useState<StudentProgressOut | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    if (user?.role !== "teacher") { router.push("/student/dashboard"); return; }
    analyticsApi.classOverview()
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router, user]);

  async function viewStudent(id: number) {
    setLoadingStudent(true);
    try {
      setSelected(await studentApi.studentProgress(id));
    } catch { /* silent */ }
    finally { setLoadingStudent(false); }
  }

  if (loading) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white/50">
      Loading class data…
    </div>
  );

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
          <p className="text-white/50 text-sm mt-1">Class overview — {analytics?.total_students} students</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Students", value: analytics?.total_students ?? 0, icon: Users, color: "text-blue-300" },
            { label: "Materials", value: analytics?.total_materials ?? 0, icon: BookOpen, color: "text-purple-300" },
            { label: "Sessions", value: analytics?.total_interactions ?? 0, icon: Activity, color: "text-green-300" },
            {
              label: "Avg Mastery",
              value: analytics?.students.length
                ? `${Math.round((analytics.students.reduce((a, s) => a + s.overall_mastery, 0) / analytics.students.length) * 100)}%`
                : "—",
              icon: TrendingUp,
              color: "text-yellow-300",
            },
          ].map((s) => (
            <Card key={s.label} className="bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-6 w-6 ${s.color} shrink-0`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-white/50">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Student table */}
          <div className="lg:col-span-3">
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-base">Students — click to view details</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="divide-y divide-white/5">
                  {(analytics?.students ?? []).map((s) => (
                    <button
                      key={s.user_id}
                      onClick={() => viewStudent(s.user_id)}
                      className={`w-full px-5 py-3 text-left hover:bg-white/5 transition-colors flex items-center justify-between gap-4 ${
                        selected?.user_id === s.user_id ? "bg-blue-500/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 text-xs font-bold shrink-0">
                          {s.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{s.full_name}</p>
                          <p className="text-xs text-white/40">{s.grade_level} · {s.total_interactions} sessions</p>
                        </div>
                      </div>
                      <div className="w-24 shrink-0">
                        <MasteryBar value={s.overall_mastery} />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Student drill-down */}
          <div className="lg:col-span-2">
            {loadingStudent ? (
              <Card className="bg-white/5 border-white/10 h-64 flex items-center justify-center">
                <p className="text-white/40 text-sm">Loading student data…</p>
              </Card>
            ) : selected ? (
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-base">{selected.full_name}</CardTitle>
                  <p className="text-xs text-white/40">{selected.grade_level} · {selected.total_interactions} sessions</p>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Overall mastery</span>
                    <Badge className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {Math.round(selected.overall_mastery * 100)}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {selected.competency_mastery.slice(0, 6).map((c) => (
                      <div key={c.competency_name}>
                        <p className="text-xs text-white/50 mb-1 truncate">{c.competency_name}</p>
                        <MasteryBar value={c.mastery_score} />
                      </div>
                    ))}
                  </div>
                  {selected.recent_interactions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/60 mb-2">Recent sessions</p>
                      {selected.recent_interactions.slice(0, 3).map((i, idx) => (
                        <div key={idx} className="flex justify-between text-xs py-1 border-b border-white/5">
                          <span className="text-white/70 truncate max-w-[140px]">{i.material_title}</span>
                          <span className="text-white/40">{i.quiz_score != null ? `${i.quiz_score}%` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 text-center text-white/30 text-sm">
                  Select a student from the list to view their progress
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Competency heatmap */}
        {analytics?.competency_heatmap && analytics.competency_heatmap.length > 0 && (
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base">Competency Heatmap (Class Average)</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {analytics.competency_heatmap.slice(0, 12).map((c) => {
                  const pct = Math.round(c.avg_mastery * 100);
                  const bg = pct >= 70 ? "border-green-500/30 bg-green-500/10" : pct >= 40 ? "border-yellow-500/30 bg-yellow-500/10" : "border-red-500/30 bg-red-500/10";
                  const text = pct >= 70 ? "text-green-300" : pct >= 40 ? "text-yellow-300" : "text-red-300";
                  return (
                    <div key={c.competency_name} className={`rounded-lg border p-3 ${bg}`}>
                      <p className="text-xs text-white/60 truncate">{c.competency_name}</p>
                      <p className={`text-xl font-bold mt-1 ${text}`}>{pct}%</p>
                      <p className="text-xs text-white/30">{c.student_count} students · {c.grade_level}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
