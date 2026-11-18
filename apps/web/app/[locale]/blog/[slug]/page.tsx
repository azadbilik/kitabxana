import type { Metadata } from 'next';
import Link from 'next/link';
import { marked } from 'marked';
import { getTranslations } from 'next-intl/server';
import { api, notFoundOn404 } from '@/lib/api';
import { localized } from '@/lib/locale';
import { excerpt, pageMetadata } from '@/lib/seo';
import { localePath } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

const DATE_LOCALE: Record<string, string> = { az: 'az-AZ', ru: 'ru-RU', en: 'en-GB' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = (await api.getBlogPost(slug).catch(notFoundOn404)) as any;

  return pageMetadata({
    locale,
    path: `/blog/${slug}`,
    title: localized(post, 'title', locale) ?? post.titleAz,
    description: post.excerpt ?? excerpt(localized(post, 'body', locale)),
    type: 'article',
    ...(post.coverUrl && { images: [post.coverUrl] }),
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const post = (await api.getBlogPost(slug).catch(notFoundOn404)) as any;
  const t = await getTranslations({ locale, namespace: 'blog' });

  const title = localized(post, 'title', locale) ?? post.titleAz;
  // Posts are written by the site's editors, in Markdown
  const html = await marked.parse(localized(post, 'body', locale) ?? '');
  const by = post.author?.name || post.author?.username;

  return (
    <div className="container page-content">
      <nav className="breadcrumb" aria-label={t('breadcrumb')}>
        <Link prefetch={false} href={localePath(locale, '/blog')}>{t('title')}</Link>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span className="breadcrumb-current" aria-current="page">{title}</span>
      </nav>

      <article className="blog-post">
        <header className="page-header">
          <h1 className="work-heading">{title}</h1>
          <p className="meta-strip">
            {post.publishedAt && (
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString(DATE_LOCALE[locale], { dateStyle: 'long' })}
              </time>
            )}
            {post.publishedAt && by && <span className="dot" aria-hidden="true" />}
            {by && <span>{by}</span>}
          </p>
        </header>
        <div className="page-prose" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  );
}
