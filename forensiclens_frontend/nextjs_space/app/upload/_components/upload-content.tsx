"use client";
import { useCallback, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { Upload, ImageIcon, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default function UploadContent() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const validateFile = (f: File): string | null => {
    if (!ALLOWED_TYPES.includes(f?.type ?? "")) return "Invalid file type. Please upload JPEG, PNG, WebP, BMP, or TIFF.";
    if ((f?.size ?? 0) > MAX_SIZE) return "File too large. Maximum size is 50MB.";
    return null;
  };

  const handleFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) { toast.error(err); return; }
    setFile(f);
    setUploadError(null);
    setUploaded(false);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e?.target?.result as string ?? null);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e?.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e?.target?.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setUploadError(null);
    try {
      // Step 1: Get presigned URL
      setProgress(10);
      const presignRes = await fetch("/api/photos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }),
      });
      if (!presignRes?.ok) throw new Error("Failed to initiate upload");
      const { uploadUrl, cloud_storage_path, photoId } = await presignRes.json();

      // Step 2: Upload to S3
      setProgress(30);
      const headers: Record<string, string> = { "Content-Type": file.type };
      // Check if Content-Disposition is in signed headers
      if (uploadUrl?.includes?.("content-disposition")) {
        headers["Content-Disposition"] = "attachment";
      }
      const s3Res = await fetch(uploadUrl, { method: "PUT", headers, body: file });
      if (!s3Res?.ok) throw new Error("Failed to upload file");

      setProgress(70);
      // Step 3: Complete upload
      const completeRes = await fetch("/api/photos/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, cloud_storage_path }),
      });
      if (!completeRes?.ok) throw new Error("Failed to complete upload");

      setProgress(100);
      setUploaded(true);
      toast.success("Photo uploaded successfully!");

      // Navigate to photo detail
      setTimeout(() => router.push(`/photo/${photoId}`), 1000);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err?.message ?? "Upload failed");
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setUploaded(false);
    setUploadError(null);
    setProgress(0);
  };

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] grid-bg">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-[800px] mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-orbitron text-3xl font-bold text-white mb-2">Upload Photo</h1>
            <p className="text-gray-400 mb-8">Upload an image for forensic analysis. Supported formats: JPEG, PNG, WebP, BMP, TIFF.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer
                  ${dragActive ? "border-cyan-400 bg-cyan-500/10" : "border-cyan-500/20 bg-[#0f0f2a]/60 hover:border-cyan-500/40 hover:bg-[#0f0f2a]/80"}`}
              >
                <input type="file" accept={ALLOWED_TYPES.join(",")} onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className={`w-16 h-16 mx-auto mb-4 ${dragActive ? "text-cyan-400" : "text-gray-500"}`} />
                <p className="text-white font-semibold text-lg mb-2">Drag & drop your photo here</p>
                <p className="text-gray-400 text-sm mb-4">or click to browse files</p>
                <p className="text-gray-500 text-xs">Max 50MB • JPEG, PNG, WebP, BMP, TIFF</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#0f0f2a]/80 border border-cyan-500/10 p-6">
                {/* Preview */}
                <div className="relative aspect-video rounded-xl bg-[#0a0a1a] overflow-hidden mb-4">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-16 h-16 text-gray-600" /></div>
                  )}
                  {!uploading && !uploaded && (
                    <button onClick={clearFile} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/60 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* File info */}
                <div className="flex items-center gap-3 mb-4">
                  <ImageIcon className="w-5 h-5 text-cyan-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{file?.name ?? "Unknown"}</p>
                    <p className="text-gray-500 text-xs">{((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  {uploaded && <CheckCircle2 className="w-6 h-6 text-green-400" />}
                  {uploadError && <AlertCircle className="w-6 h-6 text-red-400" />}
                </div>

                {/* Progress */}
                {(uploading || uploaded) && (
                  <div className="mb-4">
                    <div className="h-2 rounded-full bg-[#0a0a1a] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full rounded-full ${uploaded ? "bg-green-500" : "bg-gradient-to-r from-cyan-500 to-blue-600"}`}
                      />
                    </div>
                    <p className="text-gray-400 text-xs mt-1">{uploaded ? "Upload complete!" : `Uploading... ${progress}%`}</p>
                  </div>
                )}

                {uploadError && <p className="text-red-400 text-sm mb-4">{uploadError}</p>}

                {/* Actions */}
                <div className="flex gap-3">
                  {!uploaded && (
                    <button onClick={handleUpload} disabled={uploading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 neon-glow">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Upload className="w-5 h-5" />Upload & Analyze</>}
                    </button>
                  )}
                  {!uploading && (
                    <button onClick={clearFile}
                      className="px-6 py-3 rounded-lg border border-cyan-500/30 text-gray-300 hover:bg-cyan-500/10 transition-all">
                      {uploaded ? "Upload Another" : "Clear"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
