/**
 * Re-renders every stored bodyHtml (Work, Translation) from its markdown through the
 * sanitising renderer. Run after changing common/utils/markdown.ts:
 *   pnpm --dir apps/api rerender [--dry-run]              # from a checkout (ts-node)
 *   node dist/scripts/rerender.js [--dry-run]            # in the API container
 */
import { PrismaClient } from '@prisma/client';
import { marked } from 'marked';
import { renderMarkdown } from '../common/utils/markdown';

const dryRun = process.argv.includes('--dry-run');
const prisma = new PrismaClient();
const BATCH = 500;

interface Row {
  id: string;
  body: string;
  bodyHtml: string | null;
}

async function pass(
  name: string,
  page: (cursor: string | undefined) => Promise<Row[]>,
  save: (id: string, bodyHtml: string) => Promise<unknown>,
) {
  let total = 0;
  let changed = 0;
  let sanitised = 0;
  const samples: string[] = [];
  for (let cursor: string | undefined; ; ) {
    const rows = await page(cursor);
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    for (const row of rows) {
      total++;
      const html = renderMarkdown(row.body);
      // Rows where the allow-list removed something, as opposed to a stale or missing render
      if (html !== (marked.parse(row.body) as string)) {
        sanitised++;
        if (samples.length < 20) samples.push(row.id);
      }
      if (html === row.bodyHtml) continue;
      changed++;
      if (!dryRun) await save(row.id, html);
    }
  }
  console.log(`${name}: ${total} rows, ${changed} ${dryRun ? 'would change' : 'updated'}, ${sanitised} had markup removed by the sanitiser`);
  if (samples.length) console.log(`  sanitised ids (first ${samples.length}): ${samples.join(', ')}`);
}

async function main() {
  const args = (cursor: string | undefined) => ({
    take: BATCH,
    orderBy: { id: 'asc' as const },
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: { id: true, body: true, bodyHtml: true },
  });
  await pass(
    'Work',
    (c) => prisma.work.findMany(args(c)),
    // updateMany leaves updatedAt alone, so the sitemap and IndexNow see no change
    (id, bodyHtml) => prisma.work.updateMany({ where: { id }, data: { bodyHtml } }),
  );
  await pass(
    'Translation',
    (c) => prisma.translation.findMany(args(c)),
    (id, bodyHtml) => prisma.translation.updateMany({ where: { id }, data: { bodyHtml } }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
