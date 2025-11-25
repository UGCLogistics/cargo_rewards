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
          {/* GLOBAL ORANGE–RED ABSTRACT BACKGROUND (semua page) */}
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            {/* besar, blur berat kiri atas */}
            <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-[#ffb347] via-[#ff7a1a] to-[#ff4600] blur-3xl opacity-75" />
            {/* medium, blur sedang kanan atas */}
            <div className="absolute -top-20 right-0 h-72 w-72 rounded-[40%] bg-gradient-to-br from-[#ff7a1a] via-[#ff5c1a] to-[#ff2600] blur-2xl opacity-70" />
            {/* kecil, lebih tajam di tengah */}
            <div className="absolute top-1/3 left-16 h-32 w-32 rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#ff3b00] blur-md opacity-75" />
            {/* besar, blur bawah kiri */}
            <div className="absolute bottom-[-120px] -left-40 h-[340px] w-[340px] rounded-[45%] bg-gradient-to-tr from-[#ff9a3b] via-[#ff6b1a] to-[#ff2600] blur-3xl opacity-70" />
            {/* besar, blur bawah tengah */}
            <div className="absolute bottom-[-180px] left-1/3 h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-[#ff7a1a] via-[#ff4600] to-[#ff1600] blur-3xl opacity-80" />
            {/* kecil, soft kanan bawah */}
            <div className="absolute bottom-10 right-6 h-40 w-40 rounded-[45%] bg-gradient-to-br from-[#ffb347] via-[#ff7a1a] to-[#ff4600] blur-xl opacity-65" />
          </div>


            {/* Area konten, nanti tiap page yang atur scroll-nya */}
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
