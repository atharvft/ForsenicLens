"use client";
import { Shield } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-cyan-500/10 bg-[#060612] py-8">
      <div className="max-w-[1200px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-orbitron text-sm text-gray-400">ForensicLens AI</span>
        </div>
        <div className="flex gap-6 text-xs text-gray-500">
          <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">Dashboard</Link>
          <Link href="/upload" className="hover:text-cyan-400 transition-colors">Upload</Link>
          <Link href="/history" className="hover:text-cyan-400 transition-colors">History</Link>
        </div>
        <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} ForensicLens AI</p>
      </div>
    </footer>
  );
}
