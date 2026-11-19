'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { makeQr, qrPng, qrSvg } from '@/lib/qr';
import { isArabicScript } from '@/lib/verse';

export type QrKind = 'work' | 'book' | 'author';

interface Props {
  /** Canonical URL of the page the code opens */
  url: string;
  title: string;
  /** Under the title: a work's or book's author, an author's years */
  subtitle: string;
  kind: QrKind;
  onClose: () => void;
}

const esc = (text: string) => text.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** The work's last path segment, for file names: kitabxana-fuzuli-qezel-7.png */
const fileBase = (url: string) => `kitabxana-${new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'eser'}`;

function save(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/**
 * A QR code for a work, a book or an author, to print and put up where people wait (a metro
 * poster, a library shelf, a classroom wall): a phone's camera opens the page. Shown as a
 * card with the title and the line under it; printed on its own page from a hidden frame, so
 * the page's print styles and everything else on it stay out; or saved as PNG / SVG.
 */
export function QrDialog({ url, title, subtitle, kind, onClose }: Props) {
  const t = useTranslations('share');
  const ref = useRef<HTMLDialogElement>(null);
  const qr = useMemo(() => makeQr(url), [url]);
  const svg = useMemo(() => qrSvg(qr, subtitle ? `${title} — ${subtitle}` : title), [qr, title, subtitle]);
  const shortUrl = url.replace(/^https?:\/\//, '');
  // A Persian ghazal known by its first line is titled in Arabic script
  const rtl = isArabicScript(title);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => opener?.focus?.();
  }, []);

  const print = () => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;inset-inline-start:-9999px';
    frame.srcdoc = `<!doctype html><html lang="${document.documentElement.lang}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page { margin: 15mm; }
html, body { margin: 0; background: #fff; color: #000; }
body { font-family: Georgia, 'Times New Roman', serif; display: flex; justify-content: center; }
.card { width: 95mm; padding: 9mm 8mm 7mm; border: 0.4mm solid #000; border-radius: 3mm; text-align: center; break-inside: avoid; }
h1 { margin: 0; font-size: 17pt; line-height: 1.2; font-weight: 600; }
.author { margin: 2mm 0 6mm; font-size: 12pt; }
svg { display: block; width: 62mm; height: 62mm; margin: 0 auto; }
.scan { margin: 5mm 0 1mm; font: 600 10.5pt system-ui, sans-serif; }
.url { margin: 0; font: 8.5pt system-ui, sans-serif; color: #444; word-break: break-all; }
.site { margin: 4mm 0 0; font: 700 9pt system-ui, sans-serif; letter-spacing: 0.04em; color: #a81e28; }
</style></head><body><div class="card"><h1${rtl ? ' lang="fa" dir="rtl"' : ''}>${esc(title)}</h1><p class="author">${esc(subtitle)}</p>${svg}
<p class="scan">${esc(t('qr_scan'))}</p><p class="url">${esc(shortUrl)}</p><p class="site">Kitabxana.az</p></div></body></html>`;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
    };
    document.body.append(frame);
  };

  const downloadPng = async () => {
    const blob = await qrPng(qr);
    if (blob) save(blob, `${fileBase(url)}.png`);
  };
  const downloadSvg = () => save(new Blob([svg], { type: 'image/svg+xml' }), `${fileBase(url)}.svg`);

  return (
    // The click handler only closes on the backdrop; the keyboard's way out is Escape (onCancel)
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="signin-dialog qr-dialog"
      aria-labelledby="qr-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="signin-dialog-panel">
        <button type="button" className="signin-close" onClick={onClose} aria-label={t('qr_close')}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <h2 id="qr-dialog-title" className="signin-title">{t('qr_title')}</h2>
        <p className="signin-lead qr-lead">{t('qr_lead', { kind })}</p>
        <figure className="qr-card">
          {/* Our own markup from makeQr: no outside text goes into it but the escaped label */}
          <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
          <figcaption>
            <span className="qr-card-title" {...(rtl && { lang: 'fa', dir: 'rtl' as const })}>{title}</span>
            {subtitle && <span className="qr-card-author">{subtitle}</span>}
          </figcaption>
        </figure>
        <div className="qr-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={print}>{t('qr_print')}</button>
          <button type="button" className="btn btn-lg" onClick={downloadPng}>{t('qr_png')}</button>
          <button type="button" className="btn btn-lg" onClick={downloadSvg}>{t('qr_svg')}</button>
        </div>
      </div>
    </dialog>
  );
}
