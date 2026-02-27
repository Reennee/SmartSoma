"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
} from "recharts";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analyticsApi, type ClassAnalyticsOut } from "@/lib/api";
import { getToken } from "@/lib/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function masteryColor(score: number): string {
  if (score >= 0.7) return "#4ade80"; // green
  if (score >= 0.4) return "#facc15"; // yellow
  return "#f87171";                    // red
}

function masteryBadge(score: number) {
  const pct = Math.round(score * 100);
  if (pct >= 70) return <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">{pct}%</Badge>;
  if (pct >= 40) return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">{pct}%</Badge>;
  return <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">{pct}%</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<ClassAnalyticsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    analyticsApi.classOverview()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white/50">
      Loading analytics…
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white/50">
      No data available.
    </div>
  );

  // ── Grade distribution ─────────────────────────────────────────────────────
  const gradeGroups = data.students.reduce<Record<string, number>>((acc, s) => {
    const g = s.grade_level ?? "Unknown";
    acc[g] = (acc[g] ?? 0) + 1;
    return acc;
  }, {});

  const gradeDistData = Object.entries(gradeGroups).map(([grade, count]) => ({
    grade,
    count,
  }));

  // ── Mastery distribution buckets ──────────────────────────────────────────
  const buckets = { "0–25%": 0, "26–50%": 0, "51–75%": 0, "76–100%": 0 };
  data.students.forEach((s) => {
    const pct = s.overall_mastery * 100;
    if (pct <= 25) buckets["0–25%"]++;
    else if (pct <= 50) buckets["26–50%"]++;
    else if (pct <= 75) buckets["51–75%"]++;
    else buckets["76–100%"]++;
  });
  const masteryDistData = Object.entries(buckets).map(([range, count]) => ({ range, count }));

  // ── Competency heatmap ────────────────────────────────────────────────────
  const heatmapRows = [...data.competency_heatmap]
    .sort((a, b) => a.avg_mastery - b.avg_mastery); // weakest first

  // ── Subject aggregation ───────────────────────────────────────────────────
  const subjectMap: Record<string, { total: number; count: number }> = {};
  data.competency_heatmap.forEach((row) => {
    // competency names follow "{Subject}: ..." pattern in some seeds
    const parts = row.competency_name.split(":");
    const subject = parts.length > 1 ? parts[0].trim() : "General";
    if (!subjectMap[subject]) subjectMap[subject] = { total: 0, count: 0 };
    subjectMap[subject].total += row.avg_mastery;
    subjectMap[subject].count++;
  });
  const subjectData = Object.entries(subjectMap).map(([subject, { total, count }]) => ({
    subject: subject.length > 14 ? subject.slice(0, 14) + "…" : subject,
    avg_mastery: Math.round((total / count) * 100),
  })).sort((a, b) => b.avg_mastery - a.avg_mastery);

  // ── Filtered students ─────────────────────────────────────────────────────
  const filteredStudents = gradeFilter === "all"
    ? data.students
    : data.students.filter((s) => s.grade_level === gradeFilter);

  const grades = Array.from(new Set(data.students.map((s) => s.grade_level ?? "Unknown"))).sort();

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-white/50 text-sm mt-1">
            Deep dive into class performance across competencies and grade levels
          </p>
        </div>

        {/* Top row: grade distribution + mastery distribution */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base">Students by Grade Level</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={gradeDistData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="grade" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e3a5f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "white", fontSize: 12 }}
                    formatter={(v: number | undefined) => [`${v ?? 0}`, "Students"]}
                  />
                  <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base">Mastery Distribution</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={masteryDistData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e3a5f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "white", fontSize: 12 }}
                    formatter={(v: number | undefined) => [`${v ?? 0}`, "Students"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {masteryDistData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? "#f87171" : i === 1 ? "#fb923c" : i === 2 ? "#facc15" : "#4ade80"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Competency Heatmap — weakest first */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base">Competency Heatmap — Weakest to Strongest</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {heatmapRows.map((row, idx) => {
                const pct = Math.round(row.avg_mastery * 100);
                return (
                  <div key={idx} className="flex items-center gap-3 py-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{row.competency_name}</p>
                      <p className="text-xs text-white/40">{row.grade_level} · {row.student_count} students</p>
                    </div>
                    <div className="w-36 flex items-center gap-2 shrink-0">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: masteryColor(row.avg_mastery) }}
                        />
                      </div>
                      {masteryBadge(row.avg_mastery)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-3 border-t border-white/10 text-xs text-white/40">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Below 40%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 40–70%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Above 70%</span>
            </div>
          </CardContent>
        </Card>

        {/* Per-student table with grade filter */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Student Details</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setGradeFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${gradeFilter === "all" ? "bg-blue-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
              >
                All
              </button>
              {grades.map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${gradeFilter === g ? "bg-blue-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-xs">
                    <th className="text-left py-2 pr-4 font-medium">Student</th>
                    <th className="text-left py-2 pr-4 font-medium">Grade</th>
                    <th className="text-left py-2 pr-4 font-medium">Sessions</th>
                    <th className="text-left py-2 font-medium">Overall Mastery</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents
                    .sort((a, b) => b.overall_mastery - a.overall_mastery)
                    .map((s) => (
                      <tr key={s.user_id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="py-2 pr-4 font-medium text-white">{s.full_name}</td>
                        <td className="py-2 pr-4 text-white/50">{s.grade_level ?? "—"}</td>
                        <td className="py-2 pr-4 text-white/50">{s.total_interactions}</td>
                        <td className="py-2 w-48">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(s.overall_mastery * 100)}%`,
                                  backgroundColor: masteryColor(s.overall_mastery),
                                }}
                              />
                            </div>
                            <span className="text-xs text-white/60 w-8 text-right">
                              {Math.round(s.overall_mastery * 100)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {filteredStudents.length === 0 && (
                <p className="text-center text-white/30 text-sm py-8">No students found for this grade.</p>
              )}
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
