"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Shield, LogOut, LayoutDashboard, Upload, History, Home } from "lucide-react";
import { clearBackendTokens } from "@/lib/api-client";

export default function Navbar() {
  const { data: session, status } = useSession() || {};
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAuth = status === "authenticated";

  const handleLogout = async () => {
    clearBackendTokens();
    await signOut({ callbackUrl: "/" });
  };

  const navLinks = isAuth
    ? [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/upload", label: "Upload", icon: Upload },
        { href: "/history", label: "History", icon: History },
      ]
    : [
        { href: "/", label: "Home", icon: Home },
      ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a1a]/80 backdrop-blur-xl border-b border-cyan-500/10">
      <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={isAuth ? "/dashboard" : "/"} className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-orbitron font-bold text-lg tracking-wider text-white group-hover:text-cyan-400 transition-colors">
            Forensic<span className="text-cyan-400">Lens</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks?.map?.((link: any) => (
            <Link
              key={link?.href}
              href={link?.href ?? "/"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
            >
              {link?.icon && <link.icon className="w-4 h-4" />}
              {link?.label}
            </Link>
          )) ?? []}
          {isAuth ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-all ml-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          ) : (
            <>
              <Link href="/login" className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all">
                Login
              </Link>
              <Link href="/register" className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 transition-all">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-gray-300 hover:text-cyan-400">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0a1a]/95 backdrop-blur-xl border-b border-cyan-500/10"
          >
            <div className="max-w-[1200px] mx-auto px-4 py-4 flex flex-col gap-2">
              {navLinks?.map?.((link: any) => (
                <Link
                  key={link?.href}
                  href={link?.href ?? "/"}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-gray-300 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                >
                  {link?.icon && <link.icon className="w-4 h-4" />}
                  {link?.label}
                </Link>
              )) ?? []}
              {isAuth ? (
                <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-lg text-sm text-gray-300 hover:text-cyan-400">
                    Login
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-lg text-sm text-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
