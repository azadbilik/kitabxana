import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import { localePath } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

interface PostSummary {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  author: { name: string | null; username: string } | null;
}

interface PostList {
  data: PostSummary[];
  meta: { total: number; page: number; totalPages: number };
}

const DATE_LOCALE: Record<string, string> = { az: 'az-AZ', ru: 'ru-RU', en: 'en-GB' };

function pageOf(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

const loadPosts = (page: number) =>
  api.getBlogPosts(new URLSearchParams(page > 1 ? { page: String(page) } : {})) as Promise<PostList>;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const page = pageOf((await searchParams).page);
  const t = await getTranslations({ locale, namespace: 'blog' });
  const posts = await loadPosts(page).catch(() => null);

  return pageMetadata({
    locale,
    path: '/blog',
    title: t('title'),
    description: t('description'),
    // With nothing written yet, or past the first page, there is nothing here to index
    noindex: !posts?.data.length || page > 1,
  });
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const page = pageOf((await searchParams).page);
  const t = await getTranslations({ locale, namespace: 'blog' });
  const posts = await loadPosts(page);
  const { totalPages } = posts.meta;
  const pageHref = (n: number) => `${localePath(locale, '/blog')}${n > 1 ? `?page=${n}` : ''}`;

  return (
    <div className="container page-content">
      <header className="page-header page-header--start">
        <h1>{t('title')}</h1>
      </header>

      {posts.data.length === 0 ? (
        <div className="shelf-empty">
          <p>{t('empty')}</p>
          <Link prefetch={false} href={localePath(locale, '/collections')} className="btn btn-primary btn-lg">
            {t('to_catalog')}
          </Link>
        </div>
      ) : (
        <ul className="blog-list">
          {posts.data.map((post) => {
            const by = post.author?.name || post.author?.username;
            return (
              <li key={post.id}>
                <Link href={localePath(locale, `/blog/${post.slug}`)} className="blog-card" prefetch={false}>
                  <span className="blog-card-title">{localized(post, 'title', locale)}</span>
                  {post.excerpt && <span className="blog-card-excerpt">{post.excerpt}</span>}
                  <span className="blog-card-meta">
                    {post.publishedAt && (
                      <time dateTime={post.publishedAt}>
                        {new Date(post.publishedAt).toLocaleDateString(DATE_LOCALE[locale], { dateStyle: 'long' })}
                      </time>
                    )}
                    {post.publishedAt && by && <span className="dot" aria-hidden="true" />}
                    {by && <span>{by}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label={t('pages_label')}>
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="pill" rel="prev" prefetch={false}>
              ← {t('newer')}
            </Link>
          )}
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="pill" rel="next" prefetch={false}>
              {t('older')} →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
