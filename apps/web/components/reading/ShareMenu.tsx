'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ActionPopover } from './ActionPopover';
import { QrDialog, type QrKind } from './QrDialog';

interface Props {
  /** Canonical URL of the work */
  url: string;
  /** "Title — Author", the text that goes with the link */
  text: string;
  /** For the QR card: the title, and the line under it (a work's or book's author, an author's years) */
  title: string;
  subtitle: string;
  /** What the link opens, for the QR card's wording */
  kind?: QrKind;
  /** "Print": the page itself prints well only for a text */
  print?: boolean;
}

const filled = (path: ReactNode) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    {path}
  </svg>
);
const stroked = (path: ReactNode) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const ICONS = {
  share: stroked(<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />),
  telegram: filled(
    <path d="M21.5 4.3 18.4 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-7.9c.4-.3-.1-.5-.6-.2L6.3 13 1.6 11.5c-1-.3-1-1 .2-1.5L20.2 3c.8-.3 1.6.2 1.3 1.3Z" />,
  ),
  whatsapp: filled(
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.2.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.5-.3Z" />,
  ),
  facebook: filled(
    <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.4 1.5-1.4h1.5V4.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.3H8v3h2.6V21h2.9Z" />,
  ),
  link: stroked(
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />,
  ),
  qr: stroked(
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z" />,
  ),
  print: stroked(
    <path d="M7 9V3h10v6M7 17H4.5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17M7 14h10v7H7z" />,
  ),
};

/**
 * Share, copy the link, a QR code, print: one button under a text, a book or an author. Plain share links only: no SDKs,
 * no tracking. The device's own share sheet is offered first where the browser has one.
 */
export function ShareMenu({ url, text, title, subtitle, kind = 'work', print = true }: Props) {
  const t = useTranslations('share');
  const [canShare, setCanShare] = useState(false);
  const [status, setStatus] = useState('');
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const enc = encodeURIComponent;
  const links = [
    { key: 'telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { key: 'whatsapp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { key: 'facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ] as const;

  const nativeShare = async () => {
    try {
      await navigator.share({ title: text, text, url });
    } catch {
      // Dismissed by the reader; nothing to report
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(t('copied'));
    } catch {
      setStatus(t('copy_failed'));
    }
    setTimeout(() => setStatus(''), 2500);
  };

  return (
    <>
      <ActionPopover label={t('label')} icon={ICONS.share}>
        {canShare && (
          <button type="button" className="action-menu-item" onClick={nativeShare}>
            {ICONS.share}
            <span>{t('native')}</span>
          </button>
        )}
        <button type="button" className="action-menu-item" onClick={copy}>
          {ICONS.link}
          <span>{t('copy')}</span>
        </button>
        {links.map(({ key, href }) => (
          <a key={key} href={href} className="action-menu-item" target="_blank" rel="noopener noreferrer">
            {ICONS[key]}
            <span>{t(key)}</span>
          </a>
        ))}
        <button type="button" className="action-menu-item" onClick={() => setQrOpen(true)}>
          {ICONS.qr}
          <span>{t('qr')}</span>
        </button>
        {print && (
          <button type="button" className="action-menu-item" onClick={() => window.print()}>
            {ICONS.print}
            <span>{t('print')}</span>
          </button>
        )}
        <p className="action-menu-note action-menu-status" role="status">{status}</p>
      </ActionPopover>
      {qrOpen && <QrDialog url={url} title={title} subtitle={subtitle} kind={kind} onClose={() => setQrOpen(false)} />}
    </>
  );
}
