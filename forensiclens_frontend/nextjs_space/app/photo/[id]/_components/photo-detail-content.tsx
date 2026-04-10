"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import {
  Scan, ZoomIn, Download, ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  ImageIcon, SplitSquareHorizontal, Eye, Maximize2, MinusCircle, PlusCircle,
  RefreshCw, Clock, FileType, HardDrive, Camera, MapPin, Pencil, Info,
  Calendar, Shield, ChevronDown, ChevronUp, Globe, Cpu, Layers,
  FileText, Search, Share2, Activity, FileJson, FileSpreadsheet, ExternalLink
} from "lucide-react";
import type { PhotoRecord } from "@/lib/types";
import toast from "react-hot-toast";

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

interface Props {
  photoId: string;
}

export default function PhotoDetailContent({ photoId }: Props) {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [photo, setPhoto] = useState<PhotoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [anomalyProcessing, setAnomalyProcessing] = useState(false);
  const [upscaleProcessing, setUpscaleProcessing] = useState(false);
  const [activeView, setActiveView] = useState<"original" | "anomaly" | "upscaled" | "heatmap" | "compare">("original");
  const [zoom, setZoom] = useState(1);
  const [comparePosition, setComparePosition] = useState(50);
  const compareRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [rawMetadataExpanded, setRawMetadataExpanded] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [socialSearching, setSocialSearching] = useState(false);
  const [socialResults, setSocialResults] = useState<any>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [elaHeatmapUrl, setElaHeatmapUrl] = useState<string | null>(null);
  const [algorithmExpanded, setAlgorithmExpanded] = useState(false);

  const getAlgoColor = (lk: string) => {
    if (lk === "critical" || lk === "high") return { border: "border-red-500/20", bg: "bg-red-500/5", text: "text-red-400" };
    if (lk === "medium") return { border: "border-yellow-500/20", bg: "bg-yellow-500/5", text: "text-yellow-400" };
    return { border: "border-green-500/20", bg: "bg-green-500/5", text: "text-green-400" };
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const fetchPhoto = useCallback(async () => {
    try {
      const res = await fetch(`/api/photos/${photoId}`);
      if (res?.ok) {
        const data = await res.json();
        setPhoto(data);
        return data;
      }
    } catch (err: any) { console.error(err); }
    return null;
  }, [photoId]);

  const fetchMetadata = useCallback(async () => {
    if (!photoId) return;
    setMetadataLoading(true);
    try {
      const res = await fetch(`/api/photos/${photoId}/metadata`);
      if (res?.ok) {
        const data = await res.json();
        setMetadata(data?.metadata || null);
      }
    } catch (err: any) { console.error("Metadata fetch error:", err); }
    setMetadataLoading(false);
  }, [photoId]);

  useEffect(() => {
    if (status !== "authenticated" || !photoId) return;
    const load = async () => {
      await fetchPhoto();
      await fetchMetadata();
      setLoading(false);
    };
    load();
  }, [status, photoId, fetchPhoto, fetchMetadata]);

  // Polling for processing status
  useEffect(() => {
    if (!anomalyProcessing && !upscaleProcessing) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    pollingRef.current = setInterval(async () => {
      const data = await fetchPhoto();
      if (data?.anomalyStatus === "COMPLETED" || data?.anomalyStatus === "FAILED") setAnomalyProcessing(false);
      if (data?.upscaleStatus === "COMPLETED" || data?.upscaleStatus === "FAILED") setUpscaleProcessing(false);
    }, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [anomalyProcessing, upscaleProcessing, fetchPhoto]);

  const handleDetectAnomalies = async () => {
    if (!photo?.id) return;
    setAnomalyProcessing(true);
    try {
      const analyzeRes = await fetch(`/api/photos/${photo.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json().catch(() => ({}));
        throw new Error(errData?.error ?? `Analysis failed with status ${analyzeRes.status}`);
      }

      await fetchPhoto();
      setAnomalyProcessing(false);
      toast.success("Forensic analysis complete!");
    } catch (err: any) {
      console.error("Anomaly detection error:", err);
      setAnomalyProcessing(false);
      toast.error(err?.message ?? "Anomaly detection failed");
    }
  };

  const handleUpscale = async () => {
    if (!photo?.id) return;
    setUpscaleProcessing(true);
    try {
      const upscaleRes = await fetch(`/api/photos/${photo.id}/upscale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!upscaleRes.ok) {
        const errData = await upscaleRes.json().catch(() => ({}));
        throw new Error(errData?.error ?? `Upscaling failed with status ${upscaleRes.status}`);
      }

      await fetchPhoto();
      setUpscaleProcessing(false);
      toast.success("Image upscaling complete!");
    } catch (err: any) {
      console.error("Upscale error:", err);
      setUpscaleProcessing(false);
      toast.error(err?.message ?? "Upscaling failed");
    }
  };

  const handleDownload = async (url: string | null | undefined, filename: string) => {
    if (!url) return;
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { toast.error("Download failed"); }
  };

  const handleCompareMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!compareRef?.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setComparePosition(x);
  };

  // Generate DOCX Report
  const handleGenerateReport = async () => {
    if (!photo?.id) return;
    setReportGenerating(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}/report`);
      if (!res.ok) throw new Error("Report generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ForensicLens_Report_${photo.id.substring(0, 8).toUpperCase()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Forensic report downloaded!");
    } catch (err: any) {
      toast.error(err?.message || "Report generation failed");
    }
    setReportGenerating(false);
  };

  // Reverse Image Search - uses anchor click to work inside iframes
  const openInNewTab = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReverseSearch = (engine: string) => {
    if (!photo?.originalUrl) { toast.error("No image URL available"); return; }
    let searchUrl = "";
    const encodedUrl = encodeURIComponent(photo.originalUrl);
    if (engine === "google") searchUrl = `https://www.google.com/searchbyimage?image_url=${encodedUrl}&sbisrc=forensiclens`;
    else if (engine === "tineye") searchUrl = `https://tineye.com/search?url=${encodedUrl}`;
    else if (engine === "yandex") searchUrl = `https://yandex.com/images/search?rpt=imageview&url=${encodedUrl}`;
    else if (engine === "bing") searchUrl = `https://www.bing.com/images/search?q=imgurl:${encodedUrl}&view=detailv2&iss=sbi`;
    if (searchUrl) openInNewTab(searchUrl);
  };

  // Export as JSON
  const handleExportJSON = () => {
    if (!photo) return;
    const exportData = {
      case_number: `FL-${photo.id.substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`,
      export_date: new Date().toISOString(),
      image: { fileName: photo.fileName, fileSize: photo.fileSize, mimeType: photo.mimeType, uploadDate: photo.createdAt },
      analysis: photo.anomalyData || null,
      metadata: metadata || null,
      statuses: { anomaly: photo.anomalyStatus, upscale: photo.upscaleStatus },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `forensiclens_${photo.id.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("JSON exported!");
  };

  // Export as CSV
  const handleExportCSV = () => {
    if (!photo) return;
    const ad = photo.anomalyData as any;
    const rows = [["Field", "Value"]];
    rows.push(["Case Number", `FL-${photo.id.substring(0, 8).toUpperCase()}`]);
    rows.push(["File Name", photo.fileName || ""]);
    rows.push(["File Size (MB)", photo.fileSize ? (photo.fileSize / 1024 / 1024).toFixed(2) : ""]);
    rows.push(["MIME Type", photo.mimeType || ""]);
    rows.push(["Upload Date", photo.createdAt ? new Date(photo.createdAt).toISOString() : ""]);
    rows.push(["Verdict", ad?.verdict || ""]);
    rows.push(["Authenticity Score", ad?.overall_score != null ? String(Math.round(ad.overall_score * 100)) + "%" : ""]);
    rows.push(["AI Generated", ad?.is_ai_generated != null ? String(ad.is_ai_generated) : ""]);
    rows.push(["Manipulated", ad?.is_manipulated != null ? String(ad.is_manipulated) : ""]);
    rows.push(["Suspected Generator", ad?.ai_generator_likely || ""]);
    rows.push(["Summary", ad?.summary || ""]);
    (ad?.findings || []).forEach((f: any, i: number) => {
      rows.push([`Finding ${i + 1} Type`, (f.type || "").replace(/_/g, " ")]);
      rows.push([`Finding ${i + 1} Severity`, f.severity || ""]);
      rows.push([`Finding ${i + 1} Confidence`, f.confidence != null ? Math.round(f.confidence * 100) + "%" : ""]);
      rows.push([`Finding ${i + 1} Description`, f.description || ""]);
      rows.push([`Finding ${i + 1} Anomaly`, String(f.anomaly_detected || false)]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `forensiclens_${photo.id.substring(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exported!");
  };

  // Social Media Search - shows platform links for manual searching
  const handleSocialSearch = async () => {
    if (!photo?.originalUrl) return;
    setSocialSearching(true);
    const encodedUrl = encodeURIComponent(photo.originalUrl);
    const platforms = [
      { name: "Google Images", url: `https://www.google.com/searchbyimage?image_url=${encodedUrl}&sbisrc=forensiclens` },
      { name: "TinEye", url: "https://tineye.com/search?url=" + encodedUrl },
      { name: "Yandex Images", url: `https://yandex.com/images/search?rpt=imageview&url=${encodedUrl}` },
      { name: "Bing Visual Search", url: `https://www.bing.com/images/search?q=imgurl:${encodedUrl}&view=detailv2&iss=sbi` },
    ];
    setSocialResults({ manual: true, platforms });
    setSocialSearching(false);
  };

  const anomalyData = (photo?.anomalyData as any) || null;

  // Toggle heatmap when view changes
  useEffect(() => { setShowHeatmap(activeView === "heatmap"); }, [activeView]);

  // Extract real ELA heatmap from forensic algorithm results
  useEffect(() => {
    if (!anomalyData?.forensic_algorithms?.ela?.heatmap_base64) {
      setElaHeatmapUrl(null);
      return;
    }
    setElaHeatmapUrl(anomalyData.forensic_algorithms.ela.heatmap_base64);
  }, [anomalyData]);

  // Build forensic timeline
  const getTimeline = () => {
    if (!photo) return [];
    const events: { time: string; label: string; status: string; icon: string }[] = [];
    const em = (photo.anomalyData as any)?.extracted_metadata;
    if (em?.date_original) events.push({ time: new Date(em.date_original).toLocaleString(), label: "Photo Captured (EXIF)", status: "info", icon: "" });
    if (em?.date_modified && em?.time_mismatch) events.push({ time: new Date(em.date_modified).toLocaleString(), label: "Photo Modified (EXIF)", status: "warning", icon: "" });
    else if (em?.date_modified) events.push({ time: new Date(em.date_modified).toLocaleString(), label: "Photo Modified (EXIF)", status: "info", icon: "" });
    if (em?.date_digitized && em.date_digitized !== em?.date_original) events.push({ time: new Date(em.date_digitized).toLocaleString(), label: "Photo Digitized (EXIF)", status: "info", icon: "" });
    events.push({ time: new Date(photo.createdAt).toLocaleString(), label: "Uploaded to ForensicLens", status: "success", icon: "" });
    if (photo.anomalyStatus === "COMPLETED") events.push({ time: new Date(photo.updatedAt || photo.createdAt).toLocaleString(), label: `Forensic Analysis: ${(photo.anomalyData as any)?.verdict || "Complete"}`, status: (photo.anomalyData as any)?.is_ai_generated || (photo.anomalyData as any)?.is_manipulated ? "danger" : "success", icon: "" });
    if (photo.anomalyStatus === "FAILED") events.push({ time: new Date(photo.updatedAt || photo.createdAt).toLocaleString(), label: "Analysis Failed", status: "danger", icon: "" });
    if (photo.upscaleStatus === "COMPLETED") events.push({ time: new Date(photo.updatedAt || photo.createdAt).toLocaleString(), label: "Image Upscaled", status: "success", icon: "" });
    events.push({ time: new Date().toLocaleString(), label: "Report Viewed", status: "info", icon: "" });
    return events;
  };

  if (status === "loading" || status === "unauthenticated" || loading) {
    return <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!photo) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] grid-bg">
        <Navbar />
        <main className="pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">Photo not found</p>
            <button onClick={() => router.back()} className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white">Go Back</button>
          </div>
        </main>
      </div>
    );
  }

  const compareImageUrl = activeView === "compare" 
    ? (photo?.upscaledUrl ?? photo?.anomalyUrl ?? null) 
    : null;

  const MetaRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-gray-500 text-[11px] shrink-0">{label}</span>
      <span className={`text-[11px] text-right truncate max-w-[180px] ${highlight ? "text-orange-400 font-medium" : "text-gray-300"}`}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a1a] grid-bg">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-4">
          {/* Header */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-8">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-4">
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="font-orbitron text-2xl font-bold text-white mb-1">{photo?.fileName ?? "Photo Analysis"}</h1>
                <div className="flex items-center gap-4 text-gray-400 text-sm">
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{photo?.createdAt ? new Date(photo.createdAt).toLocaleString() : ""}</span>
                  {photo?.fileSize && <span className="flex items-center gap-1"><HardDrive className="w-4 h-4" />{((photo.fileSize ?? 0) / 1024 / 1024).toFixed(2)} MB</span>}
                  {photo?.mimeType && <span className="flex items-center gap-1"><FileType className="w-4 h-4" />{photo.mimeType}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(photo?.originalUrl, `original_${photo?.fileName ?? "photo"}`)} 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 text-sm hover:bg-cyan-500/10 transition-all">
                  <Download className="w-4 h-4" /> Original
                </button>
                {photo?.upscaledUrl && (
                  <button onClick={() => handleDownload(photo?.upscaledUrl, `upscaled_${photo?.fileName ?? "photo"}`)} 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 text-green-400 text-sm hover:bg-green-500/10 transition-all">
                    <Download className="w-4 h-4" /> Upscaled
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Image viewer - 2 cols */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="lg:col-span-2">
              {/* View tabs */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {[
                  { key: "original", label: "Original", icon: ImageIcon },
                  { key: "anomaly", label: "Anomaly Map", icon: Scan, disabled: photo?.anomalyStatus !== "COMPLETED" },
                  { key: "upscaled", label: "Upscaled", icon: ZoomIn, disabled: photo?.upscaleStatus !== "COMPLETED" },
                  { key: "heatmap", label: "ELA Heatmap", icon: Activity, disabled: photo?.anomalyStatus !== "COMPLETED" || !elaHeatmapUrl },
                  { key: "compare", label: "Compare", icon: SplitSquareHorizontal, disabled: !photo?.upscaledUrl && !photo?.anomalyUrl },
                ].map((tab: any) => (
                  <button key={tab?.key}
                    onClick={() => !tab?.disabled && setActiveView(tab?.key)}
                    disabled={tab?.disabled}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                      activeView === tab?.key
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : tab?.disabled
                          ? "text-gray-600 cursor-not-allowed"
                          : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}>
                    {tab?.icon && <tab.icon className="w-4 h-4" />}
                    {tab?.label}
                  </button>
                ))}
              </div>

              {/* Image display */}
              <div className="rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10 overflow-hidden">
                {activeView === "compare" && compareImageUrl ? (
                  <div ref={compareRef} onMouseMove={handleCompareMove} className="relative aspect-video cursor-col-resize select-none">
                    {/* Original (full) */}
                    <div className="absolute inset-0">
                      {photo?.originalUrl ? (
                        <img src={photo.originalUrl} alt="Original" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#0a0a1a]"><ImageIcon className="w-16 h-16 text-gray-600" /></div>
                      )}
                    </div>
                    {/* Processed (clipped) */}
                    <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}>
                      <img src={compareImageUrl} alt="Processed" className="w-full h-full object-contain" />
                    </div>
                    {/* Slider line */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-10" style={{ left: `${comparePosition}%` }}>
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-cyan-400 flex items-center justify-center">
                        <SplitSquareHorizontal className="w-4 h-4 text-[#0a0a1a]" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-white text-xs">Original</div>
                    <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 text-cyan-400 text-xs">Processed</div>
                  </div>
                ) : (
                  <div className="relative aspect-video">
                    <div className="w-full h-full overflow-auto flex items-center justify-center bg-[#0a0a1a]">
                      {activeView === "original" && photo?.originalUrl && (
                        <img src={photo.originalUrl} alt="Original" style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-full object-contain transition-transform" />
                      )}
                      {activeView === "anomaly" && (
                        photo?.anomalyUrl ? (
                          <img src={photo.anomalyUrl} alt="Anomaly" style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-full object-contain transition-transform" />
                        ) : photo?.originalUrl ? (
                          <div className="relative">
                            <img src={photo.originalUrl} alt="Anomaly overlay" style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-full object-contain transition-transform" />
                            {photo?.anomalyStatus === "COMPLETED" && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm">
                                  <CheckCircle2 className="w-5 h-5 inline mr-2" />Analysis complete - see results
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <ImageIcon className="w-16 h-16 text-gray-600" />
                        )
                      )}
                      {activeView === "upscaled" && (
                        photo?.upscaledUrl ? (
                          <img src={photo.upscaledUrl} alt="Upscaled" style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-full object-contain transition-transform" />
                        ) : (
                          <ImageIcon className="w-16 h-16 text-gray-600" />
                        )
                      )}
                      {activeView === "heatmap" && elaHeatmapUrl && (
                        <div className="relative">
                          <img src={elaHeatmapUrl} alt="Error Level Analysis Heatmap" style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-full object-contain transition-transform" />
                          <div className="absolute top-3 left-3 bg-black/80 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-cyan-400 font-orbitron font-bold mb-1">ERROR LEVEL ANALYSIS</p>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-[10px] text-gray-300">Manipulated</span></div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" /><span className="text-[10px] text-gray-300">Suspicious</span></div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-900" /><span className="text-[10px] text-gray-300">Clean</span></div>
                            </div>
                            {anomalyData?.forensic_algorithms?.ela && (
                              <p className="text-[9px] text-gray-400 mt-1">
                                Mean Error: {anomalyData.forensic_algorithms.ela.mean_error} | 
                                Suspicious: {(anomalyData.forensic_algorithms.ela.suspicious_pixel_ratio * 100).toFixed(1)}%
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {activeView === "original" && !photo?.originalUrl && <ImageIcon className="w-16 h-16 text-gray-600" />}
                    </div>
                    {/* Zoom controls */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 rounded-lg p-1">
                      <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="p-1 text-white hover:text-cyan-400"><MinusCircle className="w-5 h-5" /></button>
                      <span className="text-white text-xs min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(Math.min(3, zoom + 0.25))} className="p-1 text-white hover:text-cyan-400"><PlusCircle className="w-5 h-5" /></button>
                      <button onClick={() => setZoom(1)} className="p-1 text-white hover:text-cyan-400"><Maximize2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Sidebar - 1 col */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.1 }} className="space-y-4">
              {/* Actions */}
              <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10">
                <h3 className="font-orbitron text-sm font-bold text-white mb-4">Processing Actions</h3>
                <div className="space-y-3">
                  <button onClick={handleDetectAnomalies}
                    disabled={anomalyProcessing || photo?.anomalyStatus === "PROCESSING"}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-600/10 border border-purple-500/20 hover:border-purple-500/40 text-white text-sm transition-all disabled:opacity-50">
                    {anomalyProcessing || photo?.anomalyStatus === "PROCESSING" ? (
                      <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                    ) : photo?.anomalyStatus === "COMPLETED" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Scan className="w-5 h-5 text-purple-400" />
                    )}
                    <div className="text-left flex-1">
                      <p className="font-medium">{photo?.anomalyStatus === "COMPLETED" ? "Re-detect Anomalies" : "Detect Anomalies"}</p>
                      <p className="text-gray-400 text-xs">{anomalyProcessing ? "Processing..." : "AI-powered manipulation detection"}</p>
                    </div>
                  </button>

                  <button onClick={handleUpscale}
                    disabled={upscaleProcessing || photo?.upscaleStatus === "PROCESSING"}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 hover:border-cyan-500/40 text-white text-sm transition-all disabled:opacity-50">
                    {upscaleProcessing || photo?.upscaleStatus === "PROCESSING" ? (
                      <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    ) : photo?.upscaleStatus === "COMPLETED" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <ZoomIn className="w-5 h-5 text-cyan-400" />
                    )}
                    <div className="text-left flex-1">
                      <p className="font-medium">{photo?.upscaleStatus === "COMPLETED" ? "Re-upscale Image" : "Upscale / Recreate"}</p>
                      <p className="text-gray-400 text-xs">{upscaleProcessing ? "Processing..." : "Neural network enhancement"}</p>
                    </div>
                  </button>

                  {/* DOCX Report */}
                  <button onClick={handleGenerateReport}
                    disabled={reportGenerating}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-indigo-600/10 border border-blue-500/20 hover:border-blue-500/40 text-white text-sm transition-all disabled:opacity-50">
                    {reportGenerating ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" /> : <FileText className="w-5 h-5 text-blue-400" />}
                    <div className="text-left flex-1">
                      <p className="font-medium">Generate DOCX Report</p>
                      <p className="text-gray-400 text-xs">{reportGenerating ? "Generating..." : "Full forensic report download"}</p>
                    </div>
                  </button>

                  {/* Reverse Image Search */}
                  <div className="relative group">
                    <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-600/10 border border-green-500/20 hover:border-green-500/40 text-white text-sm transition-all">
                      <Search className="w-5 h-5 text-green-400" />
                      <div className="text-left flex-1">
                        <p className="font-medium">Reverse Image Search</p>
                        <p className="text-gray-400 text-xs">Find this image across the web</p>
                      </div>
                    </button>
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[#0f0f2a] border border-cyan-500/20 rounded-lg overflow-hidden z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      {[
                        { id: "google", label: "Google Lens", color: "text-blue-400" },
                        { id: "tineye", label: "TinEye", color: "text-green-400" },
                        { id: "yandex", label: "Yandex", color: "text-yellow-400" },
                        { id: "bing", label: "Bing Visual", color: "text-cyan-400" },
                      ].map(e => (
                        <button key={e.id} onClick={() => handleReverseSearch(e.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 text-sm transition-colors">
                          <ExternalLink className={`w-3.5 h-3.5 ${e.color}`} /><span className="text-gray-300">{e.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Social Media Tracker */}
                  <button onClick={handleSocialSearch}
                    disabled={socialSearching}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-pink-500/10 to-rose-600/10 border border-pink-500/20 hover:border-pink-500/40 text-white text-sm transition-all disabled:opacity-50">
                    {socialSearching ? <Loader2 className="w-5 h-5 text-pink-400 animate-spin" /> : <Share2 className="w-5 h-5 text-pink-400" />}
                    <div className="text-left flex-1">
                      <p className="font-medium">Social Media Tracker</p>
                      <p className="text-gray-400 text-xs">{socialSearching ? "Searching..." : "Search image across platforms"}</p>
                    </div>
                  </button>
                </div>

                {/* Export Buttons */}
                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Export Data</p>
                  <div className="flex gap-2">
                    <button onClick={handleExportJSON}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-400 text-xs transition-all">
                      <FileJson className="w-3.5 h-3.5" /> JSON
                    </button>
                    <button onClick={handleExportCSV}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-400 text-xs transition-all">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Social Media Results */}
              {socialResults && (
                <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-pink-500/10">
                  <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-pink-400" /> Image Search Results
                  </h3>
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs mb-2">Search this image on these platforms:</p>
                    {socialResults.platforms?.map((p: any, i: number) => (
                      <button key={i} onClick={() => openInNewTab(p.url)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg bg-[#0a0a1a] border border-pink-500/10 hover:border-pink-500/30 transition-colors text-left">
                        <ExternalLink className="w-3.5 h-3.5 text-pink-400" />
                        <span className="text-gray-300 text-xs">{p.name}</span>
                        <ExternalLink className="w-3 h-3 text-gray-500 ml-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Forensic Timeline */}
              <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10">
                <button onClick={() => setTimelineExpanded(!timelineExpanded)}
                  className="w-full flex items-center justify-between">
                  <h3 className="font-orbitron text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Chain of Custody
                  </h3>
                  {timelineExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                <AnimatePresence>
                  {timelineExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-4 relative">
                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/30 to-transparent" />
                        {getTimeline().map((event, i) => {
                          const dotColor = event.status === "danger" ? "bg-red-500" : event.status === "warning" ? "bg-yellow-500" : event.status === "success" ? "bg-green-500" : "bg-cyan-500";
                          return (
                            <div key={i} className="relative pl-8 pb-4 last:pb-0">
                              <div className={`absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full ${dotColor} border-2 border-[#0f0f2a]`} />
                              <p className="text-white text-xs font-medium">{event.icon} {event.label}</p>
                              <p className="text-gray-500 text-[10px] mt-0.5">{event.time}</p>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!timelineExpanded && (
                  <p className="text-gray-500 text-[10px] text-center mt-2">{getTimeline().length} events tracked</p>
                )}
              </div>

              {/* Anomaly results */}
              {photo?.anomalyStatus === "COMPLETED" && anomalyData && (
                <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10">
                  <h3 className="font-orbitron text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" /> Forensic Analysis Results
                  </h3>

                  {/* AI Generated / Manipulated badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {anomalyData?.is_ai_generated != null && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${anomalyData.is_ai_generated ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-green-500/20 text-green-400 border border-green-500/30"}`}>
                        {anomalyData.is_ai_generated ? "AI Generated" : "Not AI Generated"}
                      </span>
                    )}
                    {anomalyData?.is_manipulated != null && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${anomalyData.is_manipulated ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-green-500/20 text-green-400 border border-green-500/30"}`}>
                        {anomalyData.is_manipulated ? "Manipulated" : "No Manipulation"}
                      </span>
                    )}
                    {anomalyData?.ai_generator_likely && anomalyData.ai_generator_likely !== "null" && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        {anomalyData.ai_generator_likely}
                      </span>
                    )}
                  </div>

                  {anomalyData?.overall_score != null && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Authenticity Score</span>
                        <span className={`font-orbitron font-bold ${(anomalyData.overall_score ?? 0) >= 0.7 ? "text-green-400" : (anomalyData.overall_score ?? 0) >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                          {Math.round((anomalyData.overall_score ?? 0) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#0a0a1a] overflow-hidden">
                        <div className={`h-full rounded-full ${(anomalyData.overall_score ?? 0) >= 0.7 ? "bg-gradient-to-r from-cyan-500 to-green-500" : (anomalyData.overall_score ?? 0) >= 0.4 ? "bg-gradient-to-r from-yellow-500 to-orange-500" : "bg-gradient-to-r from-red-500 to-pink-500"}`}
                          style={{ width: `${(anomalyData.overall_score ?? 0) * 100}%` }} />
                      </div>
                      {anomalyData?.verdict && (
                        <p className={`text-sm mt-2 font-medium ${(anomalyData.overall_score ?? 0) >= 0.7 ? "text-green-400" : (anomalyData.overall_score ?? 0) >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                          {anomalyData.verdict}
                        </p>
                      )}
                    </div>
                  )}

                  {/* AI Generation Score Bar */}
                  {anomalyData?.ai_generation_score != null && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">AI Generation Probability</span>
                        <span className={`font-orbitron font-bold ${(anomalyData.ai_generation_score ?? 0) > 0.5 ? "text-red-400" : (anomalyData.ai_generation_score ?? 0) > 0.3 ? "text-yellow-400" : "text-green-400"}`}>
                          {Math.round((anomalyData.ai_generation_score ?? 0) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#0a0a1a] overflow-hidden">
                        <div className={`h-full rounded-full ${(anomalyData.ai_generation_score ?? 0) > 0.5 ? "bg-gradient-to-r from-red-500 to-pink-500" : (anomalyData.ai_generation_score ?? 0) > 0.3 ? "bg-gradient-to-r from-yellow-500 to-orange-500" : "bg-gradient-to-r from-cyan-500 to-green-500"}`}
                          style={{ width: `${Math.max((anomalyData.ai_generation_score ?? 0) * 100, 2)}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {anomalyData?.summary && (
                    <div className="mb-4 p-3 rounded-lg bg-[#0a0a1a] border border-cyan-500/10">
                      <p className="text-gray-300 text-xs leading-relaxed">{anomalyData.summary}</p>
                    </div>
                  )}

                  {(anomalyData?.findings ?? [])?.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-gray-500 text-xs uppercase tracking-wider">Detailed Findings</p>
                      {(anomalyData.findings ?? []).map?.((f: any, i: number) => {
                        const severityColor = f?.severity === "critical" ? "border-red-500/30 bg-red-500/5" : f?.severity === "high" ? "border-orange-500/30 bg-orange-500/5" : f?.severity === "medium" ? "border-yellow-500/30 bg-yellow-500/5" : "border-cyan-500/5 bg-[#0a0a1a]";
                        const severityBadge = f?.severity === "critical" ? "bg-red-500/20 text-red-400" : f?.severity === "high" ? "bg-orange-500/20 text-orange-400" : f?.severity === "medium" ? "bg-yellow-500/20 text-yellow-400" : f?.severity === "low" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400";
                        return (
                          <div key={i} className={`p-3 rounded-lg border ${severityColor}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white text-xs font-medium">{f?.type?.replace?.(/_/g, " ")?.toUpperCase?.() ?? ""}</span>
                              <div className="flex items-center gap-2">
                                {f?.severity && f.severity !== "none" && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${severityBadge}`}>{f.severity}</span>
                                )}
                                <span className="text-cyan-400 text-xs font-orbitron">{Math.round((f?.confidence ?? 0) * 100)}%</span>
                              </div>
                            </div>
                            <p className="text-gray-400 text-xs">{f?.description ?? ""}</p>
                            {f?.anomaly_detected && (
                              <p className="text-red-400 text-[10px] mt-1 font-medium">Anomaly Detected</p>
                            )}
                          </div>
                        );
                      }) ?? []}
                    </div>
                  )}
                </div>
              )}

              {/* Real Forensic Algorithm Data */}
              {photo?.anomalyStatus === "COMPLETED" && anomalyData?.forensic_algorithms && (
                <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10">
                  <button onClick={() => setAlgorithmExpanded(!algorithmExpanded)} className="w-full flex items-center justify-between">
                    <h3 className="font-orbitron text-sm font-bold text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-cyan-400" /> Forensic Algorithm Data
                    </h3>
                    {algorithmExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {anomalyData?.algorithms_used && (
                    <p className="text-[10px] text-gray-500 mt-1">{anomalyData.algorithms_used.length} algorithms executed in {anomalyData.processing_time_ms}ms</p>
                  )}

                  {algorithmExpanded && (
                    <div className="mt-4 space-y-3">
                      {/* ELA */}
                      {anomalyData.forensic_algorithms.ela && (() => {
                        const ela = anomalyData.forensic_algorithms.ela;
                        const ac = getAlgoColor(ela.manipulation_likelihood);
                        return (
                          <div className={`p-3 rounded-lg border ${ac.border} ${ac.bg}`}>
                            <p className="text-white text-xs font-bold mb-1">Error Level Analysis (ELA)</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              <span className="text-gray-400">Mean Error</span><span className="text-white">{ela.mean_error}</span>
                              <span className="text-gray-400">Max Error</span><span className="text-white">{ela.max_error}</span>
                              <span className="text-gray-400">Std Deviation</span><span className="text-white">{ela.std_deviation}</span>
                              <span className="text-gray-400">Suspicious Pixels</span><span className="text-white">{(ela.suspicious_pixel_ratio * 100).toFixed(1)}%</span>
                              <span className="text-gray-400">Likelihood</span><span className={`font-bold uppercase ${ac.text}`}>{ela.manipulation_likelihood}</span>
                            </div>
                            <p className="text-gray-400 text-[10px] mt-1">{ela.details}</p>
                          </div>
                        );
                      })()}

                      {/* Noise */}
                      {anomalyData.forensic_algorithms.noise && (() => {
                        const n = anomalyData.forensic_algorithms.noise;
                        const ac = getAlgoColor(n.manipulation_likelihood);
                        return (
                          <div className={`p-3 rounded-lg border ${ac.border} ${ac.bg}`}>
                            <p className="text-white text-xs font-bold mb-1">Noise Pattern Analysis</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              <span className="text-gray-400">Global Noise</span><span className="text-white">{n.global_noise_level}</span>
                              <span className="text-gray-400">Variance</span><span className="text-white">{n.noise_variance}</span>
                              <span className="text-gray-400">Inconsistency</span><span className="text-white">{(n.inconsistency_score * 100).toFixed(1)}%</span>
                              <span className="text-gray-400">Suspicious Blocks</span><span className="text-white">{n.suspicious_blocks}/64</span>
                              <span className="text-gray-400">Uniform (AI)</span><span className={`font-bold ${n.uniform_noise ? "text-red-400" : "text-green-400"}`}>{n.uniform_noise ? "YES" : "NO"}</span>
                              <span className="text-gray-400">Likelihood</span><span className={`font-bold uppercase ${ac.text}`}>{n.manipulation_likelihood}</span>
                            </div>
                            <p className="text-gray-400 text-[10px] mt-1">{n.details}</p>
                          </div>
                        );
                      })()}

                      {/* JPEG Ghost */}
                      {anomalyData.forensic_algorithms.jpeg_ghost && (() => {
                        const j = anomalyData.forensic_algorithms.jpeg_ghost;
                        const ac = getAlgoColor(j.manipulation_likelihood);
                        return (
                          <div className={`p-3 rounded-lg border ${ac.border} ${ac.bg}`}>
                            <p className="text-white text-xs font-bold mb-1">JPEG Ghost / Double Compression</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              <span className="text-gray-400">Ghost Detected</span><span className={`font-bold ${j.ghost_detected ? "text-red-400" : "text-green-400"}`}>{j.ghost_detected ? "YES" : "NO"}</span>
                              <span className="text-gray-400">Double Compression</span><span className={`font-bold ${j.double_compression_evidence ? "text-red-400" : "text-green-400"}`}>{j.double_compression_evidence ? "YES" : "NO"}</span>
                              <span className="text-gray-400">Est. Original Quality</span><span className="text-white">{j.min_difference_quality}%</span>
                              <span className="text-gray-400">Likelihood</span><span className={`font-bold uppercase ${ac.text}`}>{j.manipulation_likelihood}</span>
                            </div>
                            <p className="text-gray-400 text-[10px] mt-1">{j.details}</p>
                          </div>
                        );
                      })()}

                      {/* Histogram */}
                      {anomalyData.forensic_algorithms.histogram && (() => {
                        const h = anomalyData.forensic_algorithms.histogram;
                        const ac = getAlgoColor(h.manipulation_likelihood);
                        return (
                          <div className={`p-3 rounded-lg border ${ac.border} ${ac.bg}`}>
                            <p className="text-white text-xs font-bold mb-1">Histogram & Channel Analysis</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              <span className="text-gray-400">R-G Correlation</span><span className="text-white">{h.channel_correlation}</span>
                              <span className="text-gray-400">Dynamic Range</span><span className="text-white">{h.dynamic_range}/255</span>
                              <span className="text-gray-400">Unnatural Peaks</span><span className="text-white">{h.unnatural_peaks}</span>
                              <span className="text-gray-400">Saturation</span><span className="text-white">{h.overall_saturation}</span>
                              <span className="text-gray-400">Likelihood</span><span className={`font-bold uppercase ${ac.text}`}>{h.manipulation_likelihood}</span>
                            </div>
                            {h.channels && (
                              <div className="mt-1 text-[9px] text-gray-500">
                                R: μ={h.channels.red.mean} σ={h.channels.red.std} | G: μ={h.channels.green.mean} σ={h.channels.green.std} | B: μ={h.channels.blue.mean} σ={h.channels.blue.std}
                              </div>
                            )}
                            <p className="text-gray-400 text-[10px] mt-1">{h.details}</p>
                          </div>
                        );
                      })()}

                      {/* Copy-Move */}
                      {anomalyData.forensic_algorithms.copy_move && (() => {
                        const c = anomalyData.forensic_algorithms.copy_move;
                        const ac = getAlgoColor(c.manipulation_likelihood);
                        return (
                          <div className={`p-3 rounded-lg border ${ac.border} ${ac.bg}`}>
                            <p className="text-white text-xs font-bold mb-1">Copy-Move Detection</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              <span className="text-gray-400">Blocks Analyzed</span><span className="text-white">{c.blocks_analyzed}</span>
                              <span className="text-gray-400">Similar Pairs</span><span className="text-white">{c.similar_block_pairs}</span>
                              <span className="text-gray-400">Clone Detected</span><span className={`font-bold ${c.clone_detected ? "text-red-400" : "text-green-400"}`}>{c.clone_detected ? "YES" : "NO"}</span>
                              <span className="text-gray-400">Likelihood</span><span className={`font-bold uppercase ${ac.text}`}>{c.manipulation_likelihood}</span>
                            </div>
                            <p className="text-gray-400 text-[10px] mt-1">{c.details}</p>
                          </div>
                        );
                      })()}

                      {/* AI Generation Detection */}
                      {anomalyData?.ai_detection && (() => {
                        const ai = anomalyData.ai_detection;
                        const aiScore = ai.ai_probability ?? 0;
                        const isAI = aiScore > 0.5;
                        const aiColor = isAI
                          ? { border: "border-red-500/30", bg: "bg-red-500/5", text: "text-red-400" }
                          : aiScore > 0.3
                          ? { border: "border-yellow-500/30", bg: "bg-yellow-500/5", text: "text-yellow-400" }
                          : { border: "border-green-500/30", bg: "bg-green-500/5", text: "text-green-400" };
                        const signalLabels: Record<string, string> = {
                          metadata_absent: "Metadata Absent",
                          noise_too_uniform: "Noise Too Uniform",
                          ela_too_clean: "ELA Too Clean",
                          histogram_too_smooth: "Histogram Too Smooth",
                          high_channel_correlation: "High Channel Correlation",
                          frequency_anomaly: "Frequency Anomaly",
                        };
                        const boolSignals = ai.signals ? Object.entries(ai.signals).filter(([k, v]) => typeof v === "boolean") : [];
                        return (
                          <div className={`p-3 rounded-lg border ${aiColor.border} ${aiColor.bg}`}>
                            <p className="text-white text-xs font-bold mb-1">AI Generation Detection</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              <span className="text-gray-400">AI Probability</span>
                              <span className={`font-bold ${aiColor.text}`}>{(aiScore * 100).toFixed(1)}%</span>
                              <span className="text-gray-400">Verdict</span>
                              <span className={`font-bold ${aiColor.text}`}>{String(ai.verdict).replace(/_/g, " ")}</span>
                              <span className="text-gray-400">Confidence</span>
                              <span className="text-white">{((ai.confidence ?? 0) * 100).toFixed(0)}%</span>
                            </div>
                            {boolSignals.length > 0 && (
                              <div className="mt-2 space-y-0.5">
                                <p className="text-gray-500 text-[9px] uppercase font-bold">Detection Signals:</p>
                                {boolSignals.map(([key, val]) => (
                                  <div key={key} className="flex items-center justify-between text-[10px]">
                                    <span className="text-gray-400">{signalLabels[key] || key}</span>
                                    <span className={val ? "text-red-400 font-bold" : "text-green-400"}>
                                      {val ? "DETECTED" : "Normal"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {ai.signals && (
                              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                                <span className="text-gray-500">Texture Uniformity</span><span className="text-gray-300">{((ai.signals.texture_uniformity_score ?? 0) * 100).toFixed(0)}%</span>
                                <span className="text-gray-500">Spectral Ratio</span><span className="text-gray-300">{(ai.signals.spectral_energy_ratio ?? 0).toFixed(3)}</span>
                                <span className="text-gray-500">Block Artifacts</span><span className="text-gray-300">{((ai.signals.block_artifact_score ?? 0) * 100).toFixed(0)}%</span>
                              </div>
                            )}
                            <p className="text-gray-400 text-[10px] mt-1">{ai.details}</p>
                          </div>
                        );
                      })()}

                      {/* Engine info */}
                      {anomalyData?.analysis_engine && (
                        <div className="p-2 rounded-lg bg-[#0a0a1a] border border-cyan-500/5">
                          <p className="text-cyan-400 text-[10px] font-orbitron">{anomalyData.analysis_engine}</p>
                          <p className="text-gray-500 text-[9px]">
                            {anomalyData.image_dimensions?.width}×{anomalyData.image_dimensions?.height} | {anomalyData.file_size_bytes ? (anomalyData.file_size_bytes / 1024).toFixed(0) + "KB" : ""} | {anomalyData.processing_time_ms}ms
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Metadata Analysis from AI */}
              {photo?.anomalyStatus === "COMPLETED" && anomalyData?.metadata_analysis && (
                <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10">
                  <h3 className="font-orbitron text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-yellow-400" /> Metadata Forensics
                  </h3>
                  <div className="space-y-2 mb-3">
                    {[
                      { label: "Editing Detected", value: anomalyData.metadata_analysis.editing_detected, icon: Pencil },
                      { label: "Timestamp Anomaly", value: anomalyData.metadata_analysis.timestamp_anomaly, icon: Calendar },
                      { label: "Metadata Stripped", value: anomalyData.metadata_analysis.metadata_stripped, icon: AlertCircle },
                      { label: "Multiple Saves", value: anomalyData.metadata_analysis.multiple_saves, icon: Layers },
                      { label: "AI Markers Found", value: anomalyData.metadata_analysis.ai_markers_found, icon: Cpu },
                    ].map((item) => {
                      if (item.value == null) return null;
                      const IconComp = item.icon;
                      return (
                        <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                          <span className="flex items-center gap-2 text-gray-400 text-xs"><IconComp className="w-3.5 h-3.5" />{item.label}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.value ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                            {item.value ? "Yes" : "No"}
                          </span>
                        </div>
                      );
                    })}
                    {anomalyData.metadata_analysis.software_used && (
                      <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                        <span className="text-gray-400 text-xs flex items-center gap-2"><Pencil className="w-3.5 h-3.5" />Software Used</span>
                        <span className="text-orange-400 text-xs font-medium">{anomalyData.metadata_analysis.software_used}</span>
                      </div>
                    )}
                    {anomalyData.metadata_analysis.gps_consistent != null && (
                      <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                        <span className="text-gray-400 text-xs flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />GPS Consistent</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${anomalyData.metadata_analysis.gps_consistent ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {anomalyData.metadata_analysis.gps_consistent ? "Yes" : "No"}
                        </span>
                      </div>
                    )}
                    {anomalyData.metadata_analysis.camera_authentic != null && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-gray-400 text-xs flex items-center gap-2"><Camera className="w-3.5 h-3.5" />Camera Authentic</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${anomalyData.metadata_analysis.camera_authentic ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {anomalyData.metadata_analysis.camera_authentic ? "Yes" : "No"}
                        </span>
                      </div>
                    )}
                  </div>
                  {anomalyData.metadata_analysis.details && (
                    <div className="p-3 rounded-lg bg-[#0a0a1a] border border-yellow-500/10">
                      <p className="text-gray-300 text-xs leading-relaxed">{anomalyData.metadata_analysis.details}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted EXIF Metadata */}
              {metadata && (
                <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10">
                  <button onClick={() => setMetadataExpanded(!metadataExpanded)}
                    className="w-full flex items-center justify-between mb-2">
                    <h3 className="font-orbitron text-sm font-bold text-white flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-400" /> EXIF Metadata
                    </h3>
                    {metadataExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {/* Suspicious flags - always visible */}
                  {metadata?.flags?.suspiciousFlags?.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {metadata.flags.suspiciousFlags.map((flag: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                          <span className="text-red-300 text-xs">{flag}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick status flags - always visible */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${metadata?.flags?.hasGPS ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-500"}`}>
                      {metadata?.flags?.hasGPS ? "GPS" : "No GPS"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${metadata?.flags?.hasEditingSoftware ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"}`}>
                      {metadata?.flags?.hasEditingSoftware ? "Edited" : "No Editor"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${metadata?.flags?.hasTimeMismatch ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                      {metadata?.flags?.hasTimeMismatch ? "Time Mismatch" : "Time OK"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${metadata?.flags?.strippedMetadata ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                      {metadata?.flags?.strippedMetadata ? "Stripped" : "Metadata OK"}
                    </span>
                  </div>

                  <AnimatePresence>
                    {metadataExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-4">
                          {/* Camera Info */}
                          {(metadata?.camera?.make || metadata?.camera?.model) && (
                            <div>
                              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><Camera className="w-3 h-3" /> Camera</p>
                              <div className="space-y-1">
                                {metadata.camera.make && <MetaRow label="Make" value={metadata.camera.make} />}
                                {metadata.camera.model && <MetaRow label="Model" value={metadata.camera.model} />}
                                {metadata.camera.lens && <MetaRow label="Lens" value={metadata.camera.lens} />}
                                {metadata.camera.focalLength && <MetaRow label="Focal Length" value={metadata.camera.focalLength} />}
                                {metadata.camera.aperture && <MetaRow label="Aperture" value={metadata.camera.aperture} />}
                                {metadata.camera.shutterSpeed && <MetaRow label="Shutter Speed" value={metadata.camera.shutterSpeed} />}
                                {metadata.camera.iso && <MetaRow label="ISO" value={String(metadata.camera.iso)} />}
                                {metadata.camera.flash && <MetaRow label="Flash" value={String(metadata.camera.flash)} />}
                                {metadata.camera.whiteBalance && <MetaRow label="White Balance" value={String(metadata.camera.whiteBalance)} />}
                                {metadata.camera.exposureMode && <MetaRow label="Exposure Mode" value={String(metadata.camera.exposureMode)} />}
                                {metadata.camera.meteringMode && <MetaRow label="Metering Mode" value={String(metadata.camera.meteringMode)} />}
                              </div>
                            </div>
                          )}

                          {/* Location */}
                          {metadata?.location?.latitude && (
                            <div>
                              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</p>
                              <div className="space-y-1">
                                <MetaRow label="Latitude" value={String(metadata.location.latitude?.toFixed(6))} />
                                <MetaRow label="Longitude" value={String(metadata.location.longitude?.toFixed(6))} />
                                {metadata.location.altitude && <MetaRow label="Altitude" value={`${metadata.location.altitude}m`} />}
                                {metadata.location.city && <MetaRow label="City" value={metadata.location.city} />}
                                {metadata.location.country && <MetaRow label="Country" value={metadata.location.country} />}
                                {metadata.location.mapUrl && (
                                  <a href={metadata.location.mapUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-cyan-400 text-xs hover:underline mt-1">
                                    <Globe className="w-3 h-3" /> View on Map ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Date/Time */}
                          {(metadata?.datetime?.dateOriginal || metadata?.datetime?.dateModified) && (
                            <div>
                              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date & Time</p>
                              <div className="space-y-1">
                                {metadata.datetime.dateOriginal && <MetaRow label="Original" value={new Date(metadata.datetime.dateOriginal).toLocaleString()} />}
                                {metadata.datetime.dateModified && <MetaRow label="Modified" value={new Date(metadata.datetime.dateModified).toLocaleString()} highlight={metadata.datetime.timeMismatch} />}
                                {metadata.datetime.dateDigitized && <MetaRow label="Digitized" value={new Date(metadata.datetime.dateDigitized).toLocaleString()} />}
                                {metadata.datetime.timezone && <MetaRow label="Timezone" value={metadata.datetime.timezone} />}
                                {metadata.datetime.timeMismatch && (
                                  <div className="p-2 rounded bg-red-500/10 border border-red-500/20 mt-1">
                                    <p className="text-red-400 text-[10px] font-bold">TIMESTAMP MISMATCH: Original and modified dates differ significantly — possible editing detected</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Software / Editing */}
                          {(metadata?.software?.editingSoftware || metadata?.software?.creator) && (
                            <div>
                              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><Pencil className="w-3 h-3" /> Software & Authorship</p>
                              <div className="space-y-1">
                                {metadata.software.editingSoftware && <MetaRow label="Software" value={metadata.software.editingSoftware} highlight />}
                                {metadata.software.creator && <MetaRow label="Creator/Artist" value={metadata.software.creator} />}
                                {metadata.software.copyright && <MetaRow label="Copyright" value={metadata.software.copyright} />}
                                {metadata.software.description && <MetaRow label="Description" value={metadata.software.description} />}
                                {metadata.software.profileDescription && <MetaRow label="Color Profile" value={metadata.software.profileDescription} />}
                                {metadata.software.colorSpace && <MetaRow label="Color Space" value={String(metadata.software.colorSpace)} />}
                              </div>
                            </div>
                          )}

                          {/* Image Properties */}
                          {(metadata?.image?.width || metadata?.image?.height) && (
                            <div>
                              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Image Properties</p>
                              <div className="space-y-1">
                                {metadata.image.width && metadata.image.height && <MetaRow label="Dimensions" value={`${metadata.image.width} × ${metadata.image.height}`} />}
                                {metadata.image.bitDepth && <MetaRow label="Bit Depth" value={String(metadata.image.bitDepth)} />}
                                {metadata.image.compression && <MetaRow label="Compression" value={String(metadata.image.compression)} />}
                                {metadata.image.orientation && <MetaRow label="Orientation" value={String(metadata.image.orientation)} />}
                                {metadata.image.xResolution && <MetaRow label="Resolution" value={`${metadata.image.xResolution} × ${metadata.image.yResolution} ${metadata.image.resolutionUnit || ""}`} />}
                              </div>
                            </div>
                          )}

                          {/* Raw metadata toggle */}
                          {metadata?.raw && Object.keys(metadata.raw).length > 0 && (
                            <div>
                              <button onClick={() => setRawMetadataExpanded(!rawMetadataExpanded)}
                                className="flex items-center gap-2 text-gray-500 text-[10px] uppercase tracking-wider hover:text-gray-300 transition-colors">
                                {rawMetadataExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                Raw EXIF Data ({Object.keys(metadata.raw).length} fields)
                              </button>
                              <AnimatePresence>
                                {rawMetadataExpanded && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="mt-2 max-h-60 overflow-y-auto rounded-lg bg-[#0a0a1a] p-3 border border-cyan-500/5">
                                    <div className="space-y-0.5">
                                      {Object.entries(metadata.raw).map(([key, val]: [string, any]) => (
                                        <div key={key} className="flex justify-between gap-2 py-0.5">
                                          <span className="text-gray-500 text-[10px] truncate max-w-[120px]">{key}</span>
                                          <span className="text-gray-300 text-[10px] truncate max-w-[160px] text-right">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!metadataExpanded && (
                    <p className="text-gray-500 text-[10px] text-center mt-1">Click to expand full metadata</p>
                  )}
                </div>
              )}

              {metadataLoading && (
                <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span className="text-gray-400 text-sm">Extracting metadata...</span>
                </div>
              )}

              {/* Upscale info */}
              {photo?.upscaleStatus === "COMPLETED" && photo?.upscaleData && (
                <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10">
                  <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <ZoomIn className="w-4 h-4 text-green-400" /> Upscale Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    {(photo.upscaleData as any)?.scale_factor && (
                      <div className="flex justify-between"><span className="text-gray-400">Scale Factor</span><span className="text-white">{(photo.upscaleData as any).scale_factor}x</span></div>
                    )}
                    {(photo.upscaleData as any)?.method && (
                      <div className="flex justify-between"><span className="text-gray-400">Method</span><span className="text-white capitalize">{(photo.upscaleData as any).method?.replace?.(/_/g, " ") ?? ""}</span></div>
                    )}
                    {(photo.upscaleData as any)?.quality && (
                      <div className="flex justify-between"><span className="text-gray-400">Quality</span><span className="text-green-400 capitalize">{(photo.upscaleData as any).quality}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Processing status indicators */}
              <div className="p-5 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10">
                <h3 className="font-orbitron text-sm font-bold text-white mb-3">Status</h3>
                <div className="space-y-2">
                  {[
                    { label: "Anomaly Detection", status: photo?.anomalyStatus ?? "PENDING" },
                    { label: "Upscaling", status: photo?.upscaleStatus ?? "PENDING" },
                  ].map((item: any) => {
                    const color = item?.status === "COMPLETED" ? "text-green-400" : item?.status === "PROCESSING" ? "text-yellow-400" : item?.status === "FAILED" ? "text-red-400" : "text-gray-500";
                    const icon = item?.status === "COMPLETED" ? CheckCircle2 : item?.status === "PROCESSING" ? RefreshCw : item?.status === "FAILED" ? AlertCircle : Clock;
                    const IconComp = icon;
                    return (
                      <div key={item?.label} className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">{item?.label}</span>
                        <span className={`flex items-center gap-1 text-sm ${color}`}>
                          <IconComp className={`w-4 h-4 ${item?.status === "PROCESSING" ? "animate-spin" : ""}`} />
                          {item?.status ?? "PENDING"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
