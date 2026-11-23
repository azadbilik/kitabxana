'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { accountFetch } from '@/lib/account';
import { localePath } from '@/lib/i18n';
import { BRANCHES, type BranchKey } from '@/lib/canon';
import { useLoadMarks } from '@/lib/library';
import { Threads, threadIds, type TreeThread } from './Threads';

export type Leaf =
  | { kind: 'author'; id: string; slug: string; name: string; years: string; works: number; gap?: string; sort: number }
  | { kind: 'missing'; name: string; years: string; note?: string; sort: number };

export interface TreeEra {
  key: string;
  when: string;
  title: string;
  gist: string;
  /** A parallel line (emigration, the south): in the tree, not in the strip of eras */
  side: boolean;
  branches: { key: BranchKey; leaves: Leaf[] }[];
}

type Progress = Record<string, { done: number; reading: number }>;
type Filter = 'all' | 'read' | 'unread' | 'missing';

/** Long branches (the «El şairləri» village poets) open folded */
const FOLD_AT = 24;

function Ring({ part }: { part: number }) {
  // r = 7 → circumference 43.98
  const c = 43.98;
  return (
    <svg className="leaf-ring" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7" className="leaf-ring-track" />
      {part > 0 && (
        <circle cx="9" cy="9" r="7" className="leaf-ring-fill"
          strokeDasharray={`${Math.max(part * c, 2.5)} ${c}`} transform="rotate(-90 9 9)" />
      )}
      {part >= 1 && <path d="M5.6 9.2l2.2 2.2 4.6-4.8" className="leaf-ring-check" />}
    </svg>
  );
}

/**
 * Where "suggest a source" on a missing leaf leads: the contribute form, blank, on the fitting tab.
 * An author the site has, or a «Title» on its own, wants a work; any other missing name an author.
 */
function offerHref(locale: string, l: Leaf) {
  const work = l.kind === 'author' || /^«.+»$/.test(l.name);
  return `${localePath(locale, '/contribute')}?type=${work ? 'work' : 'author'}`;
}

/** Shown on hover or keyboard focus of a missing leaf (always, small, on touch screens) */
function Offer({ href, name }: { href: string; name: string }) {
  const t = useTranslations('tree');
  return (
    <Link prefetch={false} href={href} className="leaf-offer" aria-label={t('offer_for', { name })}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" /></svg>
      <span>{t('suggest_btn')}</span>
    </Link>
  );
}

export function LiteratureTree({ eras, threads }: { eras: TreeEra[]; threads: TreeThread[] }) {
  const t = useTranslations('tree');
  const ta = useTranslations('authors');
  const locale = useLocale();
  const lang = (locale === 'ru' || locale === 'en' ? locale : 'az') as 'az' | 'ru' | 'en';
  const { status, requireSignIn } = useAccount();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // The first thread opens by default; #thread-<key> opens another
  const [thread, setThread] = useState<string | null>(threads[0]?.key ?? null);
  useLoadMarks(status === 'signed-in', useMemo(() => threadIds(threads), [threads]));

  useEffect(() => {
    const fromHash = () => {
      const m = window.location.hash.match(/^#thread-(.+)$/);
      if (m && threads.some((th) => th.key === m[1])) setThread(m[1]);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [threads]);

  const pickThread = (key: string | null) => {
    setThread(key);
    history.replaceState(null, '', key ? `#thread-${key}` : window.location.pathname + window.location.search);
  };
  const onThread = useMemo(
    () => new Set(threads.find((th) => th.key === thread)?.stops.map((s) => s.authorSlug) ?? []),
    [threads, thread],
  );

  useEffect(() => {
    if (status !== 'signed-in') {
      setProgress(null);
      return;
    }
    let live = true;
    accountFetch<Progress>('/me/map').then((p) => live && setProgress(p)).catch(() => {});
    return () => {
      live = false;
    };
  }, [status]);

  const me = progress != null;
  // Grouped by hand: Node's and the browser's ICU disagree on az/ru separators, which breaks hydration
  const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : '\u00a0');

  // Totals for the summary and each era's ring
  const stats = useMemo(() => {
    const per: Record<string, { works: number; read: number; authors: number; started: number; missing: number }> = {};
    const all = { works: 0, read: 0, authors: 0, started: 0, missing: 0 };
    for (const e of eras) {
      const s = { works: 0, read: 0, authors: 0, started: 0, missing: 0 };
      for (const b of e.branches) for (const l of b.leaves) {
        if (l.kind === 'missing') { s.missing++; continue; }
        s.works += l.works;
        s.authors++;
        const p = progress?.[l.id];
        if (p) {
          s.read += Math.min(p.done, l.works);
          if (p.done + p.reading > 0) s.started++;
        }
      }
      per[e.key] = s;
      (Object.keys(all) as (keyof typeof all)[]).forEach((k) => (all[k] += s[k]));
    }
    return { per, all };
  }, [eras, progress]);

  const visible = (l: Leaf) => {
    if (filter === 'all') return true;
    if (filter === 'missing') return l.kind === 'missing' || !!l.gap || !l.works;
    if (l.kind === 'missing') return false;
    const p = progress?.[l.id];
    const touched = !!p && p.done + p.reading > 0;
    return filter === 'read' ? touched : !touched;
  };

  const filters: Filter[] = me ? ['all', 'read', 'unread', 'missing'] : ['all', 'missing'];
  const share = (n: number, d: number) => (d ? n / d : 0);

  return (
    <>
      <header className="tree-hero">
        <div className="tree-hero-text">
          <p className="tree-eyebrow">{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p className="tree-lead">{t('lead')}</p>
        </div>

        <aside className="tree-me" aria-live="polite">
          {me ? (
            <>
              <div className="tree-me-figure">
                <Ring part={share(stats.all.read, stats.all.works)} />
                <div>
                  <b>{fmt(stats.all.read)}</b>
                  <span>{t('works_read', { total: fmt(stats.all.works) })}</span>
                </div>
              </div>
              <p className="tree-me-line">
                {t('authors_started', { n: fmt(stats.all.started), total: fmt(stats.all.authors) })}
              </p>
            </>
          ) : (
            <>
              <p className="tree-me-title">{t('guest_title')}</p>
              <p className="tree-me-line">{t('guest_text')}</p>
              {status === 'guest' && (
                <button type="button" className="btn btn-primary btn-lg tree-me-btn" onClick={() => requireSignIn()}>
                  {t('sign_in')}
                </button>
              )}
            </>
          )}
        </aside>
      </header>

      {/* The rings: one band per era, sized by what the site holds, filled by what this reader has read */}
      <nav className="tree-rings" aria-label={t('eras_label')}>
        {eras.filter((e) => !e.side).map((e) => {
          const s = stats.per[e.key];
          const fill = me ? share(s.read, s.works) : share(s.authors, s.authors + s.missing);
          return (
            <a key={e.key} href={`#${e.key}`} className="tree-ring" style={{ flexGrow: Math.max(1, Math.log2(s.works + s.missing * 20 + 2)) }}>
              <span className="tree-ring-bar"><i style={{ transform: `scaleX(${Math.round(fill * 100) / 100})` }} /></span>
              <span className="tree-ring-when">{e.when.replace(' — ', '–')}</span>
            </a>
          );
        })}
      </nav>
      <p className="tree-rings-note">{me ? t('rings_me') : t('rings_guest')}</p>

      {threads.length > 0 && <Threads threads={threads} active={thread} onSelect={pickThread} signedIn={status === 'signed-in'} />}

      <div className="tree-filters" role="group" aria-label={t('filter_label')}>
        {filters.map((f) => (
          <button key={f} type="button" className={filter === f ? 'pill active' : 'pill'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`filter_${f}`)}
          </button>
        ))}
        <span className="tree-legend">
          <span><i className="lg lg-site" />{t('legend_site')}</span>
          <span><i className="lg lg-missing" />{t('legend_missing')}</span>
        </span>
      </div>

      <ol className="tree">
        {eras.map((e) => {
          const s = stats.per[e.key];
          const branches = e.branches
            .map((b) => ({ ...b, shown: b.leaves.filter(visible) }))
            .filter((b) => b.shown.length);
          return (
            <li key={e.key} id={e.key} className="tree-era">
              <div className="tree-era-when">{e.when}</div>
              <div className="tree-era-body">
                <h2>{e.title}</h2>
                <p className="tree-era-gist">{e.gist}</p>
                <p className="tree-era-count">
                  {me
                    ? t('era_me', { read: fmt(s.read), works: fmt(s.works) })
                    : t('era_site', { authors: fmt(s.authors), works: fmt(s.works) })}
                  {s.missing > 0 && <> · <span className="tree-era-missing">{t('era_missing', { n: s.missing })}</span></>}
                </p>
                {branches.length === 0 && <p className="tree-empty">{t('empty')}</p>}
                {branches.map((b) => {
                  const id = `${e.key}:${b.key}`;
                  const folded = b.shown.length > FOLD_AT && !open[id];
                  const leaves = folded ? b.shown.slice(0, FOLD_AT) : b.shown;
                  return (
                    <section key={b.key} className="tree-branch">
                      <h3>{BRANCHES[b.key][lang]}</h3>
                      <ul className="tree-leaves">
                        {leaves.map((l) => l.kind === 'author' ? (
                          <li key={l.id} className={`leaf${l.gap ? ' leaf--gap' : ''}${l.works ? '' : ' leaf--empty'}${onThread.has(l.slug) ? ' leaf--thread' : ''}`}>
                            <Link prefetch={false} href={localePath(locale, `/authors/${l.slug}`)} className="leaf-link">
                              {l.works ? <Ring part={share(Math.min(progress?.[l.id]?.done ?? 0, l.works), l.works)} /> : <span className="leaf-ghost" aria-hidden="true" />}
                              <span className="leaf-name">{l.name}</span>
                              {onThread.has(l.slug) && <span className="sr-only">{t('leaf_on_thread')}</span>}
                              {l.years && <span className="leaf-years">{l.years}</span>}
                              <span className="leaf-count">
                                {!l.works ? t('no_texts') : me && progress?.[l.id]?.done ? `${fmt(Math.min(progress[l.id].done, l.works))}/${fmt(l.works)}` : (
                                  // Seen as a number, heard with its unit («111 əsər»)
                                  <>
                                    <span aria-hidden="true">{fmt(l.works)}</span>
                                    <span className="sr-only">{ta('works_count', { count: l.works })}</span>
                                  </>
                                )}
                              </span>
                            </Link>
                            {l.gap && <p className="leaf-gap"><span>{t('gap_label')}</span> {l.gap}</p>}
                            {(l.gap || !l.works) && <Offer href={offerHref(locale, l)} name={l.name} />}
                          </li>
                        ) : (
                          <li key={l.name} className="leaf leaf--missing">
                            <span className="leaf-link">
                              <span className="leaf-ghost" aria-hidden="true" />
                              <span className="leaf-name">{l.name}</span>
                              {l.years && <span className="leaf-years">{l.years}</span>}
                            </span>
                            {l.note && <p className="leaf-gap">{l.note}</p>}
                            <span className="sr-only">{t('legend_missing')}</span>
                            <Offer href={offerHref(locale, l)} name={l.name} />
                          </li>
                        ))}
                      </ul>
                      {b.shown.length > FOLD_AT && (
                        <button type="button" className="tree-more" aria-expanded={!folded} onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
                          {folded ? t('more', { n: b.shown.length - FOLD_AT }) : t('less')}
                        </button>
                      )}
                    </section>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <section className="tree-suggest">
        <h2>{t('suggest_title')}</h2>
        <p>{t('suggest_text')}</p>
        <Link prefetch={false} href={localePath(locale, '/contribute')} className="btn btn-primary btn-lg">{t('suggest_btn')}</Link>
      </section>
    </>
  );
}
