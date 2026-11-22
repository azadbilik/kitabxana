import { getTranslations } from 'next-intl/server';
import { isPublicDomain, DOWNLOAD_FORMATS, type AuthorLifespan } from '@irs-az/shared';
import { downloadUrl, scanUrl, type Scan } from '@/lib/api';
import { ActionPopover } from './ActionPopover';

interface Props {
  /** API path of the thing to download, e.g. `/works/fuzuli-qezel-7` */
  path: string;
  author: AuthorLifespan;
  locale: string;
  /** What is downloaded, for the group's accessible name */
  kind: 'work' | 'collection' | 'author';
  /** Scanned source books (PDF): offered for every author, unlike EPUB/TXT */
  scans?: Scan[] | null;
}

const ICON = (
  <svg className="download-icon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
  </svg>
);

const BOOK_ICON = (
  <svg className="download-icon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2zM12 6.5v13" />
  </svg>
);

/**
 * EPUB and TXT downloads of the original text, rendered only for public-domain authors
 * (life + 70, see isPublicDomain; the API enforces the same rule), plus the scanned PDF of the
 * printed book the text was transcribed from, when there is one.
 */
export async function DownloadBar({ path, author, locale, kind, scans }: Props) {
  const publicDomain = isPublicDomain(author);
  const books = scans ?? [];
  if (!publicDomain && !books.length) return null;
  const t = await getTranslations({ locale, namespace: 'download' });
  const numbered = books.length > 1;

  return (
    <div className="download-bar" role="group" aria-label={t(kind)}>
      <span className="download-label">{t('label')}</span>
      {publicDomain &&
        DOWNLOAD_FORMATS.map((format) => (
          <a
            key={format}
            className="download-btn"
            href={downloadUrl(path, format)}
            download
            rel="nofollow"
            title={t(format)}
            aria-label={`${t(kind)}: ${t(format)}`}
          >
            {ICON}
            {format.toUpperCase()}
          </a>
        ))}
      {books.map((scan, i) => {
        const n = numbered ? ` ${i + 1}` : '';
        // A work offers only its own pages, never the whole volume it was printed in;
        // a work whose pages aren't known can still be read in the book
        const range = scan.range;
        const offer = range || kind !== 'work';
        const size = t('mb', { n: Math.max(1, Math.round((range?.bytes ?? scan.bytes) / 1e6)) });
        const pages = range ? t('pages', { from: range.from, to: range.to }) : null;
        return [
          offer && (
            <a
              key={`${scan.key}-pdf`}
              className="download-btn"
              href={scanUrl(scan.key, { download: true, range })}
              rel="nofollow"
              title={`${t('pdf')}${pages ? `, ${pages}` : ''} (${size})`}
              aria-label={`${t('pdf')}${n}${pages ? `, ${pages}` : ''}, ${size}`}
            >
              {ICON}
              PDF{n} <span className="download-size">{size}</span>
            </a>
          ),
          <a
            key={`${scan.key}-read`}
            className="download-btn"
            href={scanUrl(scan.key, { page: range?.from ?? scan.page })}
            target="_blank"
            rel="nofollow noopener"
            title={t('read_scan_title')}
          >
            {BOOK_ICON}
            {t('read_scan')}
            {n}
          </a>,
        ];
      })}
      <span className="download-note">
        {[publicDomain && t('note'), books.length > 0 && t('scan_note')].filter(Boolean).join(' · ')}
      </span>
    </div>
  );
}

/**
 * The same downloads as one "Download" button under a text, opening a short list: EPUB and
 * TXT for public-domain authors, the work's pages of the scanned book, and the scan to read.
 */
export async function DownloadMenu({
  path,
  author,
  locale,
  scans,
  originalText = true,
}: Omit<Props, 'kind'> & { /** False for a work kept only in translation: files hold originals only */ originalText?: boolean }) {
  const publicDomain = originalText && isPublicDomain(author);
  const books = scans ?? [];
  if (!publicDomain && !books.length) return null;
  const t = await getTranslations({ locale, namespace: 'download' });
  const numbered = books.length > 1;
  const note = [publicDomain && t('note'), books.length > 0 && t('scan_note')].filter(Boolean).join(' · ');

  return (
    <ActionPopover label={t('label')} icon={ICON}>
      {publicDomain &&
        DOWNLOAD_FORMATS.map((format) => (
          <a key={format} className="action-menu-item" href={downloadUrl(path, format)} download rel="nofollow">
            {ICON}
            <span>{t(format)}</span>
          </a>
        ))}
      {books.map((scan, i) => {
        const n = numbered ? ` ${i + 1}` : '';
        // Only the work's own pages are offered for saving, never the whole volume
        const range = scan.range;
        const size = t('mb', { n: Math.max(1, Math.round((range?.bytes ?? scan.bytes) / 1e6)) });
        return [
          range && (
            <a key={`${scan.key}-pdf`} className="action-menu-item" href={scanUrl(scan.key, { download: true, range })} rel="nofollow">
              {ICON}
              <span>
                {t('pdf')}
                {n}
                <span className="action-menu-sub">
                  {t('pages', { from: range.from, to: range.to })} · {size}
                </span>
              </span>
            </a>
          ),
          <a
            key={`${scan.key}-read`}
            className="action-menu-item"
            href={scanUrl(scan.key, { page: range?.from ?? scan.page })}
            target="_blank"
            rel="nofollow noopener"
            title={t('read_scan_title')}
          >
            {BOOK_ICON}
            <span>
              {t('read_scan')}
              {n}
            </span>
          </a>,
        ];
      })}
      <p className="action-menu-note">{note}</p>
    </ActionPopover>
  );
}
