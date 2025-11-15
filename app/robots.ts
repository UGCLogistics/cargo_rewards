import type { MetadataRoute } from 'next'

/**
 * robots.ts exports a function returning a `MetadataRoute.Robots` object. This
 * tells search engine crawlers which routes are allowed and points them
 * to the sitemap.xml. By using a route handler rather than a static
 * file, Next.js caches this output and ensures it is available at
 * https://your-domain.com/robots.txt. The rules here allow all
 * crawlers and reference the generated sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://ugc-logistics-rewards.com/sitemap.xml',
  }
}