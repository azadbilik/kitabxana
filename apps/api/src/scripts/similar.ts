/**
 * Writes src/works/nearest.json, the "works like this one" index behind the block of other poets'
 * works at the foot of a work page. It comes from the literature galaxy on azadbilik.org
 * (sebeke/qalaktika: every visible work embedded with BAAI/bge-m3, ten nearest works by other
 * authors in the full embedding space), mapped from the galaxy's slugs to Work ids here.
 *
 *   pnpm --dir apps/api similar [--galaxy <dir>] [--dry-run]
 *
 * <dir> is the galaxy's data folder (default ~/WebstormProjects/azadbilik.org/sebeke/qalaktika/data).
 * Rebuild the galaxy first when the library has grown (its scripts/README), then run this,
 * commit nearest.json and rebuild the API. Works the galaxy doesn't know get the old pick.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const dryRun = process.argv.includes('--dry-run');
const dir = arg('--galaxy') ?? path.join(os.homedir(), 'WebstormProjects/azadbilik.org/sebeke/qalaktika/data');
const OUT = path.join(__dirname, '..', 'works', 'nearest.json');
const K = 10;

async function main() {
  const galaxy = JSON.parse(fs.readFileSync(path.join(dir, 'galaxy.json'), 'utf8')) as {
    n: number;
    built?: string;
    works: { s: string[] };
  };
  const slugs = galaxy.works.s;
  const buf = fs.readFileSync(path.join(dir, 'knnx.bin'));
  const knn = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  if (knn.length !== slugs.length * K) throw new Error(`knnx.bin has ${knn.length} entries, expected ${slugs.length * K}`);

  // Galaxy slug → Work id; a renamed work is found through previousSlugs
  const prisma = new PrismaClient();
  const rows = await prisma.work.findMany({ select: { id: true, slug: true, previousSlugs: true } });
  await prisma.$disconnect();
  const bySlug = new Map<string, string>();
  for (const r of rows) for (const s of r.previousSlugs) bySlug.set(s, r.id);
  for (const r of rows) bySlug.set(r.slug, r.id);

  const ids = slugs.map((s) => bySlug.get(s) ?? null);
  const missing = ids.filter((id) => !id).length;
  // Compact: ids once, then each work's neighbours as indexes into ids (unknown ones dropped)
  const nn = ids.map((id, i) =>
    id ? Array.from(knn.subarray(i * K, i * K + K)).filter((j) => ids[j]) : [],
  );
  const out = { built: galaxy.built ?? null, model: 'BAAI/bge-m3', ids, nn };
  console.log(`${slugs.length} galaxy works, ${slugs.length - missing} matched to the database, ${missing} not found`);
  if (dryRun) return;
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
