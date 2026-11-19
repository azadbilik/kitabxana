// Accessibility check: opens the site's kinds of page in a real browser and runs axe-core
// (WCAG 2.0–2.2, levels A and AA) on each, in both themes, at desktop and phone widths, in
// Nar and in the Gazette look.
// Any violation fails the run. On phones it also checks that no page is wider than the screen
// (WCAG 1.4.10, reflow): at 375px, and at 320px with the site's largest text setting. A page
// wider than the screen makes mobile browsers zoom the whole page out.
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

/** Narrow screens to check for sideways overflow only: [name, viewport, localStorage] */
const REFLOW = [
  ['320px, largest text', { width: 320, height: 640 }, { a11y: JSON.stringify({ text: 2 }) }],
  ['320px, largest text, gazette', { width: 320, height: 640 }, { a11y: JSON.stringify({ text: 2 }), skin: 'gazette' }],
];

/**
 * Is the page wider than the screen? If so, which elements stick out: those not clipped by a
 * scrolling ancestor, or positioned from an ancestor outside it (a .sr-only in a shelf row).
 */
async function overflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    if (sw <= vw + 1) return null;
    const out = [];
    for (const e of document.querySelectorAll('body *')) {
      const r = e.getBoundingClientRect();
      // Text spilling out of its own box (nowrap in a squeezed flex item) reaches further than the box
      const spill = getComputedStyle(e).overflowX === 'visible' ? Math.max(0, e.scrollWidth - e.clientWidth) : 0;
      if (r.right + spill <= vw + 1 || !r.width) continue;
      let clip = null;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible') { clip = p; break; }
      }
      const pos = getComputedStyle(e).position;
      const escapes = clip && (pos === 'absolute' || pos === 'fixed') && !(e.offsetParent && clip.contains(e.offsetParent));
      if (clip && !escapes) continue;
      const cls = typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '';
      out.push(`${e.tagName.toLowerCase()}${cls} (right edge ${Math.round(r.right + spill)}px${escapes ? ', escapes its scrolling row' : ''})`);
    }
    return { vw, sw, culprits: out };
  });
}

function reportOverflow(label, o) {
  console.log(`\n✗ ${label}`);
  console.log(`  page is ${o.sw}px wide on a ${o.vw}px screen`);
  for (const c of o.culprits.slice(0, 5)) console.log(`    ${c}`);
  if (o.culprits.length > 5) console.log(`    … and ${o.culprits.length - 5} more`);
}

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
      // and the Gazette look (a reader's choice, data-skin) at both widths
      const gazette = { skin: 'gazette' };
      const variants = vpName === 'desktop' ? [{}, { 'a11y': JSON.stringify({ contrast: 'more' }) }, gazette] : [{}, gazette];
      for (const extra of variants) {
        const { context, page } = await open(path, viewport, theme, extra);
        if (vpName === 'phone' && theme === 'light') {
          const o = await overflow(page);
          checked++;
          if (o) { failures++; reportOverflow(`${[path, 'phone', extra.skin].filter(Boolean).join(' · ')} · wider than the screen`, o); }
        }
        for (const state of STATES) {
          if (state.when && !(await state.when(page))) continue;
          await state.run(page);
          const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
          checked++;
          const label = [path, vpName, theme, extra.a11y && 'high contrast', extra.skin, state.name].filter(Boolean).join(' · ');
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

for (const path of paths) {
  for (const [name, viewport, extra] of REFLOW) {
    const { context, page } = await open(path, viewport, 'light', extra);
    const o = await overflow(page);
    checked++;
    if (o) { failures++; reportOverflow(`${path} · ${name} · wider than the screen`, o); }
    await context.close();
  }
}

await browser.close();
console.log(`\n${checked} checks on ${paths.length} pages: ${failures ? `${failures} violations` : 'no violations'}`);
process.exit(failures ? 1 : 0);
