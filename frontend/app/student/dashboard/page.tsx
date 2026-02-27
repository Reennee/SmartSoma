"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Brain, TrendingUp, BookOpen, Zap, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import RecommendationCard from "@/components/RecommendationCard";
import MasteryRadar from "@/components/MasteryRadar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { recommendApi, studentApi, type RecommendedMaterial, type StudentProgressOut } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";

export default function StudentDashboard() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<RecommendedMaterial[]>([]);
  const [progress, setProgress] = useState<StudentProgressOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const user = getUser();

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    if (user?.role === "teacher") { router.push("/teacher/dashboard"); return; }
  }, [router, user]);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [recs, prog] = await Promise.all([
        recommendApi.get(5),
        studentApi.myProgress(),
      ]);
      setRecommendations(recs);
      setProgress(prog);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const overallPct = progress ? Math.round(progress.overall_mastery * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Brain className="h-8 w-8 animate-pulse text-blue-400" />
          <p className="text-sm">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Muraho, {user?.full_name?.split(" ")[0]} 👋
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Here&apos;s what the AI recommends for you today
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white bg-transparent"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Overall Mastery", value: `${overallPct}%`, icon: TrendingUp, color: "text-blue-300" },
            { label: "Total Sessions", value: progress?.total_interactions ?? 0, icon: BookOpen, color: "text-purple-300" },
            { label: "Competencies", value: progress?.competency_mastery.length ?? 0, icon: Brain, color: "text-green-300" },
            { label: "Recommendations", value: recommendations.length, icon: Zap, color: "text-yellow-300" },
          ].map((s) => (
            <Card key={s.label} className="bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-6 w-6 ${s.color} shrink-0`} />
                <div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-white/50">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recommendations */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              AI Recommendations
            </h2>
            {recommendations.length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 text-center text-white/40">
                  No recommendations yet. The AI needs a few interactions to learn your style.
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {recommendations.map((r) => (
                  <RecommendationCard
                    key={r.material_id}
                    material={r}
                    onInteracted={() => load(true)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Mastery radar */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-400" />
              Competency Mastery
            </h2>
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-0 pt-4 px-5">
                <CardTitle className="text-sm text-white/60 font-normal">
                  Radar view across {progress?.competency_mastery.length ?? 0} competencies
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <MasteryRadar data={progress?.competency_mastery ?? []} />
              </CardContent>
            </Card>

            {/* Recent activity */}
            {progress && progress.recent_interactions.length > 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2">
                  {progress.recent_interactions.slice(0, 4).map((i, idx) => (
                    <div key={idx} className="flex justify-between items-start text-xs">
                      <p className="text-white/70 truncate max-w-[160px]">{i.material_title}</p>
                      <span className="text-white/40 shrink-0 ml-2">
                        {i.quiz_score != null ? `${i.quiz_score}%` : "—"}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
