import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "../context/AuthContext";
import RewardsHeader from "@/components/RewardsHeader";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
      {/* app-shell -> base navy, shape diatur di globals.css */}
      <body className="app-shell h-screen overflow-hidden antialiased">
        {/* SHAPE ABSTRACT ORANGE–RED (3D, 3 buah, tanpa blur) */}
        <div className="bg-orb-layer">
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
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
