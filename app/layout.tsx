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
      {/* body full screen, frame nggak goyang, yang scroll cuma area tengah */}
      <body className="bg-slate-950 text-slate-50 h-screen overflow-hidden">
        <AuthProvider>
          <div className="flex h-full flex-col">
            {/* HEADER GLOBAL (logo CARGO Rewards) */}
            <RewardsHeader />

            {/* Area konten, nanti tiap page yang atur scroll-nya */}
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
