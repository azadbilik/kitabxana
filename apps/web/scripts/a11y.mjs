// Accessibility check: opens the site's kinds of page in a real browser and runs axe-core
// (WCAG 2.0–2.2, levels A and AA) on each, in both themes, at desktop and phone widths.
// Any violation fails the run.
//
//   pnpm --dir apps/web a11y                      # against http://localhost:3000
//   BASE_URL=https://kitabxana.az pnpm --dir apps/web a11y
//   pnpm --dir apps/web a11y /works /agac         # only these paths
//
// Pages with their own address in the data (an author, a book, a poem, a prose work) are
// found by following the first link of that kind from a list page, so the check runs on
// whatever library the site holds.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VIEWPORTS = { desktop: { width: 1280, height: 800 }, phone: { width: 375, height: 740 } };
const THEMES = ['light', 'dark'];

const STATIC = [
  '/', '/ru', '/en', '/authors', '/collections', '/works', '/tags', '/agac', '/search?q=g%C3%BCl',
  '/giris', '/refim', '/about', '/contribute', '/contact', '/privacy', '/accessibility', '/no-such-page',
];
/** [list page, selector of the link to follow] */
const FOLLOW = [
  ['/authors', 'main a[href^="/authors/"]:not([href*="/authors/sair"]):not([href*="esr-"])'],
  ['/collections', 'main a[href^="/collections/"]'],
  ['/works/forma-qezel', 'main a[href^="/works/"]:not([href*="/works/forma-"]):not([href*="/works/janr-"])'],
  ['/works/janr-nesr', 'main a[href^="/works/"]:not([href*="/works/forma-"]):not([href*="/works/janr-"])'],
];

const only = process.argv.slice(2);
const browser = await chromium.launch();

async function open(path, viewport, theme, extra = {}) {
  const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: 'reduce' });
  await context.addInitScript(
    ([t, more]) => {
      try {
        localStorage.setItem('theme', t);
        for (const [k, v] of Object.entries(more)) localStorage.setItem(k, v);
      } catch {}
    },
    [theme, extra],
  );
  const page = await context.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  return { context, page };
}

let paths = only;
if (!paths.length) {
  paths = [...STATIC];
  for (const [list, selector] of FOLLOW) {
    const { context, page } = await open(list, VIEWPORTS.desktop, 'light');
    const href = await page.locator(selector).first().getAttribute('href').catch(() => null);
    await context.close();
    if (href) paths.push(href);
    else console.warn(`! no link matching ${selector} on ${list}`);
  }
}

/** What to do on a page before the check, beyond loading it */
const STATES = [
  { name: '', run: async () => {} },
  {
    // The reading page with its appearance panel open
    name: 'Aa open',
    when: (page) => page.locator('.appearance-trigger').count(),
    run: async (page) => page.locator('.appearance-trigger').click(),
  },
];

let failures = 0;
let checked = 0;
for (const path of paths) {
  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    for (const theme of THEMES) {
      // High contrast is checked once per theme, at desktop width
      const variants = vpName === 'desktop' ? [{}, { 'a11y': JSON.stringify({ contrast: 'more' }) }] : [{}];
      for (const extra of variants) {
        const { context, page } = await open(path, viewport, theme, extra);
        for (const state of STATES) {
          if (state.when && !(await state.when(page))) continue;
          await state.run(page);
          const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
          checked++;
          const label = [path, vpName, theme, extra.a11y && 'high contrast', state.name].filter(Boolean).join(' · ');
          if (!violations.length) continue;
          failures += violations.length;
          console.log(`\n✗ ${label}`);
          for (const v of violations) {
            console.log(`  ${v.id} (${v.impact}): ${v.help}`);
            for (const node of v.nodes.slice(0, 5)) {
              console.log(`    ${node.target.join(' ')}`);
              const why = (node.any[0] ?? node.all[0] ?? node.none[0])?.message;
              if (why) console.log(`      ${why}`);
            }
            if (v.nodes.length > 5) console.log(`    … and ${v.nodes.length - 5} more`);
          }
        }
        await context.close();
      }
    }
  }
}

await browser.close();
console.log(`\n${checked} checks on ${paths.length} pages: ${failures ? `${failures} violations` : 'no violations'}`);
process.exit(failures ? 1 : 0);
