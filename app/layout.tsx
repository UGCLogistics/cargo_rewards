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
      {/* className app-shell dipakai untuk background blob di globals.css */}
      <body className="app-shell h-screen overflow-hidden antialiased">
        <AuthProvider>
          {/* Semua konten di atas layer background */}
          <div className="relative z-10 flex h-full flex-col">
            <RewardsHeader />
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
