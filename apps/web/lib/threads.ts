/**
 * Threads on the literature tree (/agac): one subject, form or conversation followed across the
 * centuries, work by work. Editorial, like the rest of canon.ts. A stop names a work or a book
 * by slug; the page drops any stop the site doesn't (or no longer) publish(es), and a thread
 * with fewer than three stops left. `year` places a stop on the line; `when` replaces it in the
 * text where the date is only known roughly.
 */
import type { L } from './canon';

export interface ThreadStop {
  work?: string;
  book?: string;
  year: number;
  when?: string;
  note?: L;
}

export interface Thread {
  key: string;
  title: L;
  gist: L;
  stops: ThreadStop[];
}

export const THREADS: Thread[] = [
  {
    key: 'leyli',
    title: { az: 'Leyli və Məcnun', ru: 'Лейли и Меджнун', en: 'Leyli and Məcnun' },
    gist: {
      az: 'Ərəb səhrasının əfsanəsi Nizamidən sonra hər əsrdə yenidən yazılır: məsnəvi, qəzəl, satira, opera.',
      ru: 'Легенда арабской пустыни после Низами переписывается в каждом веке: месневи, газель, сатира, опера.',
      en: 'A legend of the Arabian desert, rewritten in every century after Nizami: masnavi, ghazal, satire, opera.',
    },
    stops: [
      { book: 'nizami-leyli-va-macnun', year: 1188,
        note: { az: 'Əfsanə ilk dəfə böyük poemaya çevrilir.', ru: 'Легенда впервые становится большой поэмой.', en: 'The legend becomes a great poem for the first time.' } },
      { work: 'burhaneddin-leylim-icun-leylim-icun-ben-bini-mecnun-ideyim', year: 1390, when: 'XIV',
        note: { az: 'Qazi Bürhanəddin Məcnunu qəzəlin «mən»inə çevirir.', ru: 'Кади Бурханеддин делает Меджнуна лирическим «я» газели.', en: 'Qazi Bürhanəddin makes Məcnun the “I” of a ghazal.' } },
      { book: 'fuzuli-leyli-ve-mecnun', year: 1536,
        note: { az: 'Türkcə ilk böyük «Leyli və Məcnun»: Nizamiyə cavab.', ru: 'Первая большая тюркская «Лейли и Меджнун» — ответ Низами.', en: 'The first great Turkic version, written in answer to Nizami.' } },
      { work: 'endelib-qaracadagi-leyli-ve-mecnun', year: 1750, when: 'XVIII' },
      { work: 'sabir-leyli-mecnun-ey-dovletimin-zevali-oglum', year: 1907,
        note: { az: 'Sabir eşqi satiraya çevirir: ata oğluna ağlayır.', ru: 'Сабир обращает любовь в сатиру: отец оплакивает сына.', en: 'Sabir turns the romance into satire: a father mourns his son.' } },
      { work: 'hacibeyov-leyli-ve-mecnun-opera', year: 1908,
        note: { az: 'Füzulinin sözlərinə Şərqin ilk operası.', ru: 'Первая опера Востока на стихи Физули.', en: 'The first opera of the Muslim East, to Füzuli’s verse.' } },
    ],
  },
  {
    key: 'koroglu',
    title: { az: 'Koroğlu', ru: 'Кёроглу', en: 'Koroğlu' },
    gist: {
      az: 'Çənlibelin qəhrəmanı dastandan səhnəyə, operaya və qocalığa qədər.',
      ru: 'Герой Ченлибеля — от дастана к сцене, к опере и к старости.',
      en: 'The hero of Çənlibel, from the dastan to the stage, the opera and old age.',
    },
    stops: [
      { book: 'xalq-koroglu-dastani', year: 1650, when: 'XVII',
        note: { az: 'Aşıqların söylədiyi qolların toplusu.', ru: 'Ветви дастана, как их пели ашуги.', en: 'The branches of the dastan as the aşıqs told them.' } },
      { book: 'haqverdiyev-yoldas-koroglu', year: 1925, when: '1920' },
      { book: 'hacibeyov-koroglu', year: 1937,
        note: { az: 'Hacıbəyovun son operası.', ru: 'Последняя опера Гаджибекова.', en: 'Hacıbəyov’s last opera.' } },
      { work: 'zeynal-xelil-koroglunun-qocaligi', year: 1945,
        note: { az: '«Tüfəng çıxdı, mərdlik getdi»: el qoşmasından alınmış misra.', ru: '«Пришло ружьё — ушла доблесть»: строка из народной гошмы.', en: '“The gun came and valour went”: a line taken from a folk qoşma.' } },
    ],
  },
  {
    key: 'vaqif',
    title: { az: 'Vaqif və Vidadi', ru: 'Вагиф и Видади', en: 'Vaqif and Vidadi' },
    gist: {
      az: 'İki dostun şeirlə söhbəti və onu iki əsr sonra yenidən dinləyənlər.',
      ru: 'Разговор двух друзей в стихах и те, кто расслышал его два века спустя.',
      en: 'Two friends talking in verse, and those who listened again two centuries later.',
    },
    stops: [
      { work: 'vidadi-durnalar', year: 1780, when: 'XVIII',
        note: { az: 'Vidadi durnalara qəmini danışır…', ru: 'Видади рассказывает журавлям о своей печали…', en: 'Vidadi tells the cranes his sorrow…' } },
      { work: 'vaqif-durnalar', year: 1781, when: 'XVIII',
        note: { az: '…Vaqif eyni rədiflə cavab verir.', ru: '…Вагиф отвечает с той же редифой.', en: '…and Vaqif answers with the same refrain.' } },
      { work: 'vaqif-molla-penah-vaqifle-molla-veli-vidadinin-deyismesi', year: 1785, when: 'XVIII' },
      { work: 'kocerli-vaqif-ve-vidadi-ve-bunlarin-dostlugu', year: 1907,
        note: { az: 'Köçərli onların dostluğunu ədəbiyyat tarixinə yazır.', ru: 'Кочарлинский вписывает их дружбу в историю литературы.', en: 'Köçərli writes their friendship into literary history.' } },
      { book: 'vurgun-vaqif', year: 1937,
        note: { az: 'Vurğunun dramında Vaqif Qacarla üz-üzə.', ru: 'В драме Вургуна Вагиф лицом к лицу с Каджаром.', en: 'In Vurğun’s play Vaqif faces Qacar.' } },
    ],
  },
  {
    key: 'nizami-xosrov',
    title: { az: 'Xosrov, Şirin və Fərhad', ru: 'Хосров, Ширин и Фархад', en: 'Xosrov, Şirin and Fərhad' },
    gist: {
      az: 'Nizaminin ikinci poeması: şah, gözəl və dağ çapan usta. Sonrakılar onu nəsihətə, tarixə və gülüşə çevirir.',
      ru: 'Вторая поэма Низами: шах, красавица и каменотёс. Потомки делают из неё наставление, историю и смех.',
      en: 'Nizami’s second poem: a shah, a beauty and the stone-cutter. Later writers make it a lesson, history and a joke.',
    },
    stops: [
      { book: 'nizami-xosrov-va-sirin', year: 1180 },
      { work: 'hadi-xosrovun-siruyeye-nesiheti', year: 1910, when: '1910' },
      { work: 'resulzade-azerbaycan-sairi-nizami-xosrov-ve-sirin', year: 1949,
        note: { az: 'Rəsulzadə mühacirətdə Nizamini oxuyur.', ru: 'Расулзаде читает Низами в эмиграции.', en: 'Rəsulzadə reads Nizami in exile.' } },
      { work: 'punhan-ferhad-ve-sirinin-hamam-ehvalati', year: 1999,
        note: { az: 'Əfsanə gündəlik həyatın satirasında.', ru: 'Легенда в сатире на повседневность.', en: 'The legend in a satire on everyday life.' } },
    ],
  },
  {
    key: 'satire',
    title: { az: 'Gülüşün xətti', ru: 'Линия смеха', en: 'A line of laughter' },
    gist: {
      az: 'Axundzadənin komediyalarından «Molla Nəsrəddin»ə: güləndə düşündürən ədəbiyyat.',
      ru: 'От комедий Ахундзаде к «Молла Насреддину»: литература, которая заставляет думать смехом.',
      en: 'From Axundzadə’s comedies to Molla Nəsrəddin: literature that makes you think by making you laugh.',
    },
    stops: [
      { work: 'axundzade-hekayeti-musyo-jordan-hekimi-nebatat-ve-dervis-mesteli-sah', year: 1850,
        note: { az: 'Azərbaycan dramaturgiyası komediya ilə başlayır.', ru: 'Азербайджанская драматургия начинается с комедии.', en: 'Azerbaijani drama begins with comedy.' } },
      { work: 'memmedquluzade-danabas-kendinin-ehvalatlari', year: 1894 },
      { work: 'sabir-millet-nece-tarac-olur-olsun-ne-isim-var', year: 1906,
        note: { az: '«Molla Nəsrəddin»in ilk ilində.', ru: 'В первый год «Молла Насреддина».', en: 'From Molla Nəsrəddin’s first year.' } },
      { book: 'memmedquluzade-oluler', year: 1909 },
    ],
  },
  {
    key: 'fables',
    title: { az: 'Tülkü təmsilləri', ru: 'Басни о лисе', en: 'Fables of the fox' },
    gist: {
      az: 'Krılov və Lafontendən gələn tülkü uşaq ədəbiyyatının ilk qəhrəmanlarından olur.',
      ru: 'Лиса, пришедшая от Крылова и Лафонтена, становится одним из первых героев детской литературы.',
      en: 'The fox of Krylov and La Fontaine becomes one of the first heroes of children’s books.',
    },
    stops: [
      { work: 'bakixanov-tulku-ve-qoyun', year: 1835, when: 'XIX' },
      { work: 'sehhet-tulku-ve-qurd', year: 1909 },
      { work: 'sabir-qarga-ve-tulku', year: 1910, when: '1910' },
      { work: 'saiq-tulku-hecce-gedir', year: 1910,
        note: { az: 'Ən çox əzbərlənən təmsil.', ru: 'Самая заучиваемая басня.', en: 'The fable every child learns by heart.' } },
      { work: 'saiq-tulku-ve-deve', year: 1942 },
    ],
  },
  {
    key: 'araz',
    title: { az: 'Arazın iki sahili', ru: 'Два берега Аракса', en: 'Two banks of the Araz' },
    gist: {
      az: 'Şəhriyarın «Heydərbabaya salam»ı Bakıda eşidilir; şimal şairləri cavab yazır, cənub şairləri də.',
      ru: '«Привет Гейдарбабе» Шахрияра услышали в Баку; северные поэты отвечают, южные тоже.',
      en: 'Şəhriyar’s Heydərbabaya salam is heard in Baku; northern poets write back, and southern ones too.',
    },
    stops: [
      { work: 'sehriyar-heyderbabaya-salam', year: 1954,
        note: { az: 'Təbrizdə ərəb əlifbası ilə çap olunur.', ru: 'Напечатано в Тебризе арабским письмом.', en: 'Printed in Tabriz, in the Arabic script.' } },
      { work: 'suleyman-rustem-sehriyara-dorduncu-mektub', year: 1960, when: '1960' },
      { work: 'resul-rza-tebrizim-menim', year: 1964 },
      { work: 'memmed-araz-sehriyar-gelmedi', year: 1967 },
      { work: 'medine-gulgun-cagla-arazim-cagla', year: 1977,
        note: { az: 'Cavab o tayadan: Təbrizli şairə.', ru: 'Ответ с другого берега: поэтесса из Тебриза.', en: 'An answer from the other bank: a poet from Tabriz.' } },
    ],
  },
  {
    key: 'vetan',
    title: { az: '«Azərbaycan» adlı şeirlər', ru: 'Стихи под названием «Азербайджан»', en: 'Poems called “Azərbaycan”' },
    gist: {
      az: 'Bir ad, yüz il: Cümhuriyyətin bayrağından sovet illərinə və Təbrizə.',
      ru: 'Одно имя, сто лет: от флага Республики до советских лет и Тебриза.',
      en: 'One name across a century: from the Republic’s flag to the Soviet years and Tabriz.',
    },
    stops: [
      { work: 'cavad-azerbaycan-bayragina', year: 1919,
        note: { az: 'Cümhuriyyətin üçrəngli bayrağına.', ru: 'Трёхцветному флагу Республики.', en: 'To the Republic’s tricolour.' } },
      { work: 'vurgun-azerbaycan', year: 1935 },
      { work: 'biriya-azerbaycan-surudu', year: 1945, when: '1940' },
      { work: 'bextiyar-vahabzade-azerbaycan-ogluyam', year: 1966 },
      { work: 'memmed-araz-azerbaycan-dunyam-menim', year: 1970 },
      { work: 'medine-gulgun-azerbaycan', year: 1978 },
    ],
  },
];
