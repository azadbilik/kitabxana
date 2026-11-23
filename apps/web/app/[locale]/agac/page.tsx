import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { api } from '@/lib/api';
import { BRANCH_ORDER, ERAS, GAPS, MISSING, floruit, placeAuthor, type TreeAuthor } from '@/lib/canon';
import { THREADS } from '@/lib/threads';
import { LiteratureTree, type TreeEra, type Leaf } from '@/components/tree/LiteratureTree';
import type { TreeThread } from '@/components/tree/Threads';
import '@/styles/tree.css';

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tree' });
  return pageMetadata({ locale, path: '/agac', title: t('title'), description: t('lead') });
}

const lang = (locale: string) => (locale === 'ru' || locale === 'en' ? locale : 'az');

function lifeYears(a: TreeAuthor, l: 'az' | 'ru' | 'en') {
  const b = a.bornYear ? `${a.bornYearApprox ? '~' : ''}${a.bornYear}` : '';
  const d = a.diedYear ? `${a.diedYearApprox ? '~' : ''}${a.diedYear}` : '';
  if (b && d) return `${b}–${d}`;
  if (b) return `${{ az: 'd.', ru: 'род.', en: 'b.' }[l]} ${b}`;
  if (d) return `${{ az: 'ö.', ru: 'ум.', en: 'd.' }[l]} ${d}`;
  return '';
}

const ROMAN_N: Record<string, number> = { XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20 };

/** A thread stop's date: its year, or roughly («XIV əsr», «~1920») where `when` says so */
function whenLabel(s: { year: number; when?: string }, l: 'az' | 'ru' | 'en') {
  if (!s.when) return String(s.year);
  const n = ROMAN_N[s.when];
  if (n) return l === 'az' ? `${s.when} əsr` : l === 'ru' ? `${s.when} в.` : `${n}th c.`;
  return `~${s.when}`;
}

/** First four-digit year in "1098–1159", "d. 1938", "XIV əsr" → sort key */
function sortYear(years: string | undefined): number {
  const y = years?.match(/\d{3,4}/);
  if (y) return Number(y[0]);
  const c = years?.match(/^([IVXL]+)/);
  return c ? ({ V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20 }[c[1]] ?? 0) * 100 - 50 : 9999;
}

/**
 * The literature tree. The HTML is the same for everyone (edge-cached); a signed-in reader's
 * read marks colour the leaves in the browser.
 */
export default async function TreePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = lang(locale);
  const t = await getTranslations({ locale, namespace: 'tree' });
  const authors = await api.getAuthorTree();
  const stops = THREADS.flatMap((th) => th.stops);
  const brief = await api.getBrief(
    stops.flatMap((s) => (s.work ? [s.work] : [])),
    stops.flatMap((s) => (s.book ? [s.book] : [])),
  ).catch(() => ({ works: [], books: [] }));

  const buckets = new Map<string, Map<string, Leaf[]>>();
  const put = (era: string, branch: string, leaf: Leaf) => {
    if (!buckets.has(era)) buckets.set(era, new Map());
    const b = buckets.get(era)!;
    if (!b.has(branch)) b.set(branch, []);
    b.get(branch)!.push(leaf);
  };

  for (const a of authors) {
    const { era, branch } = placeAuthor(a);
    const name = (l === 'ru' && a.nameRu) || (l === 'en' && a.nameEn) || a.nameAz;
    put(era, branch, {
      kind: 'author', id: a.id, slug: a.slug, name, years: lifeYears(a, l), works: a.works,
      gap: GAPS[a.slug], sort: floruit(a) ?? 9999,
    });
  }
  for (const m of MISSING) {
    put(m.era, m.branch, { kind: 'missing', name: m.name, years: m.years ?? '', note: m.note, sort: sortYear(m.years) + 35 });
  }

  const eras: TreeEra[] = ERAS.filter((e) => buckets.has(e.key)).map((e) => {
    const b = buckets.get(e.key)!;
    return {
      key: e.key, when: e.when, title: e.title[l], gist: e.gist[l], side: e.until == null && e.key !== 'independence',
      branches: BRANCH_ORDER.filter((k) => b.has(k)).map((k) => ({
        key: k,
        leaves: b.get(k)!.sort((x, y) => x.sort - y.sort || x.name.localeCompare(y.name, 'az')),
      })),
    };
  });

  // A thread keeps the stops the site publishes, and is shown with three or more
  const works = new Map(brief.works.map((w) => [w.slug, w]));
  const books = new Map(brief.books.map((b) => [b.slug, b]));
  const threads: TreeThread[] = THREADS.map((th) => ({
    key: th.key,
    title: th.title[l],
    gist: th.gist[l],
    stops: th.stops.flatMap((s) => {
      const item = s.work ? works.get(s.work) : s.book ? books.get(s.book) : undefined;
      if (!item) return [];
      const a = item.author;
      return [{
        id: item.id,
        kind: s.work ? ('work' as const) : ('book' as const),
        href: s.work ? `/works/${item.slug}` : `/collections/${item.slug}`,
        title: (l === 'ru' && item.titleRu) || (l === 'en' && item.titleEn) || item.titleAz,
        author: a ? (l === 'ru' && a.nameRu) || (l === 'en' && a.nameEn) || a.nameAz : '',
        authorSlug: a?.slug ?? '',
        year: s.year,
        when: whenLabel(s, l),
        note: s.note?.[l],
      }];
    }),
  })).filter((th) => th.stops.length >= 3);

  return (
    <div className="container page-content tree-page">
      <LiteratureTree eras={eras} threads={threads} />
      <p className="tree-foot">{t('footnote')}</p>
    </div>
  );
}
