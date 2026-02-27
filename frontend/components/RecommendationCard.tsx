"use client";

import { useState } from "react";
import { BookOpen, Clock, Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { materialsApi, type RecommendedMaterial } from "@/lib/api";

const difficultyColor: Record<string, string> = {
  Beginner: "bg-green-500/20 text-green-300 border-green-500/30",
  Intermediate: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Advanced: "bg-red-500/20 text-red-300 border-red-500/30",
};

const subjectColor: Record<string, string> = {
  Mathematics: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Physics: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

interface Props {
  material: RecommendedMaterial;
  onInteracted?: () => void;
}

export default function RecommendationCard({ material, onInteracted }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function markViewed() {
    setLoading(true);
    try {
      await materialsApi.interact(material.material_id, {
        time_spent_seconds: 60,
        quiz_score: Math.round(material.confidence_score * 100),
      });
      setDone(true);
      onInteracted?.();
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  const masteryPct = Math.round(material.current_mastery * 100);
  const confidencePct = Math.round(material.confidence_score * 100);

  return (
    <Card className="bg-white/5 border-white/10 text-white hover:bg-white/8 transition-colors">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
            {material.title}
          </CardTitle>
          <Zap className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge className={`text-xs border ${subjectColor[material.subject] ?? "bg-gray-500/20 text-gray-300"}`}>
            {material.subject}
          </Badge>
          <Badge className={`text-xs border ${difficultyColor[material.difficulty_level] ?? ""}`}>
            {material.difficulty_level}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-4 space-y-3">
        <p className="text-xs text-white/50 truncate">{material.competency_name}</p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-white/40 mb-0.5">Mastery now</p>
            <p className="font-semibold text-white">{masteryPct}%</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-white/40 mb-0.5">AI confidence</p>
            <p className="font-semibold text-blue-300">{confidencePct}%</p>
          </div>
        </div>

        {material.duration_minutes && (
          <p className="flex items-center gap-1 text-xs text-white/40">
            <Clock className="h-3 w-3" /> {material.duration_minutes} min
          </p>
        )}

        {/* Mastery progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-white/40">
            <span>Current mastery</span>
            <span>{masteryPct}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: `${masteryPct}%` }}
            />
          </div>
        </div>

        <Button
          size="sm"
          onClick={markViewed}
          disabled={loading || done}
          className={`w-full h-8 text-xs font-medium ${
            done
              ? "bg-green-600/30 text-green-300 border border-green-500/30 hover:bg-green-600/30"
              : "bg-blue-500 hover:bg-blue-400 text-white"
          }`}
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-1" />Logging…</>
          ) : done ? (
            <><BookOpen className="h-3 w-3 mr-1" />Marked as studied</>
          ) : (
            "Mark as studied"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
