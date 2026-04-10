"use client";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { Shield, Scan, ZoomIn, Download, ArrowRight, Eye, Cpu, Lock, Crosshair, Layers, Activity } from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

export default function LandingContent() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    { icon: Scan, title: "Anomaly Detection", desc: "AI-powered detection of image manipulations, splicing, and forgeries with forensic precision." },
    { icon: ZoomIn, title: "Image Upscaling", desc: "Reconstruct and enhance images to forensic-grade quality using advanced neural networks." },
    { icon: Eye, title: "Side-by-Side Compare", desc: "Compare original and processed images with interactive split-view and zoom controls." },
    { icon: Download, title: "Export & Download", desc: "Download processed images in high quality for evidence documentation and reporting." },
    { icon: Activity, title: "Real-Time Processing", desc: "Track processing status in real-time with live updates and progress indicators." },
    { icon: Lock, title: "Secure & Private", desc: "Your forensic data is encrypted and protected with enterprise-grade security measures." },
  ];

  const steps = [
    { num: "01", icon: Layers, title: "Upload", desc: "Drag and drop your photo for forensic analysis" },
    { num: "02", icon: Crosshair, title: "Analyze", desc: "AI detects anomalies and manipulations" },
    { num: "03", icon: Cpu, title: "Enhance", desc: "Neural networks upscale and reconstruct" },
    { num: "04", icon: Download, title: "Export", desc: "Download forensic-grade results" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a1a] grid-bg">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        </div>

        <div className="max-w-[1200px] mx-auto px-4 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-8">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">AI-Powered Forensic Analysis</span>
            </div>
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7, delay: 0.1 }}
            className="font-orbitron text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-6"
          >
            <span className="text-white">Uncover the </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 neon-text">Truth</span>
            <br />
            <span className="text-white">Hidden in Every Pixel</span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7, delay: 0.2 }}
            className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10"
          >
            Advanced forensic photo analysis platform that detects manipulations, enhances evidence, and delivers forensic-grade results in seconds.
          </motion.p>

          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 transition-all neon-glow"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg border border-cyan-500/30 text-cyan-400 font-semibold hover:bg-cyan-500/10 transition-all"
            >
              Sign In
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 relative">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white mb-4">Forensic-Grade <span className="text-cyan-400">Capabilities</span></h2>
            <p className="text-gray-400 max-w-xl mx-auto">Powerful AI tools designed for professional forensic photo analysis and evidence processing.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features?.map?.((f: any, i: number) => (
              <motion.div
                key={f?.title ?? i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-xl bg-[#0f0f2a]/80 border border-cyan-500/10 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5 transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-4 group-hover:from-cyan-500/30 group-hover:to-blue-600/30 transition-all">
                  {f?.icon && <f.icon className="w-6 h-6 text-cyan-400" />}
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{f?.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f?.desc}</p>
              </motion.div>
            )) ?? []}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-[#060612]">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white mb-4">How It <span className="text-cyan-400">Works</span></h2>
            <p className="text-gray-400 max-w-xl mx-auto">From upload to forensic-grade results in four simple steps.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps?.map?.((s: any, i: number) => (
              <motion.div
                key={s?.title ?? i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} transition={{ delay: i * 0.15 }}
                className="relative p-6 rounded-xl bg-[#0f0f2a]/60 border border-cyan-500/10 text-center"
              >
                <span className="font-orbitron text-4xl font-bold text-cyan-500/20">{s?.num}</span>
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto my-4">
                  {s?.icon && <s.icon className="w-6 h-6 text-cyan-400" />}
                </div>
                <h3 className="text-white font-semibold mb-2">{s?.title}</h3>
                <p className="text-gray-400 text-sm">{s?.desc}</p>
              </motion.div>
            )) ?? []}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center p-12 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 neon-border"
          >
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white mb-4">Ready to Investigate?</h2>
            <p className="text-gray-400 max-w-xl mx-auto mb-8">Start analyzing photos with forensic precision powered by cutting-edge AI.</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 transition-all neon-glow"
            >
              Create Free Account <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
