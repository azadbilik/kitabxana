/**
 * Portraits live on Wikimedia Commons, which renders thumbnails itself at a set of standard
 * widths (120, 250, 330, 500…) and rate-limits servers that fetch many at once — so they
 * load straight from Commons at the width needed, not through the Next.js image resizer.
 */
const COMMONS = /^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//;

export function portraitSrc(url: string, width: 120 | 330): string {
  if (!COMMONS.test(url)) return url;
  if (/\/\d+px-[^/]+$/.test(url)) return url.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`);
  // An original (…/commons/a/ab/Name.jpg): its thumbnail is …/commons/thumb/a/ab/Name.jpg/<w>px-Name.jpg
  const m = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f]\/[0-9a-f]{2})\/([^/]+\.(?:jpe?g|png|gif|webp))$/i);
  return m ? `${m[1]}/thumb/${m[2]}/${m[3]}/${width}px-${m[3]}` : url;
}

interface Props {
  url: string;
  alt: string;
  /** lg: the author page's 9rem portrait. sm: the 3.5rem one on an authors-list card */
  size: 'lg' | 'sm';
}

export function AuthorPortrait({ url, alt, size }: Props) {
  const px = size === 'lg' ? 144 : 56;
  return (
    <img
      className={`author-portrait-img author-portrait-img--${size}`}
      src={portraitSrc(url, size === 'lg' ? 330 : 120)}
      alt={alt}
      width={px}
      height={px}
      loading={size === 'lg' ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
