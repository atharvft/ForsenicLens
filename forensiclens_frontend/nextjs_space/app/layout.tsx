import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron", weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: "ForensicLens AI - AI-Powered Forensic Photo Analysis",
  description: "Advanced forensic photo analysis powered by AI. Detect anomalies, upscale images, and perform forensic-grade analysis.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "ForensicLens AI",
    description: "AI-Powered Forensic Photo Analysis",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" />
      </head>
      <body className={`${inter.variable} ${orbitron.variable} font-sans bg-[#0a0a1a] text-gray-100 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
