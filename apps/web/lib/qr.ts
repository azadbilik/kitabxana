import qrcode from 'qrcode-generator';

/** Modules of quiet zone around the code, as the QR standard asks */
const QUIET = 4;

export interface Qr {
  /** Modules per side, quiet zone included */
  size: number;
  /** One SVG path drawing every dark module, in module units */
  path: string;
  isDark: (row: number, col: number) => boolean;
  /** Modules per side without the quiet zone */
  count: number;
}

/**
 * A QR code for a link, medium error correction (a little dirt or a fold on a printed
 * card still reads). The link is percent-encoded first, so the code carries ASCII only.
 */
export function makeQr(url: string): Qr {
  const code = qrcode(0, 'M');
  code.addData(new URL(url).href, 'Byte');
  code.make();
  const count = code.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (code.isDark(row, col)) path += `M${col + QUIET},${row + QUIET}h1v1h-1z`;
    }
  }
  return { size: count + QUIET * 2, path, isDark: (r, c) => code.isDark(r, c), count };
}

/** A standalone SVG file: black on white whatever the page's theme */
export function qrSvg(qr: Qr, label: string): string {
  const esc = label.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges" role="img" aria-label="${esc}">` +
    `<rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="${qr.path}"/></svg>`
  );
}

/** The code as a PNG, `px` pixels square, whole pixels per module so the edges stay sharp */
export function qrPng(qr: Qr, px = 1024): Promise<Blob | null> {
  const scale = Math.max(1, Math.floor(px / qr.size));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = qr.size * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let row = 0; row < qr.count; row++) {
    for (let col = 0; col < qr.count; col++) {
      if (qr.isDark(row, col)) ctx.fillRect((col + QUIET) * scale, (row + QUIET) * scale, scale, scale);
    }
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
