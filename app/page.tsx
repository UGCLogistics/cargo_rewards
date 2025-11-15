"use client";

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';

/**
 * The public marketing landing page of the CARGO Rewards portal. It
 * introduces the loyalty program for logistics customers and uses
 * descriptive copy and headings to maximise SEO for non–brand
 * keywords such as "program loyalitas logistik" or "cashback
 * pengiriman". It also provides calls to action for users to
 * register or sign in.
 */
export default function HomePage() {
  const { user } = useAuth();
  return (
    <>
      <SEO
        title="Program Loyalitas Logistik | CARGO Rewards"
        description="CARGO Rewards adalah program loyalitas logistik terdepan di Indonesia. Dapatkan diskon langsung, cashback berkelanjutan dan poin tak terbatas untuk setiap pengiriman."
        keywords={['program loyalitas logistik', 'diskon pengiriman', 'cashback logistik', 'poin pengiriman', 'rewards cargo']}
        url="https://ugc-logistics-rewards.com"
        image="/og-image.png"
      />
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Hero Section */}
        <section style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0' }}>Program Loyalitas Logistik CARGO Rewards</h1>
          <p style={{ fontSize: '1.2rem', marginBottom: '2rem', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
            Dapatkan diskon instan, cashback berkelanjutan dan poin tak terbatas setiap kali Anda mengirim. Tingkatkan efisiensi biaya logistik
            dengan program loyalitas nomor satu di industri ini.
          </p>
          {user ? (
            <Link href="/dashboard" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', backgroundColor: '#ff4600', color: '#fff', borderRadius: '6px' }}>
              Buka Dashboard Anda
            </Link>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <Link href="/register" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', backgroundColor: '#ff4600', color: '#fff', borderRadius: '6px' }}>
                Daftar Sekarang
              </Link>
              <Link href="/login" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', backgroundColor: '#ffffff', color: '#ff4600', border: '1px solid #ff4600', borderRadius: '6px' }}>
                Masuk
              </Link>
            </div>
          )}
        </section>
        {/* Features Section */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Keunggulan Program Kami</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '12px' }}>
              <h3>Diskon Instan</h3>
              <p>Belanja logistik semakin hemat dengan diskon hingga 15% di transaksi pertama Anda.</p>
            </div>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '12px' }}>
              <h3>Cashback Berkelanjutan</h3>
              <p>Nikmati cashback 5–7.5% untuk akumulasi pengiriman per kuartal dan maksimalkan anggaran logistik Anda.</p>
            </div>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '12px' }}>
              <h3>Poin Tak Terbatas</h3>
              <p>Raih 1 poin setiap kelipatan Rp 10.000 dan tukarkan dengan reward menarik tanpa batas limit.</p>
            </div>
          </div>
        </section>
        {/* How It Works */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Cara Kerja CARGO Rewards</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>①</div>
              <h4>Daftar</h4>
              <p>Buat akun bisnis Anda dalam hitungan menit.</p>
            </div>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>②</div>
              <h4>Transaksi</h4>
              <p>Kirim barang melalui jaringan logistik UGC dan catat setiap transaksi.</p>
            </div>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>③</div>
              <h4>Dapatkan Benefit</h4>
              <p>Diskon, cashback dan poin langsung ditambahkan ke akun Anda.</p>
            </div>
          </div>
        </section>
        {/* Call to Action */}
        <section style={{ textAlign: 'center' }}>
          <h2>Ayo Bergabung dengan CARGO Rewards</h2>
          <p style={{ marginBottom: '1rem' }}>Tingkatkan keuntungan bisnis Anda dengan program loyalitas yang dirancang khusus untuk logistik.</p>
          {user ? (
            <Link href="/dashboard" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', backgroundColor: '#ff4600', color: '#fff', borderRadius: '6px' }}>
              Lanjut ke Dashboard
            </Link>
          ) : (
            <Link href="/register" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', backgroundColor: '#ff4600', color: '#fff', borderRadius: '6px' }}>
              Mulai Sekarang
            </Link>
          )}
        </section>
      </main>
    </>
  );
}