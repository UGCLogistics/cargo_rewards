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
      <body className="h-screen overflow-hidden antialiased">
        <AuthProvider>
          <div className="relative flex h-full flex-col">
            {/* Glow abstrak global di background (glassmorphism base) */}
            <div className="pointer-events-none fixed -left-10 top-24 h-64 w-64 rounded-3xl bg-gradient-to-tr from-orange-500 via-orange-400 to-pink-500 blur-3xl opacity-80 -z-10" />
            <div className="pointer-events-none fixed right-[-80px] bottom-[-40px] h-80 w-80 rounded-full bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 blur-3xl opacity-60 -z-10" />

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
