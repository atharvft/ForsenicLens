"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { Search, Filter, ImageIcon, Clock, Upload, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { PhotoRecord } from "@/lib/types";
import toast from "react-hot-toast";

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function HistoryContent() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const limit = 12;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const fetchPhotos = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search) params.set("search", search);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        const res = await fetch(`/api/photos?${params.toString()}`);
        if (res?.ok) {
          const data = await res.json();
          setPhotos(data?.photos ?? []);
          setTotal(data?.total ?? 0);
        }
      } catch (err: any) { console.error(err); }
      setLoading(false);
    };
    fetchPhotos();
  }, [status, page, search, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;
    try {
      const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      if (res?.ok) {
        setPhotos((prev) => (prev ?? []).filter((p: PhotoRecord) => p?.id !== id));
        setTotal((prev) => Math.max(0, (prev ?? 0) - 1));
        toast.success("Photo deleted");
      }
    } catch { toast.error("Failed to delete"); }
  };

  const totalPages = Math.ceil((total ?? 0) / limit);

  const statusColor = (s: string) => {
    if (s === "COMPLETED") return "text-green-400 bg-green-500/10";
    if (s === "PROCESSING") return "text-yellow-400 bg-yellow-500/10";
    if (s === "FAILED") return "text-red-400 bg-red-500/10";
    return "text-gray-400 bg-gray-500/10";
  };

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] grid-bg">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-8">
            <h1 className="font-orbitron text-3xl font-bold text-white mb-2">Processing History</h1>
            <p className="text-gray-400">Browse and manage all your forensic analysis results.</p>
          </motion.div>

          {/* Filters */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="text" value={search} onChange={(e) => { setSearch(e?.target?.value ?? ""); setPage(1); }}
                placeholder="Search by filename..."
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-[#0f0f2a] border border-cyan-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-all" />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e?.target?.value ?? "ALL"); setPage(1); }}
                className="pl-11 pr-8 py-3 rounded-lg bg-[#0f0f2a] border border-cyan-500/20 text-white focus:outline-none focus:border-cyan-400 transition-all appearance-none">
                <option value="ALL">All Status</option>
                <option value="UPLOADED">Uploaded</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </motion.div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : (photos?.length ?? 0) === 0 ? (
            <div className="text-center py-16 rounded-xl bg-[#0f0f2a]/60 border border-cyan-500/10">
              <ImageIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No photos found.</p>
              <Link href="/upload" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90">
                <Upload className="w-5 h-5" /> Upload Photo
              </Link>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {photos?.map?.((photo: PhotoRecord, i: number) => (
                  <motion.div key={photo?.id ?? i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                    variants={fadeUp} transition={{ delay: i * 0.03 }}
                    className="group rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10 hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5 transition-all overflow-hidden">
                    <Link href={`/photo/${photo?.id}`}>
                      <div className="aspect-video bg-[#0a0a1a] overflow-hidden relative">
                        {photo?.originalUrl ? (
                          <img src={photo.originalUrl} alt={photo?.fileName ?? "Photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-gray-600" /></div>
                        )}
                      </div>
                    </Link>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white text-sm font-medium truncate flex-1 mr-2">{photo?.fileName ?? "Untitled"}</p>
                        <button onClick={() => handleDelete(photo?.id ?? "")} className="text-gray-500 hover:text-red-400 transition-colors shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <Clock className="w-3 h-3" />
                          {photo?.createdAt ? new Date(photo.createdAt).toLocaleDateString() : ""}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(photo?.status ?? "")}`}>
                          {photo?.status ?? ""}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )) ?? []}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                    className="p-2 rounded-lg bg-[#0f0f2a] border border-cyan-500/20 text-gray-300 hover:text-cyan-400 disabled:opacity-50 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-gray-400 text-sm px-4">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                    className="p-2 rounded-lg bg-[#0f0f2a] border border-cyan-500/20 text-gray-300 hover:text-cyan-400 disabled:opacity-50 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
