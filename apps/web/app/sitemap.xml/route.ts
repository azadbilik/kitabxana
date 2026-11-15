import { indexXml, sectionNames, xmlResponse } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

/** Sitemap index: the sections live under /sitemaps/<name>.xml */
export async function GET() {
  return xmlResponse(indexXml(await sectionNames()));
}
