import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// SITE_URL is read at runtime; prerendered at build it would point at localhost
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/search', '/*/search'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
