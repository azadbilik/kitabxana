import { sectionEntries, urlsetXml, xmlResponse } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const entries = name.endsWith('.xml') ? await sectionEntries(name.slice(0, -4)) : null;
  if (!entries) return new Response('Not found', { status: 404 });
  return xmlResponse(urlsetXml(entries));
}
