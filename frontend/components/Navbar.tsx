"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Brain, BookOpen, BarChart2, Home, LogOut, Users } from "lucide-react";
import { clearAuth, getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = getUser();

  function logout() {
    clearAuth();
    router.push("/login");
  }

  const studentLinks = [
    { href: "/student/dashboard", label: "Dashboard", icon: Home },
    { href: "/student/materials", label: "Materials", icon: BookOpen },
    { href: "/student/progress", label: "Progress", icon: BarChart2 },
  ];

  const teacherLinks = [
    { href: "/teacher/dashboard", label: "Dashboard", icon: Home },
    { href: "/teacher/analytics", label: "Analytics", icon: Users },
  ];

  const links = user?.role === "teacher" ? teacherLinks : studentLinks;

  return (
    <header className="sticky top-0 z-50 bg-blue-950/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href={user?.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard"} className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-blue-300" />
          <span className="font-bold text-white text-lg tracking-tight">SmartSoma</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-blue-500/20 text-blue-200"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-white/50 truncate max-w-[120px]">
            {user?.full_name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
