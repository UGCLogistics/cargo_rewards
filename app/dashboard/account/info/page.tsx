"use client";

import { useEffect, useState } from "react";
import supabase from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../context/AuthContext";

interface Profile {
  id: string;
  name: string;
  companyname: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AccountInfoPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        setProfile(data as any);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Informasi Akun</h1>
      {error && <p className="text-red-500">{error}</p>}
      {loading || !profile ? (
        <p>Memuat data…</p>
      ) : (
        <div className="glass rounded-xl p-4 overflow-auto">
          <table className="min-w-full text-sm">
            <tbody>
              <tr>
                <td className="py-2 pr-4 text-slate-400">ID User</td>
                <td className="py-2">{profile.id}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-400">Nama</td>
                <td className="py-2">{profile.name}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-400">Perusahaan</td>
                <td className="py-2">{profile.companyname}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-400">Peran</td>
                <td className="py-2">{profile.role}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-400">Status</td>
                <td className="py-2">{profile.status}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-400">Dibuat</td>
                <td className="py-2">{formatDate(profile.created_at)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-400">Terakhir update</td>
                <td className="py-2">{formatDate(profile.updated_at)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
