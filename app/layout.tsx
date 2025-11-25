import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "../context/AuthContext";
import RewardsHeader from "@/components/RewardsHeader";

export const metadata: Metadata = {
  title: "CARGO Rewards",
  description: "Portal loyalti untuk pelanggan C.A.R.G.O",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      {/* app-shell = base navy, shape abstract diatur via globals.css */}
      <body className="app-shell h-screen overflow-hidden antialiased">
        {/* LAYER SHAPE ABSTRACT ORANGE–RED (3–5 element) */}
        <div className="bg-orb-layer">
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          <div className="bg-orb bg-orb-4" />
          <div className="bg-orb bg-orb-5" />
        </div>

        {/* KONTEN PORTAL – di atas shape */}
        <AuthProvider>
          <div className="relative z-10 flex h-full flex-col">
            <RewardsHeader />
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}