import '@/styles/globals.css';
import '@/styles/nar.css';
import { Metadata, Viewport } from "next";
import { Inter, Literata, Noto_Naskh_Arabic } from 'next/font/google';
import { ReactNode } from "react";
import { getLocale } from 'next-intl/server';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

// Self-hosted at build time: no request to Google from the reader's browser, and the
// two faces every page uses are preloaded. `subsets` only picks what is preloaded: the
// Cyrillic files still ship and load when a page has Cyrillic text (unicode-range)
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--f-inter', display: 'swap' });
const literata = Literata({
  subsets: ['latin', 'latin-ext'],
  style: ['normal'],
  axes: ['opsz'],
  variable: '--f-literata',
  display: 'swap',
});
// The italic is the same family, declared apart so that it is not preloaded: few pages
// open on italic text, and it loads when one does
const literataItalic = Literata({
  subsets: ['latin', 'latin-ext'],
  style: ['italic'],
  axes: ['opsz'],
  variable: '--f-literata-italic',
  display: 'swap',
  preload: false,
});
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic'], variable: '--f-naskh', display: 'swap', preload: false });

// The browser's own chrome (the phone's address bar) takes the page colour of the OS theme
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#121317' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: 'Kitabxana.az — Azərbaycan mədəniyyəti',
    template: '%s | Kitabxana.az',
  },
  description: 'Azərbaycan ədəbiyyatı, fəlsəfəsi və mədəniyyəti',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: '/apple-touch-icon.png',
  },
};


export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${literata.variable} ${literataItalic.variable} ${naskh.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');var d=document.documentElement;d.setAttribute('data-theme',t);if(localStorage.getItem('signedIn')==='1')d.setAttribute('data-signed-in','')}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
