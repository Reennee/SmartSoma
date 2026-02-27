"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { authApi } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "student",
    grade_level: "S1",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        grade_level: form.role === "student" ? form.grade_level : undefined,
      };
      const data = await authApi.register(payload);
      saveAuth(data.access_token, {
        user_id: data.user_id,
        full_name: data.full_name,
        role: data.role,
      });
      router.push(data.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-950 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-white">
          <div className="bg-blue-500/20 border border-blue-400/30 rounded-2xl p-3">
            <Brain className="h-8 w-8 text-blue-300" />
          </div>
          <span className="text-2xl font-bold">SmartSoma</span>
          <p className="text-blue-200/70 text-sm">Create your free account</p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-sm text-white shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-white">Get started</CardTitle>
            <CardDescription className="text-blue-200/70">
              Fill in your details to create an account
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/15 border border-red-400/30 rounded-lg px-4 py-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-blue-100">Full name</Label>
                <Input
                  id="full_name"
                  placeholder="Uwamahoro Marie"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-blue-100">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@smartsoma.rw"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-blue-100">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    minLength={8}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label className="text-blue-100">I am a</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["student", "teacher"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => update("role", r)}
                      className={`py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors ${
                        form.role === r
                          ? "bg-blue-500 border-blue-400 text-white"
                          : "bg-white/5 border-white/20 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade — only for students */}
              {form.role === "student" && (
                <div className="space-y-2">
                  <Label className="text-blue-100">Grade level</Label>
                  <Select value={form.grade_level} onValueChange={(v) => update("grade_level", v)}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white focus:ring-blue-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-blue-950 border-white/20 text-white">
                      <SelectItem value="S1">S1 (Senior 1)</SelectItem>
                      <SelectItem value="S2">S2 (Senior 2)</SelectItem>
                      <SelectItem value="S3">S3 (Senior 3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold h-11 mt-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account…</>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-blue-200/60 mt-5">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-300 hover:text-blue-200 font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
