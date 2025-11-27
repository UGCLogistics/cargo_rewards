import Head from 'next/head';

export default function SEO({
  title = "CARGO Rewards - Program Loyalitas Pelanggan UGC Logistics",
  description = "Dapatkan Promo Ongkir menartik untuk Anda dengan program CARGO Rewards dari UGC Logistics. Dapatkan diskon, cashback, dan poin untuk setiap transaksi pengiriman anda.",
  keywords = "logistik, rewards, cargo, loyalitas pelanggan, LTL, cashback, diskon, promo, ongkir murah, promo ongkir, jasa cargo, gratis ongkir",
  url = "https://rewards.utamaglobalindocargo.com",
  image = "https://rewards.utamaglobalindocargo.com/og-image.png"
}) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />

      {/* Canonical */}
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Head>
  );
}
