import type { Metadata } from 'next';
import { loadPage } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const page = await loadPage('privacy', locale);
  return pageMetadata({ locale, path: '/privacy', title: page.title, description: page.description });
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const page = await loadPage('privacy', locale);

  return (
    <div className="container page-content">
      <header className="page-header">
        <h1>{page.title}</h1>
      </header>
      <div className="ornament" />
      <article className="page-prose" dangerouslySetInnerHTML={{ __html: page.html }} />
    </div>
  );
}
