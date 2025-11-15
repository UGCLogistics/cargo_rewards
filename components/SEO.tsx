"use client";

import Head from 'next/head';

/**
 * SEO component centralizes meta tag management for the CARGO Rewards
 * site. Pass in the appropriate properties to customize meta title,
 * description, keywords and Open Graph data. This component can be
 * included at the top of any page where you need bespoke SEO.
 */
export default function SEO({
  title,
  description,
  keywords = [],
  url,
  image,
}: {
  title: string;
  description: string;
  keywords?: string[];
  url?: string;
  image?: string;
}) {
  const keywordString = keywords.join(', ');
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywordString && <meta name="keywords" content={keywordString} />}
      {/* Open Graph metadata */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}
      <meta property="og:site_name" content="CARGO Rewards" />
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
    </Head>
  );
}