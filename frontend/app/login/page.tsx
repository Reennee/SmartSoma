"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

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
      });
      router.push(data.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
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
          <p className="text-blue-200/70 text-sm">Sign in to your account</p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-sm text-white shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Welcome back</CardTitle>
            <CardDescription className="text-blue-200/70">
              Enter your email and password to continue
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
                <Label htmlFor="email" className="text-blue-100">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@smartsoma.rw"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-blue-100">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold h-11 mt-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in…</>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-5 p-3 rounded-lg bg-blue-900/40 border border-blue-700/30 space-y-1">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Demo accounts</p>
              <p className="text-xs text-blue-200/70">Student: <span className="text-blue-100 font-mono">student1@smartsoma.rw / SmartSoma2025!</span></p>
              <p className="text-xs text-blue-200/70">Teacher: <span className="text-blue-100 font-mono">teacher@smartsoma.rw / TeacherPass2025!</span></p>
            </div>

            <p className="text-center text-sm text-blue-200/60 mt-5">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-blue-300 hover:text-blue-200 font-medium">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
