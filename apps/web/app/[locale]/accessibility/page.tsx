import type { Metadata } from 'next';
import { AccessibilitySettings } from '@/components/a11y/AccessibilitySettings';
import { loadPage } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const page = await loadPage('accessibility', locale);
  return pageMetadata({ locale, path: '/accessibility', title: page.title, description: page.description });
}

/** The reader's accessibility settings, then the statement: what works, what doesn't yet */
export default async function AccessibilityPage({ params }: Props) {
  const { locale } = await params;
  const page = await loadPage('accessibility', locale);

  return (
    <div className="container page-content">
      <header className="page-header">
        <h1>{page.title}</h1>
      </header>
      <div className="ornament" />
      <AccessibilitySettings />
      <article className="page-prose" dangerouslySetInnerHTML={{ __html: page.html }} />
    </div>
  );
}
