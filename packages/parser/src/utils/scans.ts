import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** The site's scans folder (see the API's ScansService); SCANS_DIR overrides */
const SCANS_DIR = process.env.SCANS_DIR || path.join(os.homedir(), 'kitabxana-scans');

/**
 * Keep a National Library book PDF in the site's scans folder as `anl-<bibid>.pdf`, so the
 * book's works offer it to readers once imported. Copies only reader downloads
 * (`page.php?bibid=N&download=1`), only when the folder exists, and never overwrites.
 */
export function keepScan(url: string, file: string) {
  const bibid = url.includes('download=1') && /web2\.anl\.az/.test(url) ? url.match(/[?&]bibid=(\d+)/)?.[1] : undefined;
  if (!bibid || !fs.existsSync(SCANS_DIR)) return;
  const target = path.join(SCANS_DIR, `anl-${bibid}.pdf`);
  if (fs.existsSync(target)) return;
  fs.copyFileSync(file, target);
  console.log(`  kept scan ${target}`);
}
