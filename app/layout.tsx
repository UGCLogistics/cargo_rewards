import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "../context/AuthContext";
import RewardsHeader from "@/components/RewardsHeader";

export const metadata: Metadata = {
  title: "CARGO Rewards",
  description: "Portal loyalti untuk pelanggan UGC Logistics",
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
          <div className="flex h-full flex-col">



            {/* Area konten, nanti tiap page yang atur scroll-nya */}
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
