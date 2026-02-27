// === FILE: components/Navbar.tsx ===
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { clearAuth, getUser, type StoredUser } from "@/lib/auth";

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

const studentLinks: NavLink[] = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/materials", label: "Materials", icon: BookOpen },
  { href: "/student/progress", label: "Progress", icon: TrendingUp },
];

const teacherLinks: NavLink[] = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function logout() {
    clearAuth();
    router.push("/login");
  }

  const links = user?.role === "teacher" ? teacherLinks : studentLinks;
  const homePath =
    user?.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* ── Sticky navbar ── */}
      <header className="sticky top-0 z-50 border-b border-white/6 navbar-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <Link
            href={homePath}
            className="flex items-center gap-2.5 group shrink-0"
          >
            <span className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-linear-to-br from-blue-500/30 to-purple-500/20 border border-blue-400/25 group-hover:border-blue-400/50 transition-colors duration-300">
              <Brain className="h-4 w-4 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
            </span>
            <span className="font-bold text-white text-lg tracking-tight leading-none">
              Smart<span className="grad-text-blue">Soma</span>
            </span>
          </Link>

          {/* ── Desktop nav links ── */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    active
                      ? "text-white"
                      : "text-white/50 hover:text-white/90 hover:bg-white/4",
                  ].join(" ")}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-white/6 border border-white/9"
                      transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
                    />
                  )}
                  <Icon className={[
                    "relative h-4 w-4 z-10 transition-colors duration-200",
                    active ? "text-blue-400" : "",
                  ].join(" ")} />
                  <span className="relative z-10">{label}</span>
                  {/* gradient underline when active */}
                  {active && (
                    <span className="absolute bottom-1 left-4 right-4 h-px bg-linear-to-br from-blue-400 via-purple-400 to-cyan-400 rounded-full opacity-70" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Right: user + logout ── */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500/40 to-purple-500/30 border border-blue-400/20 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-white/60 font-medium truncate max-w-[130px]">
                  {user.full_name}
                </span>
              </div>
            )}

            {/* Logout button */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/8 border border-transparent hover:border-red-500/20 transition-all duration-200"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Hamburger (mobile) */}
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-white/8 bg-white/4 text-white/60 hover:text-white hover:border-white/15 transition-all duration-200"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.span
                    key="x"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="h-4 w-4" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="h-4 w-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-down panel ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -12, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -12, scaleY: 0.95 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            className="md:hidden fixed top-16 inset-x-0 z-40 px-4 pt-2 pb-4 origin-top"
          >
            <div className="glass rounded-2xl overflow-hidden border border-white/8">
              {/* User info strip */}
              {user && (
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
                  <span className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500/40 to-purple-500/30 border border-blue-400/20 flex items-center justify-center text-sm font-bold text-blue-300 shrink-0">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-white/40 capitalize">{user.role}</p>
                  </div>
                </div>
              )}

              {/* Nav links */}
              <nav className="flex flex-col gap-1 p-3">
                {links.map(({ href, label, icon: Icon }, i) => {
                  const active = isActive(href);
                  return (
                    <motion.div
                      key={href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                    >
                      <Link
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={[
                          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-white/7 border border-white/10 text-white"
                            : "text-white/50 hover:text-white hover:bg-white/4",
                        ].join(" ")}
                      >
                        <Icon className={[
                          "h-4 w-4",
                          active ? "text-blue-400" : "text-white/30",
                        ].join(" ")} />
                        {label}
                        {active && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Mobile logout */}
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/8 transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop overlay when mobile menu is open */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Inline scoped style for navbar blur */}
      <style>{`
        .navbar-blur {
          background: rgba(4, 8, 26, 0.82);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
      `}</style>
    </>
  );
}
