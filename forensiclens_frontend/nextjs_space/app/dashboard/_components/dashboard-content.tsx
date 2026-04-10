"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { Camera, Scan, ZoomIn, Activity, Upload, History, ArrowRight, ImageIcon, Clock } from "lucide-react";
import type { PhotoRecord, UserStats } from "@/lib/types";

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

function AnimatedCounter({ target, label, icon: Icon, color }: { target: number; label: string; icon: any; color: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current || target <= 0) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries?.[0]?.isIntersecting && !animated.current) {
        animated.current = true;
        const duration = 1500;
        const step = Math.max(1, Math.floor(target / (duration / 16)));
        let current = 0;
        const timer = setInterval(() => {
          current = Math.min(current + step, target);
          setCount(current);
          if (current >= target) clearInterval(timer);
        }, 16);
      }
    }, { threshold: 0.3 });
    if (ref?.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <motion.div ref={ref} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
      className="p-6 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10 hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5 transition-all">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="font-orbitron text-3xl font-bold text-white mb-1">{count}</p>
      <p className="text-gray-400 text-sm">{label}</p>
    </motion.div>
  );
}

export default function DashboardContent() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [stats, setStats] = useState<UserStats>({ totalPhotos: 0, anomaliesDetected: 0, photosUpscaled: 0, processingCount: 0 });
  const [recentPhotos, setRecentPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const fetchData = async () => {
      try {
        const [statsRes, photosRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/photos?limit=6"),
        ]);
        if (statsRes?.ok) setStats(await statsRes.json());
        if (photosRes?.ok) {
          const data = await photosRes.json();
          setRecentPhotos(data?.photos ?? []);
        }
      } catch (err: any) { console.error(err); }
      setLoading(false);
    };
    fetchData();
  }, [status]);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const statusColor = (s: string) => {
    if (s === "COMPLETED") return "text-green-400 bg-green-500/10";
    if (s === "PROCESSING") return "text-yellow-400 bg-yellow-500/10";
    if (s === "FAILED") return "text-red-400 bg-red-500/10";
    return "text-gray-400 bg-gray-500/10";
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] grid-bg">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-4">
          {/* Header */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-10">
            <h1 className="font-orbitron text-3xl font-bold text-white mb-2">
              Welcome back, <span className="text-cyan-400">{session?.user?.name ?? "Analyst"}</span>
            </h1>
            <p className="text-gray-400">Your forensic analysis command center.</p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <AnimatedCounter target={stats?.totalPhotos ?? 0} label="Photos Uploaded" icon={Camera} color="bg-gradient-to-br from-cyan-500 to-blue-600" />
            <AnimatedCounter target={stats?.anomaliesDetected ?? 0} label="Anomalies Detected" icon={Scan} color="bg-gradient-to-br from-purple-500 to-pink-600" />
            <AnimatedCounter target={stats?.photosUpscaled ?? 0} label="Photos Upscaled" icon={ZoomIn} color="bg-gradient-to-br from-green-500 to-emerald-600" />
            <AnimatedCounter target={stats?.processingCount ?? 0} label="In Progress" icon={Activity} color="bg-gradient-to-br from-amber-500 to-orange-600" />
          </div>

          {/* Quick actions */}
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <Link href="/upload" className="flex items-center gap-4 p-6 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all group">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                  <Upload className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">Upload New Photo</h3>
                  <p className="text-gray-400 text-sm">Start a new forensic analysis</p>
                </div>
                <ArrowRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: 0.1 }}>
              <Link href="/history" className="flex items-center gap-4 p-6 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-600/10 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
                  <History className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">View History</h3>
                  <p className="text-gray-400 text-sm">Browse all processed photos</p>
                </div>
                <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </div>

          {/* Recent Activity */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-orbitron text-xl font-bold text-white">Recent Activity</h2>
              {(recentPhotos?.length ?? 0) > 0 && (
                <Link href="/history" className="text-cyan-400 text-sm hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (recentPhotos?.length ?? 0) === 0 ? (
              <div className="text-center py-16 rounded-xl bg-[#0f0f2a]/60 border border-cyan-500/10">
                <ImageIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No photos yet. Upload your first photo to get started.</p>
                <Link href="/upload" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 transition-all">
                  <Upload className="w-5 h-5" /> Upload Photo
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentPhotos?.map?.((photo: PhotoRecord, i: number) => (
                  <motion.div key={photo?.id ?? i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                    variants={fadeUp} transition={{ delay: i * 0.05 }}>
                    <Link href={`/photo/${photo?.id}`}
                      className="block p-4 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10 hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5 transition-all group">
                      <div className="aspect-video rounded-lg bg-[#0a0a1a] mb-3 overflow-hidden relative">
                        {photo?.originalUrl ? (
                          <img src={photo.originalUrl} alt={photo?.fileName ?? "Photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-gray-600" /></div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{photo?.fileName ?? "Untitled"}</p>
                          <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                            <Clock className="w-3 h-3" />
                            {photo?.createdAt ? new Date(photo.createdAt).toLocaleDateString() : "Unknown"}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(photo?.status ?? "")}`}>
                          {photo?.status ?? "UNKNOWN"}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                )) ?? []}
              </div>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
