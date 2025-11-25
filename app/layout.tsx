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
      <body className="h-screen overflow-hidden antialiased">
        <AuthProvider>
          {/* GLOBAL ORANGE–RED ABSTRACT BACKGROUND (cover semua page) */}
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            {/* blob besar kiri atas */}
            <div
              className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-[40%] blur-3xl opacity-80"
              style={{
                background:
                  "radial-gradient(circle at 30% 20%, #FFEDD5, #FF9240, #FF4B1F)",
              }}
            />
            {/* blob medium kanan atas */}
            <div
              className="absolute -top-24 right-[-80px] h-[320px] w-[320px] rounded-[45%] blur-2xl opacity-80"
              style={{
                background:
                  "radial-gradient(circle at 10% 0, #FFC48A, #FF8033, #FF3210)",
              }}
            />
            {/* blob kecil agak tajam kiri tengah */}
            <div
              className="absolute top-1/3 -left-10 h-[200px] w-[200px] rounded-full blur-xl opacity-75"
              style={{
                background:
                  "radial-gradient(circle at 50% 0, #FFB27B, #FF6A2D, #FF2A0A)",
              }}
            />
            {/* blob kecil kanan tengah */}
            <div
              className="absolute top-1/3 right-4 h-[160px] w-[160px] rounded-[38%] blur-xl opacity-70"
              style={{
                background:
                  "radial-gradient(circle at 40% 0, #FFD1A3, #FF8A3D, #FF3B0F)",
              }}
            />
            {/* blob besar bawah kiri */}
            <div
              className="absolute bottom-[-160px] -left-52 h-[380px] w-[380px] rounded-[45%] blur-3xl opacity-80"
              style={{
                background:
                  "radial-gradient(circle at 20% 100%, #FFB27B, #FF6A2D, #FF2600)",
              }}
            />
            {/* blob besar bawah tengah */}
            <div
              className="absolute bottom-[-200px] left-1/3 h-[420px] w-[420px] rounded-full blur-3xl opacity-85"
              style={{
                background:
                  "radial-gradient(circle at 50% 100%, #FFC996, #FF7A2F, #FF2600)",
              }}
            />
            {/* blob besar bawah kanan */}
            <div
              className="absolute bottom-[-180px] right-[-120px] h-[360px] w-[360px] rounded-[45%] blur-3xl opacity-80"
              style={{
                background:
                  "radial-gradient(circle at 70% 100%, #FFCF9E, #FF7A33, #FF2A0A)",
              }}
            />
            {/* blob kecil bawah kiri atas */}
            <div
              className="absolute bottom-24 left-10 h-[120px] w-[120px] rounded-full blur-lg opacity-80"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, #FFB885, #FF6F2F, #FF2A0A)",
              }}
            />
            {/* blob kecil atas tengah */}
            <div
              className="absolute top-16 left-1/2 h-[140px] w-[140px] -translate-x-1/2 rounded-full blur-xl opacity-80"
              style={{
                background:
                  "radial-gradient(circle at 50% 0, #FFD8AA, #FF9240, #FF3B0F)",
              }}
            />
          </div>

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
