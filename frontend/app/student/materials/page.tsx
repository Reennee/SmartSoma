"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Clock, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { materialsApi, type MaterialOut } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";

const difficultyColor: Record<string, string> = {
  Beginner: "bg-green-500/20 text-green-300 border-green-500/30",
  Intermediate: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Advanced: "bg-red-500/20 text-red-300 border-red-500/30",
};

const typeIcon: Record<string, string> = {
  PDF: "📄",
  Video: "🎬",
  "Interactive Exercise": "🧩",
};

export default function MaterialsPage() {
  const router = useRouter();
  const user = getUser();
  const [materials, setMaterials] = useState<MaterialOut[]>([]);
  const [filtered, setFiltered] = useState<MaterialOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [interacting, setInteracting] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [difficulty, setDifficulty] = useState("all");

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    materialsApi.list({ grade_level: user?.role === "student" ? (user as { grade_level?: string }).grade_level ?? undefined : undefined })
      .then((data) => { setMaterials(data); setFiltered(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router, user]);

  useEffect(() => {
    let result = materials;
    if (subject !== "all") result = result.filter((m) => m.subject === subject);
    if (difficulty !== "all") result = result.filter((m) => m.difficulty_level === difficulty);
    if (search) result = result.filter((m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.competency_name?.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [materials, subject, difficulty, search]);

  async function study(material: MaterialOut) {
    setInteracting(material.material_id);
    try {
      await materialsApi.interact(material.material_id, {
        time_spent_seconds: 300,
        quiz_score: 70,
      });
    } catch { /* silent */ }
    finally { setInteracting(null); }
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Study Materials</h1>
          <p className="text-white/50 text-sm mt-1">
            {filtered.length} CBC-aligned resources for {user?.role === "student" ? "your grade" : "all grades"}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search materials…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-blue-400"
            />
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-[150px] bg-white/5 border-white/20 text-white">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent className="bg-blue-950 border-white/20 text-white">
              <SelectItem value="all">All subjects</SelectItem>
              <SelectItem value="Mathematics">Mathematics</SelectItem>
              <SelectItem value="Physics">Physics</SelectItem>
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-[150px] bg-white/5 border-white/20 text-white">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent className="bg-blue-950 border-white/20 text-white">
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16 text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/40">No materials match your filters.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <Card key={m.material_id} className="bg-white/5 border-white/10 hover:bg-white/8 transition-colors">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xl">{typeIcon[m.content_type ?? ""] ?? "📚"}</span>
                    <Badge className={`text-xs border ${difficultyColor[m.difficulty_level] ?? ""}`}>
                      {m.difficulty_level}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold leading-tight mt-2 line-clamp-2">
                    {m.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  <p className="text-xs text-white/40 truncate">{m.competency_name}</p>
                  <div className="flex items-center justify-between">
                    <Badge className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {m.subject}
                    </Badge>
                    {m.duration_minutes && (
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Clock className="h-3 w-3" /> {m.duration_minutes}m
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => study(m)}
                    disabled={interacting === m.material_id}
                    className="w-full h-8 text-xs bg-blue-500 hover:bg-blue-400 text-white"
                  >
                    {interacting === m.material_id ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" />Logging…</>
                    ) : (
                      <><BookOpen className="h-3 w-3 mr-1" />Study this</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
