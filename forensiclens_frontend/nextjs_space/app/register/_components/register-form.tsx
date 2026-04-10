"use client";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { backendRegister, backendLogin } from "@/lib/api-client";

export default function RegisterForm() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { toast.error("Please fill in all fields"); return; }
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (password?.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res?.ok) { toast.error(data?.error ?? "Registration failed"); setLoading(false); return; }
      // Try backend register (non-blocking)
      try { await backendRegister(email, password, name); } catch {}
      // Auto sign in
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) { toast.error("Account created, please login"); router.replace("/login"); return; }
      try { await backendLogin(email, password); } catch {}
      toast.success("Account created successfully!");
      router.replace("/dashboard");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] grid-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-orbitron font-bold text-xl text-white">Forensic<span className="text-cyan-400">Lens</span></span>
          </Link>
          <h1 className="font-orbitron text-2xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-gray-400 text-sm">Join ForensicLens AI for advanced photo analysis</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-[#0f0f2a]/80 border border-cyan-500/10 neon-border space-y-5">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="text" value={name} onChange={(e) => setName(e?.target?.value ?? "")} placeholder="Your name"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-[#0a0a1a] border border-cyan-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="email" value={email} onChange={(e) => setEmail(e?.target?.value ?? "")} placeholder="your@email.com"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-[#0a0a1a] border border-cyan-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="password" value={password} onChange={(e) => setPassword(e?.target?.value ?? "")} placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-[#0a0a1a] border border-cyan-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e?.target?.value ?? "")} placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-[#0a0a1a] border border-cyan-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 neon-glow">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-5 h-5" /></>}
          </button>
          <p className="text-center text-sm text-gray-400">
            Already have an account? <Link href="/login" className="text-cyan-400 hover:underline">Sign in</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
