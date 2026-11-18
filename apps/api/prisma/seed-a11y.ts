/**
 * A library of one shelf for the accessibility check (apps/web/scripts/a11y.mjs, run in CI by
 * scripts/a11y-ci.sh): a poet with a book of ghazals, one of them from Persian with its
 * translations, and a prose writer with a story long enough to page. Enough for every kind
 * of page to have something on it; the texts are public-domain openings, cut short.
 * Only ever run against the throwaway database of that check.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { renderMarkdown } from '../src/common/utils/markdown';

const prisma = new PrismaClient();

const GHAZALS = [
  {
    slug: 'fuzuli-qezel-1',
    title: 'Məni candan usandırdı',
    body: 'Məni candan usandırdı, cəfadan yar usanmazmı?\nFələklər yandı ahimdən, muradım şəmi yanmazmı?\n\nQamu bimarinə canan dəvayi-dərd edər ehsan,\nNeçin qılmaz mənə dərman, məni bimar sanmazmı?',
  },
  {
    slug: 'fuzuli-qezel-2',
    title: 'Pənbeyi-daği-cünun içrə',
    body: 'Pənbeyi-daği-cünun içrə nihandır bədənim,\nDiri olduqca libasım budur, ölsəm kəfənim.\n\nCanı canan diləmiş, verməmək olmaz, ey dil,\nNə niza eyləyəlim, ol nə sənindir, nə mənim.',
  },
  {
    slug: 'fuzuli-qezel-3',
    title: 'Can vermə qəmi-eşqə',
    body: 'Can vermə qəmi-eşqə ki, eşq afəti-candır,\nEşq afəti-can olduğu məşhuri-cahandır.\n\nSud istəmə sevdayi-qəmi-eşqdə hərgiz\nKim, hasili-sevdayi-qəmi-eşq ziyandır.',
  },
];

const STORY = Array.from(
  { length: 40 },
  (_, i) =>
    `Poçt qutusu barədə əhvalatın ${i + 1}-ci abzası. Novruzəli xanın məktubunu qoltuğuna vurub şəhərə endi; ` +
    'küçənin başında divara vurulmuş qutunu görəndə bir xeyli dayanıb ona tamaşa elədi, sonra ehtiyatla qapağını qaldırdı.',
).join('\n\n');

async function main() {
  if (await prisma.work.count()) throw new Error('This database already holds works: seed-a11y is for an empty one');

  const poet = await prisma.author.create({
    data: {
      slug: 'fuzuli',
      nameAz: 'Məhəmməd Füzuli',
      nameRu: 'Мухаммед Физули',
      nameEn: 'Muhammad Fuzuli',
      nameFa: 'محمد فضولی',
      bornYear: 1494,
      diedYear: 1556,
      bornPlace: 'Kərbəla',
      type: 'POET',
      period: 'XVI əsr',
      writingLangs: ['AZ_ARABIC', 'FA', 'AR'],
      bioAz: 'Azərbaycan, fars və ərəb dillərində yazmış şair. **Leyli və Məcnun** poemasının müəllifi.',
      bioRu: 'Поэт, писавший на азербайджанском, персидском и арабском языках.',
      bioEn: 'A poet who wrote in Azerbaijani, Persian and Arabic.',
      status: 'PUBLISHED',
      featuredAt: new Date(),
    },
  });
  const divan = await prisma.collection.create({
    data: {
      slug: 'fuzuli-qezeller',
      titleAz: 'Qəzəllər',
      titleRu: 'Газели',
      titleEn: 'Ghazals',
      authorId: poet.id,
      genre: 'POEM',
      descriptionAz: 'Divandan qəzəllər.',
      status: 'PUBLISHED',
    },
  });
  const poem = (g: (typeof GHAZALS)[number], order: number): Prisma.WorkUncheckedCreateInput => ({
    slug: g.slug,
    titleAz: g.title,
    body: g.body,
    bodyHtml: renderMarkdown(g.body),
    originalLang: 'AZ_LATIN',
    genre: 'POEM',
    form: 'GHAZAL',
    order,
    authorId: poet.id,
    collectionId: divan.id,
    sourceNote: 'Əsərləri, I cild. Bakı, 2005',
    status: 'PUBLISHED',
  });
  for (const [i, g] of GHAZALS.entries()) await prisma.work.create({ data: poem(g, i + 1) });

  // An original in Arabic script, read right to left, beside its translations
  const fa = 'الا یا ایها الساقی ادر کأسا و ناولها\nکه عشق آسان نمود اول ولی افتاد مشکل‌ها';
  const az = 'Ey saqi, badəni dolandır, bizə də ver,\nEşq əvvəl asan göründü, sonra müşküllər düşdü.';
  const ru = 'Эй, виночерпий, пусти чашу по кругу и подай её нам:\nлюбовь сперва казалась лёгкой, но пришли трудности.';
  await prisma.work.create({
    data: {
      slug: 'fuzuli-qezel-fa-1',
      titleAz: 'Ey saqi',
      titleFa: 'الا یا ایها الساقی',
      body: fa,
      bodyHtml: renderMarkdown(fa),
      originalLang: 'FA',
      scriptDirection: 'RTL',
      genre: 'POEM',
      form: 'GHAZAL',
      order: 4,
      authorId: poet.id,
      collectionId: divan.id,
      status: 'PUBLISHED',
      translations: {
        create: [
          { language: 'AZ_LATIN', body: az, bodyHtml: renderMarkdown(az), translator: 'Sınaq', isDefault: true, status: 'PUBLISHED' },
          { language: 'RU', body: ru, bodyHtml: renderMarkdown(ru), translator: 'Проба', isDefault: true, status: 'PUBLISHED' },
        ],
      },
    },
  });

  const writer = await prisma.author.create({
    data: {
      slug: 'celil-memmedquluzade',
      nameAz: 'Cəlil Məmmədquluzadə',
      nameRu: 'Джалил Мамедкулизаде',
      nameEn: 'Jalil Mammadguluzadeh',
      bornYear: 1869,
      diedYear: 1932,
      type: 'WRITER',
      period: 'XX əsr',
      writingLangs: ['AZ_LATIN'],
      bioAz: 'Yazıçı, dramaturq, «Molla Nəsrəddin» jurnalının naşiri.',
      status: 'PUBLISHED',
    },
  });
  const stories = await prisma.collection.create({
    data: { slug: 'memmedquluzade-hekayeler', titleAz: 'Hekayələr', authorId: writer.id, genre: 'PROSE', status: 'PUBLISHED' },
  });
  await prisma.work.create({
    data: {
      slug: 'memmedquluzade-poct-qutusu',
      titleAz: 'Poçt qutusu',
      body: STORY,
      bodyHtml: renderMarkdown(STORY),
      originalLang: 'AZ_LATIN',
      genre: 'PROSE',
      year: 1903,
      order: 1,
      authorId: writer.id,
      collectionId: stories.id,
      status: 'PUBLISHED',
    },
  });

  console.log(`Seeded ${await prisma.author.count()} authors, ${await prisma.work.count()} works`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
