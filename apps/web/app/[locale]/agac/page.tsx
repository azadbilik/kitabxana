import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { api } from '@/lib/api';
import { BRANCH_ORDER, ERAS, GAPS, MISSING, floruit, placeAuthor, type TreeAuthor } from '@/lib/canon';
import { LiteratureTree, type TreeEra, type Leaf } from '@/components/tree/LiteratureTree';
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

  return (
    <div className="container page-content tree-page">
      <LiteratureTree eras={eras} />
      <p className="tree-foot">{t('footnote')}</p>
    </div>
  );
}
