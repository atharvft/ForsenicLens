"use client";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #00f0ff33" },
        }}
      />
    </SessionProvider>
  );
}
