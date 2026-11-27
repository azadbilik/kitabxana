/**
 * The literature tree (/agac): Azerbaijani literature from the first monuments to today,
 * era by era. Every published author on the site is placed automatically (by years, then by
 * period, then into «El şairləri»); PLACE overrides that where the dates mislead. MISSING lists
 * authors and texts the site does not have yet, GAPS what is missing of authors it does have.
 * The selection of missing names is editorial: a reader's map, not a bibliography.
 */

export type L = { az: string; ru: string; en: string };
export type EraKey =
  | 'early' | 'golden' | 'sufi' | 'safavid' | 'khanates' | 'enlightenment'
  | 'mollanasreddin' | 'soviet' | 'emigration' | 'south' | 'thaw' | 'independence';
export type BranchKey =
  | 'folk' | 'monuments' | 'arabic' | 'persian' | 'poetry' | 'masnavi' | 'asiq' | 'elsairleri'
  | 'prose' | 'satire' | 'chronicles' | 'russian' | 'children';

export interface Era {
  key: EraKey;
  /** Shown on the trunk */
  when: string;
  /** Floruit years that fall here; side eras (emigration, south) are reached only by PLACE */
  until?: number;
  title: L;
  gist: L;
}

export const ERAS: Era[] = [
  { key: 'early', when: '— 1000', until: 1000,
    title: { az: 'Köklər: şifahi dastan və ilk yazılar', ru: 'Корни: устный эпос и первые письмена', en: 'Roots: oral epic and the first writing' },
    gist: { az: 'Oğuz dastanı, Alban salnaməsi, xilafət dövrünün ərəbdilli şairləri.', ru: 'Огузский эпос, албанская хроника, арабоязычные поэты эпохи халифата.', en: 'Oghuz epic, the Caucasian Albanian chronicle, Arabic-language poets of the caliphate.' } },
  { key: 'golden', when: '1000 — 1250', until: 1250,
    title: { az: 'Qızıl dövr: Gəncə, Şirvan, Təbriz', ru: 'Золотой век: Гянджа, Ширван, Тебриз', en: 'The golden age: Ganja, Shirvan, Tabriz' },
    gist: { az: 'Fars dilində saray və sufi poeziyası, Nizaminin «Xəmsə»si.', ru: 'Придворная и суфийская поэзия на персидском, «Хамсе» Низами.', en: 'Persian-language court and Sufi poetry; Nizami’s Khamsa.' } },
  { key: 'sufi', when: '1250 — 1500', until: 1500,
    title: { az: 'Sufi divanları və türkdilli şeirin yüksəlişi', ru: 'Суфийские диваны и подъём тюркского стиха', en: 'Sufi divans and the rise of Turkic verse' },
    gist: { az: 'Hürufilik, ilk böyük türkdilli divanlar, Qaraqoyunlu və Ağqoyunlu sarayları.', ru: 'Хуруфизм, первые большие тюркские диваны, дворы Кара-Коюнлу и Ак-Коюнлу.', en: 'Hurufism, the first great Turkic divans, the Qara Qoyunlu and Aq Qoyunlu courts.' } },
  { key: 'safavid', when: '1500 — 1700', until: 1700,
    title: { az: 'Səfəvi klassikləri və ilk aşıqlar', ru: 'Сефевидская классика и первые ашуги', en: 'Safavid classics and the first aşıqs' },
    gist: { az: 'Xətainin sarayı, Füzulinin Bağdadı, Saibin İsfahanı; saz şeiri.', ru: 'Двор Хатаи, Багдад Физули, Исфахан Саиба; поэзия саза.', en: 'Xətai’s court, Füzuli’s Baghdad, Saib’s Isfahan; poetry of the saz.' } },
  { key: 'khanates', when: '1700 — 1830', until: 1830,
    title: { az: 'Vaqif və xanlıqlar dövrü', ru: 'Вагиф и эпоха ханств', en: 'Vaqif and the khanates' },
    gist: { az: 'Qoşma yazılı şeirə keçir; Qarabağ, Şəki, Şirvan sarayları; el şairləri.', ru: 'Гошма входит в письменную поэзию; дворы Карабаха, Шеки, Ширвана; народные поэты.', en: 'The qoşma enters written verse; Karabakh, Shaki and Shirvan courts; village poets.' } },
  { key: 'enlightenment', when: '1830 — 1895', until: 1895,
    title: { az: 'Maarifçilik, dram və mətbuat', ru: 'Просвещение, драма и пресса', en: 'Enlightenment, drama and the press' },
    gist: { az: 'Axundzadənin komediyaları, ilk nəsr, «Əkinçi», Şuşa və Şamaxı məclisləri.', ru: 'Комедии Ахундзаде, первая проза, «Экинчи», меджлисы Шуши и Шемахи.', en: 'Axundzadə’s comedies, the first prose, Əkinçi, the literary circles of Shusha and Shamakhi.' } },
  { key: 'mollanasreddin', when: '1895 — 1920', until: 1920,
    title: { az: '«Molla Nəsrəddin», «Füyuzat» və Cümhuriyyət', ru: '«Молла Насреддин», «Фюйузат» и Республика', en: 'Molla Nəsrəddin, Füyuzat and the Republic' },
    gist: { az: 'Satira, romantizm və 1918-ci il Cümhuriyyəti.', ru: 'Сатира, романтизм и Республика 1918 года.', en: 'Satire, romanticism and the 1918 Republic.' } },
  { key: 'soviet', when: '1920 — 1956', until: 1956,
    title: { az: 'Erkən sovet ədəbiyyatı', ru: 'Ранняя советская литература', en: 'Early Soviet literature' },
    gist: { az: 'Cabbarlının teatrı, Vurğun və Müşfiq, 1937-ci il repressiyaları.', ru: 'Театр Джаббарлы, Вургун и Мушфиг, репрессии 1937 года.', en: 'Cabbarlı’s theatre, Vurğun and Müşfiq, the purges of 1937.' } },
  { key: 'emigration', when: '1920 — 1991',
    title: { az: 'Mühacirət', ru: 'Эмиграция', en: 'Emigration' },
    gist: { az: 'İstanbul, Paris, Münhen: vətəndən kənarda yazanlar.', ru: 'Стамбул, Париж, Мюнхен: писавшие вдали от родины.', en: 'Istanbul, Paris, Munich: writers in exile.' } },
  { key: 'south', when: 'XX əsr',
    title: { az: 'Cənubi Azərbaycan', ru: 'Южный Азербайджан', en: 'Southern Azerbaijan' },
    gist: { az: 'Təbrizdən azərbaycanca və farsca şeir: senzura altında və 1945–46-cı illərin Milli hökuməti dövründə.', ru: 'Поэзия на азербайджанском и персидском из Тебриза: под цензурой и при Национальном правительстве 1945–46 гг.', en: 'Poetry in Azerbaijani and Persian from Tabriz, under censorship and the 1945–46 National Government.' } },
  { key: 'thaw', when: '1956 — 1991', until: 1991,
    title: { az: '«Altmışıncılar» və gec sovet dövrü', ru: '«Шестидесятники» и поздний советский период', en: 'The sixties generation and late Soviet years' },
    gist: { az: 'Lirikanın yenilənməsi, psixoloji nəsr, rusdilli Azərbaycan yazıçıları.', ru: 'Обновление лирики, психологическая проза, азербайджанские писатели на русском.', en: 'Lyric renewal, psychological prose, Azerbaijani writers in Russian.' } },
  { key: 'independence', when: '1991 — 2026',
    title: { az: 'Müstəqillik', ru: 'Независимость', en: 'Independence' },
    gist: { az: 'Qarabağ müharibəsi, postmodern nəsr, yeni poeziya. Müəlliflərin çoxu sağdır.', ru: 'Карабахская война, постмодернистская проза, новая поэзия. Большинство авторов живы.', en: 'The Karabakh war, postmodern prose, new poetry. Most authors are living.' } },
];

export const BRANCHES: Record<BranchKey, L> = {
  folk: { az: 'Xalq ədəbiyyatı', ru: 'Народное творчество', en: 'Folk literature' },
  monuments: { az: 'Abidələr və salnamələr', ru: 'Памятники и хроники', en: 'Monuments and chronicles' },
  arabic: { az: 'Ərəb dilində', ru: 'На арабском', en: 'In Arabic' },
  persian: { az: 'Fars dilində', ru: 'На персидском', en: 'In Persian' },
  poetry: { az: 'Poeziya', ru: 'Поэзия', en: 'Poetry' },
  masnavi: { az: 'Məsnəvi və poemalar', ru: 'Месневи и поэмы', en: 'Masnavis and long poems' },
  asiq: { az: 'Aşıqlar', ru: 'Ашуги', en: 'Aşıqs' },
  elsairleri: { az: '«El şairləri» (XVII–XIX əsrlər)', ru: '«Народные поэты» (XVII–XIX вв.)', en: '«El şairləri», village poets (17th–19th c.)' },
  prose: { az: 'Nəsr və dram', ru: 'Проза и драма', en: 'Prose and drama' },
  satire: { az: 'Satira', ru: 'Сатира', en: 'Satire' },
  chronicles: { az: 'Tarixnamələr', ru: 'Хроники', en: 'Chronicles' },
  russian: { az: 'Rus dilində', ru: 'На русском', en: 'In Russian' },
  children: { az: 'Uşaq ədəbiyyatı', ru: 'Детская литература', en: 'Children’s literature' },
};

/** Order branches appear in within an era */
export const BRANCH_ORDER: BranchKey[] = [
  'folk', 'monuments', 'poetry', 'masnavi', 'persian', 'arabic', 'satire', 'prose', 'children', 'russian', 'asiq', 'chronicles', 'elsairleri',
];

/** Placement by slug where years or defaults would put an author in the wrong place */
export const PLACE: Record<string, { era?: EraKey; branch?: BranchKey }> = {
  xalq: { era: 'early', branch: 'folk' },
  koroglu: { era: 'safavid', branch: 'folk' },
  'el-sairleri-adsiz': { era: 'khanates', branch: 'elsairleri' },
  'izzeddin-hasanoglu': { era: 'sufi' },
  hemam: { era: 'golden', branch: 'persian' },
  meghribi: { era: 'sufi', branch: 'persian' },
  kisveri: { era: 'sufi' },
  'nitqi-sirvani': { era: 'safavid' },
  meczub: { era: 'safavid' },
  'asiq-qerib': { era: 'safavid', branch: 'asiq' },
  qaracaoglan: { branch: 'asiq' },
  'miskin-abdal': { branch: 'asiq' },
  'xeste-qasim': { era: 'safavid', branch: 'asiq' },
  'sari-asiq': { branch: 'asiq' },
  'mucrum-kerim': { era: 'enlightenment' },
  neyyir: { era: 'enlightenment', branch: 'persian' },
  bakixanov: { branch: 'prose' },
  sabir: { era: 'mollanasreddin', branch: 'satire' },
  memmedquluzade: { era: 'mollanasreddin', branch: 'satire' },
  haqverdiyev: { branch: 'prose' },
  qemkusar: { branch: 'satire' },
  mocuz: { branch: 'satire' },
  'molla-mehemmed-sefili': { branch: 'satire' },
  nemanzade: { branch: 'prose' },
  kocerli: { era: 'mollanasreddin', branch: 'prose' },
  'resid-efendiyev': { era: 'mollanasreddin', branch: 'prose' },
  huseynzade: { era: 'mollanasreddin' },
  'suleyman-sani': { branch: 'prose' },
  nerimanov: { branch: 'prose' },
  resulzade: { branch: 'prose' },
  hacibeyov: { branch: 'prose' },
  ordubadi: { era: 'soviet', branch: 'prose' },
  saiq: { era: 'mollanasreddin' },
  cemenzeminli: { era: 'soviet', branch: 'prose' },
  vahid: { era: 'soviet' },
  'irec-mirze': { era: 'south', branch: 'persian' },
  'pervin-etisami': { era: 'south', branch: 'persian' },
  'hebib-sahir': { era: 'south' },
  sehriyar: { era: 'south' },
  biriya: { era: 'south' },
  'hekime-billuri': { era: 'south' },
  ildirim: { era: 'emigration' },
  ummugulsum: { era: 'emigration' },
  fetelibeyli: { era: 'emigration', branch: 'prose' },
  'ilyas-efendiyev': { era: 'thaw' },
  'mirze-ibrahimov': { era: 'soviet' },
  'ismayil-sixli': { era: 'thaw' },
  'zeynal-cabbarzade': { era: 'thaw' },
  'zeynal-xelil': { era: 'thaw' },
  'neriman-hesenzade': { era: 'thaw' },
  'tofiq-bayram': { era: 'thaw' },
  'refiq-zeka-xendan': { era: 'thaw' },
  'sabir-rustemxanli': { era: 'thaw' },
  'eliaga-kurcayli': { era: 'thaw' },
  'huseyn-ibrahimov': { era: 'thaw' },
  'anar': { era: 'thaw' },
  'ekrem-eylisli': { era: 'thaw' },
  'isi-melikzade': { era: 'thaw' },
  'mikayil-rzaquluzade': { branch: 'children' },
  'bayrameli-abbaszade': { branch: 'satire' },
  'ebdulqadir-maragayi': { branch: 'persian' },
  'ehmed-bey-agaoglu': { era: 'emigration' },
  'eli-fitret': { era: 'south' },
  'balas-azeroglu': { era: 'south' },
  'medine-gulgun': { era: 'south' },
  'qulamrza-sebri-tebrizi': { era: 'south' },
  'kamal-abdulla': { era: 'independence' },
  'miskin-veli': { era: 'soviet', branch: 'asiq' },
  'asiq-semsir': { era: 'soviet', branch: 'asiq' },
  'asiq-huseyn-cavan': { era: 'south', branch: 'asiq' },
  'rustem-ibrahimbeyov': { era: 'thaw' },
  'salam-qedirzade': { era: 'thaw' },
  'natiq-resulzade': { era: 'independence' },
  'maqsud-ibrahimbeyov': { era: 'thaw', branch: 'russian' },
  'zahid-xelil': { era: 'thaw', branch: 'children' },
  'mirze-adigozel-bey': { era: 'khanates', branch: 'chronicles' },
  'murtezaqulu-xan-samli': { era: 'safavid', branch: 'poetry' },
  'abdulla-bey-asi': { era: 'enlightenment', branch: 'poetry' },
  'qilman-ilkin': { era: 'soviet', branch: 'prose' },
  'huseyn-abbaszade': { era: 'thaw', branch: 'prose' },
  'hemid-arzulu': { era: 'thaw', branch: 'prose' },
  'salam-sarvan': { era: 'independence', branch: 'poetry' },
  'isa-ismayilzade': { era: 'thaw', branch: 'poetry' },
  'ilyas-tapdiq': { era: 'thaw', branch: 'poetry' },
  'abay-dagli': { era: 'emigration', branch: 'poetry' },
  'gulhuseyn-huseynoglu': { era: 'thaw', branch: 'prose' },
  'eleviyye-babayeva': { era: 'soviet', branch: 'prose' },
  'ehmed-cemil': { era: 'soviet', branch: 'poetry' },
  'rafiq-tagi': { era: 'independence', branch: 'prose' },
  'cingiz-huseynov': { era: 'thaw', branch: 'russian' },
  'semed-behrengi': { era: 'south', branch: 'children' },
  'eli-razi-semcizade': { era: 'mollanasreddin', branch: 'satire' },
  fezli: { branch: 'masnavi' },
  matemi: { era: 'safavid' },
  'mesedi-eyyub-baki': { era: 'enlightenment' },
  mesihi: { branch: 'masnavi' },
  'mir-mehdi-xezani': { branch: 'chronicles' },
  'mirze-bala-memmedzade': { era: 'emigration' },
  'qurban-seid': { era: 'emigration', branch: 'prose' },
  'mirze-baxis-nadim': { era: 'enlightenment', branch: 'satire' },
  'nusret-kesemenli': { era: 'thaw' },
  'qul-qarani': { branch: 'asiq' },
  'sayat-nova': { branch: 'asiq' },
  'xeyyat-mirze': { era: 'mollanasreddin', branch: 'asiq' },
  'qemerbeyim-seyda': { era: 'mollanasreddin' },
};

/** What is still missing of an author the site has: titles, shown after "Not yet on the site" */
export const GAPS: Record<string, string> = {
  xalq: 'Bayatılar · nağıllar · atalar sözləri · laylalar · tapmacalar · «Əsli və Kərəm» · «Aşıq Qərib» · «Şah İsmayıl» · «Abbas və Gülgəz» · «Tahir və Zöhrə» · «Valeh və Zərnigar» · «Qaçaq Nəbi» · holavarlar · ağılar',
  nizami: 'Lirik divan (qəzəllər, qəsidələr, rübailər)',
  fuzuli: '«Rind və Zahid» · «Səhhət və Mərəz» · ərəbcə divan · «Mətləül-etiqad»',
  'cahansah-heqiqi': 'Türkcə və farsca divanın çoxu',
  'sari-asiq': 'Bayatıların çoxu',
  talibov: '«Kitabi-Əhməd» · «Məsalikül-möhsinin»',
  vazeh: 'Şeirlərin çoxu; Bodenştedtin «Mirzə Şəfinin nəğmələri»',
  vurgun: '«Seçilmiş əsərləri»nin IV–V cildləri',
  'resid-efendiyev': 'Hekayələr və pyeslər',
  qenizade: 'Əsərlərin çoxu',
};

export interface Missing {
  name: string;
  years?: string;
  era: EraKey;
  branch: BranchKey;
  /** Key work, in its own language */
  note?: string;
}

/** Authors and texts not on the site at all. Merged from an editorial pass over the standard histories. */
export const MISSING: Missing[] = [
  // early
  { name: 'Orxon-Yenisey abidələri', years: 'VIII əsr', era: 'early', branch: 'monuments' },
  { name: 'Davtak, «Cavanşirin ölümünə ağı»', years: 'VII əsr', era: 'early', branch: 'monuments', note: 'Musa Kalankatlının «Alban tarixi»ndə' },
  { name: 'Musa Kalankatlı, «Alban tarixi»', years: 'X əsr', era: 'early', branch: 'monuments' },
  { name: 'Musa Şəhəvat', years: 'ö. ~790', era: 'early', branch: 'arabic' },
  { name: 'İsmail ibn Yasar', years: 'ö. ~750', era: 'early', branch: 'arabic' },
  // golden
  { name: 'Əbül-Üla Gəncəvi', years: '1098–1159', era: 'golden', branch: 'persian' },
  { name: 'Xətib Təbrizi', years: '1030–1109', era: 'golden', branch: 'arabic' },
  { name: 'Bəhmənyar', years: 'ö. 1066', era: 'golden', branch: 'arabic', note: '«Ət-Təhsil»' },
  { name: 'Şihabəddin Sührəvərdi', years: '1154–1191', era: 'golden', branch: 'arabic', note: 'İşraq fəlsəfəsi' },
  { name: 'Zülfüqar Şirvani', years: '1191–1290', era: 'golden', branch: 'persian' },
  { name: 'İzzəddin Şirvani', years: 'XII əsr', era: 'golden', branch: 'persian' },
  { name: 'Əbubəkr ibn Xosrov əl-Ustad', years: 'XII əsr', era: 'golden', branch: 'persian', note: '«Munisnamə»' },
  { name: 'Şəms Təbrizi', years: '1185–1248', era: 'golden', branch: 'persian', note: '«Məqalat»' },
  // sufi
  { name: 'Arif Ərdəbili', years: 'XIV əsr', era: 'sufi', branch: 'masnavi', note: '«Fərhadnamə»' },
  { name: 'Əssar Təbrizi', years: 'ö. 1390', era: 'sufi', branch: 'masnavi', note: '«Mehr və Müştəri»' },
  { name: 'Yusif Məddah', years: 'XIV əsr', era: 'sufi', branch: 'masnavi', note: '«Vərqa və Gülşa»' },
  { name: 'Şeyx Səfiəddin Ərdəbili', years: '1252–1334', era: 'sufi', branch: 'persian', note: 'Dübeytilər' },
  { name: 'Fəzlullah Nəimi', years: '1340–1394', era: 'sufi', branch: 'persian', note: '«Cavidannamə»' },
  { name: 'Nəsir Bakuvi', years: 'XIV əsr', era: 'sufi', branch: 'persian' },
  { name: 'Seyid Yəhya Bakuvi', years: 'ö. 1464', era: 'sufi', branch: 'persian' },
  // safavid
  { name: 'Tərzi Əfşar', years: 'XVII əsr', era: 'safavid', branch: 'poetry' },
  { name: 'Sultan Məhəmməd', years: 'XVI əsr', era: 'safavid', branch: 'poetry' },
  // khanates
  { name: 'Məhcur Şirvani', years: 'XVIII əsr', era: 'khanates', branch: 'poetry' },
  // enlightenment
  { name: 'Həsən bəy Zərdabi', years: '1842–1907', era: 'enlightenment', branch: 'prose', note: '«Əkinçi»' },
  { name: 'Mirzə Kazım bəy', years: '1802–1870', era: 'enlightenment', branch: 'prose' },
  { name: 'Mirzə Cəfər Topçubaşov', years: '1790–1869', era: 'enlightenment', branch: 'prose' },
  { name: 'Mirzə Ağa Təbrizi', years: 'XIX əsr', era: 'enlightenment', branch: 'prose', note: 'İlk pyeslər fars dilində' },
  { name: 'Eynəli bəy Sultanov', years: '1866–1935', era: 'enlightenment', branch: 'prose' },
  // mollanasreddin
  { name: 'Seyid Hüseyn', years: '1887–1938', era: 'mollanasreddin', branch: 'prose' },
  { name: 'Tağı Şahbazi Simurq', years: '1892–1938', era: 'mollanasreddin', branch: 'prose' },
  { name: 'Əbdülxaliq Cənnəti', years: '1855–1931', era: 'mollanasreddin', branch: 'poetry' },
  // soviet
  { name: 'Mikayıl Rəfili', years: '1905–1958', era: 'soviet', branch: 'poetry' },
  { name: 'Əbülhəsən', years: '1906–1986', era: 'soviet', branch: 'prose' },
  // emigration
  { name: 'Ceyhun Hacıbəyli', years: '1891–1962', era: 'emigration', branch: 'prose' },
  { name: 'Banin (Ümmülbanu)', years: '1905–1992', era: 'emigration', branch: 'prose', note: '«Jours caucasiens»' },
  // south
  { name: 'Rza Bərahəni', years: '1935–2022', era: 'south', branch: 'persian' },
  { name: 'Əli Tudə', years: '', era: 'south', branch: 'poetry' },
  // thaw
  { name: 'Sabir Əhmədli', years: '1930–2009', era: 'thaw', branch: 'prose' },
  { name: 'Qəşəm Nəcəfzadə', years: '', era: 'thaw', branch: 'children' },
  // independence
  { name: 'Seymur Baycan', years: 'd. 1977', era: 'independence', branch: 'prose' },
  { name: 'Səlim Babullaoğlu', years: 'd. 1972', era: 'independence', branch: 'poetry' },
  { name: 'Aqşin Yeniseyli', years: '', era: 'independence', branch: 'poetry' },
  // Second pass (2026-11-18): each name checked on its own az.wikipedia page
  { name: 'Məhəmməd ibn Bəis', years: 'IX əsr', era: 'early', branch: 'arabic', note: '«Mütəvəkkilə qəsidə»' },
  { name: 'Hüseyn Təbrizi', years: 'XI əsr', era: 'golden', branch: 'arabic' },
  { name: 'Baba Kuhi Bakuvi', years: 'X–XI əsr', era: 'golden', branch: 'persian' },
  { name: 'Məsud ibn Namdar', years: 'XI–XII əsr', era: 'golden', branch: 'persian' },
  { name: 'Fərrux Şirvani', years: '1125–1176', era: 'golden', branch: 'persian' },
  { name: 'Rəziyyə Gəncəvi', years: '1136–1198', era: 'golden', branch: 'persian' },
  { name: 'Qivami Mütərrizi', years: 'XII əsr', era: 'golden', branch: 'persian', note: '«Raiyyə» qəsidəsi' },
  { name: 'Əhmədi Təbrizi', years: 'XIV–XV əsr', era: 'sufi', branch: 'masnavi', note: '«Yusif və Züleyxa», «Əsrarnamə»' },
  { name: 'Cəmali Təbrizi', years: '1402–1427', era: 'sufi', branch: 'masnavi', note: 'Nizaminə cavab «Xəmsə»' },
  { name: 'Əşrəf Marağayi', years: 'XV əsr', era: 'sufi', branch: 'poetry', note: '«Mənhəc əl-əbrar»' },
  { name: 'Xəlili', years: '1407–1485', era: 'sufi', branch: 'masnavi', note: '«Fürkətnamə»' },
  { name: 'Xətai Təbrizi', years: 'XV əsr', era: 'sufi', branch: 'masnavi', note: '«Yusif ilə Züleyxa»' },
  { name: 'Sultan Yaqub', years: 'ö. 1490', era: 'sufi', branch: 'poetry' },
  { name: 'Bəsiri', years: '~1466–1536', era: 'safavid', branch: 'poetry' },
  { name: 'Qəribi', years: 'XV–XVI əsr', era: 'safavid', branch: 'poetry' },
  { name: 'Həqiri Təbrizi', years: 'ö. ~1586', era: 'safavid', branch: 'masnavi', note: '«Leyli və Məcnun»' },
  { name: 'Fədai Təbrizi', years: 'XVI əsr', era: 'safavid', branch: 'masnavi', note: '«Bəxtiyarnamə»' },
  { name: 'Yusif ibn Məhəmmədcan Qarabaği', years: '1532–1591', era: 'safavid', branch: 'persian', note: '«Həft cinan»' },
  { name: 'İbrahim mirzə Cahi', years: '1540–1577', era: 'safavid', branch: 'poetry', note: 'Cami «Həft övrəng» əlyazması' },
  { name: 'Rəhməti Təbrizi', years: 'ö. 1616', era: 'safavid', branch: 'persian' },
  { name: 'Kövsəri', years: 'XVI–XVII əsr', era: 'safavid', branch: 'masnavi', note: '«Şirin və Fərhad»' },
  { name: 'Yusif xan', years: 'ö. 1625', era: 'safavid', branch: 'poetry' },
  { name: 'Aşıq Abdulla', years: 'XVII əsr', era: 'safavid', branch: 'asiq', note: '«Cahan və Abdulla»' },
  { name: 'Uğurlu xan Ziyadi-Gəncəvi', years: 'ö. 1666', era: 'safavid', branch: 'poetry' },
  { name: 'Səfiqulu bəy Şamlu', years: 'XVII əsr', era: 'safavid', branch: 'poetry' },
  { name: 'Kəlbəli xan Müsahib-Gəncəvi', years: '1634–1686', era: 'safavid', branch: 'poetry' },
  { name: 'Mirzə Möhsün Təsir Təbrizi', years: '1650–1717', era: 'safavid', branch: 'poetry' },
  { name: 'Mir Fəttah Marağayi', years: 'ö. 1761', era: 'khanates', branch: 'masnavi', note: '«Riyazül-fütuh», «Saqinamə»' },
  { name: 'Zari Ərəşi', years: 'XVIII əsr', era: 'khanates', branch: 'persian' },
  { name: 'Şakir Şirvani', years: 'XVIII əsr', era: 'khanates', branch: 'poetry', note: '«Əhvali-Şirvan»' },
  { name: 'Arif Təbrizi', years: 'ö. 1805', era: 'khanates', branch: 'poetry' },
  { name: 'Nəşə Təbrizi', years: 'ö. 1775', era: 'khanates', branch: 'poetry' },
  { name: 'Fətəli xan (Şəki xanı)', years: 'ö. 1815', era: 'khanates', branch: 'poetry', note: '«Möhnəti» təxəllüsü' },
  { name: 'Əbdürrəzaq bəy Dünbili', years: '~1762–1827', era: 'khanates', branch: 'chronicles', note: '«Təcrübətül-əhrar», «Məasiri-sultaniyyə»' },
  { name: 'Hacı Zeynalabdin Şirvani', years: '1780–1838', era: 'khanates', branch: 'prose', note: '«Riyazüs-siyahət» səyahətnaməsi' },
  { name: 'Mirzə Əbdürrəhim Qarabaği', years: '1794–1858', era: 'khanates', branch: 'persian', note: '«Əlil» təxəllüsü, farsca şeir' },
  { name: 'Məşədi Nəsir Lövhi', years: '', era: 'enlightenment', branch: 'poetry', note: '«Məclisi-üns»' },
  { name: 'Məşədi Mahmud bəy Vəzirov', years: '1839–1902', era: 'enlightenment', branch: 'poetry', note: '«Məclisi-üns»' },
  { name: 'Mir Həsən Ağa Mir', years: '', era: 'enlightenment', branch: 'poetry' },
  { name: 'Abdulla bəy Vəlizadə', years: '1841–1912', era: 'enlightenment', branch: 'poetry', note: '«Məclisi-fəramuşan»' },
  { name: 'Qafar Rağib', years: '1818–1891', era: 'enlightenment', branch: 'poetry', note: '«Beytüs-səfa»' },
  { name: 'Ələkbər Qafil', years: '1818–1891', era: 'enlightenment', branch: 'poetry', note: '«Beytüs-səfa»' },
  { name: 'Molla Mahmud Zuyi', years: 'd. 1843', era: 'enlightenment', branch: 'poetry', note: '«Beytüs-səfa»' },
  { name: 'Molla Ələkbər Aciz', years: '1836–1899', era: 'enlightenment', branch: 'poetry', note: '«Fövcül-füsəha»' },
  { name: 'Molla İbrahimxəlil Dodui', years: '1860–1900', era: 'enlightenment', branch: 'poetry' },
  { name: 'Əhməd Ağa Şəmi', years: '', era: 'enlightenment', branch: 'poetry' },
  { name: 'Əhməd Əfəndi Zövqi', years: 'd. 1867', era: 'enlightenment', branch: 'poetry' },
  { name: 'Hacı Rəsul', years: '1802–1882', era: 'enlightenment', branch: 'poetry' },
  { name: 'Bəhram bəy Vəzirov', years: '1857–1921', era: 'enlightenment', branch: 'poetry' },
  { name: 'Xanbikə xanım', years: '1856–1921', era: 'enlightenment', branch: 'poetry' },
  { name: 'Həsənəli bəy Əsgərxanov', years: '1855–1920', era: 'enlightenment', branch: 'poetry' },
  { name: 'Cəlal Ünsizadə', years: '1854–1933', era: 'enlightenment', branch: 'prose', note: '«Kəşkül» redaktoru' },
  { name: 'Həşim bəy Vəzirov', years: '1867–1916', era: 'mollanasreddin', branch: 'prose' },
  { name: 'Səkinə Axundzadə', years: '1865–1927', era: 'mollanasreddin', branch: 'prose' },
  { name: 'Aşıq Əhməd Qarabaldırlı', years: 'd. 1870', era: 'enlightenment', branch: 'asiq' },
  { name: 'Əlipaşa Səbur Hüseynzadə', years: '1885–1934', era: 'mollanasreddin', branch: 'poetry', note: '«Yeni füyuzat» redaktoru' },
  { name: 'Abdulla Sur', years: '1883–1912', era: 'mollanasreddin', branch: 'prose', note: '«Füyuzat» müəllifi' },
  { name: 'Yusif Ziya Talıbzadə', years: '1877–1923', era: 'mollanasreddin', branch: 'prose', note: 'Dramaturq, «Füyuzat»' },
  { name: 'Emin Sadıxov', years: '1905–1975', era: 'soviet', branch: 'poetry', note: '«Gənc qızıl qələmlər»' },
  { name: 'Hacıbaba Nəzərli', years: '1895–1938', era: 'soviet', branch: 'prose' },
  { name: 'Məmmədkazım Ələkbərli', years: '1905–1938', era: 'soviet', branch: 'prose' },
  { name: 'Abdulla Faruq', years: '1907–1944', era: 'soviet', branch: 'poetry' },
  { name: 'Cəfər Rəmzi', years: '1905–1996', era: 'soviet', branch: 'poetry' },
  { name: 'Böyükağa Qasımzadə', years: '1916–1957', era: 'soviet', branch: 'poetry' },
  { name: 'Ələkbər Ziyatay', years: '1913–1982', era: 'soviet', branch: 'poetry' },
  { name: 'Mirmehdi Seyidzadə', years: '1907–1976', era: 'soviet', branch: 'children' },
  { name: 'Əyyub Abbasov', years: '1905–1957', era: 'soviet', branch: 'children' },
  { name: 'Ənvər Ələkbərli', years: '1916–1968', era: 'soviet', branch: 'poetry' },
  { name: 'Adil Babayev', years: '1925–1977', era: 'soviet', branch: 'poetry' },
  { name: 'Cabbar Məcnunbəyov', years: '1912–1967', era: 'soviet', branch: 'prose' },
  { name: 'Süleyman Vəliyev', years: '1916–1996', era: 'soviet', branch: 'prose' },
  { name: 'Səttar Axundov', years: '1914–1994', era: 'soviet', branch: 'prose' },
  { name: 'Seyfəddin Dağlı', years: '1921–1983', era: 'soviet', branch: 'prose' },
  { name: 'Cəmşid Əmirov', years: '1918–1982', era: 'soviet', branch: 'prose' },
  { name: 'Aşıq Savad', years: '1885–1970', era: 'soviet', branch: 'asiq' },
  { name: 'Aşıq Bəylər Qədirov', years: 'd. 1914', era: 'soviet', branch: 'asiq' },
  { name: 'Alazan Baycan', years: '1913–1989', era: 'emigration', branch: 'poetry' },
  { name: 'Teymur Atəşli', years: '1923–1976', era: 'emigration', branch: 'poetry' },
  { name: 'Səməd Ağaoğlu', years: '1909–1982', era: 'emigration', branch: 'prose' },
  { name: 'Cəfər Qaşif', years: '1894–1946', era: 'south', branch: 'poetry' },
  { name: 'Mir Mehdi Etimad', years: '1900–1981', era: 'south', branch: 'poetry' },
  { name: 'Mirzə Tağıxan Rafət Təbrizi', years: '1885–1920', era: 'south', branch: 'poetry' },
  { name: 'Gəncəli Sabahi', years: '1906–1990', era: 'south', branch: 'prose' },
  { name: 'Yadulla Məftun Amini', years: '1926–2022', era: 'south', branch: 'poetry' },
  { name: 'Bayram Bayramov', years: '1918–1994', era: 'thaw', branch: 'prose' },
  { name: 'İmran Qasımov', years: '1918–1981', era: 'thaw', branch: 'prose' },
  { name: 'Həsən Seyidbəyli', years: '1920–1980', era: 'thaw', branch: 'prose' },
  { name: 'Xanımana Əlibəyli', years: '1920–2007', era: 'thaw', branch: 'prose' },
  { name: 'Nahid Hacızadə', years: '1936–2018', era: 'thaw', branch: 'prose' },
  { name: 'Əlisa Nicat', years: 'd. 1936', era: 'thaw', branch: 'prose' },
  { name: 'Sabir Azəri', years: '', era: 'thaw', branch: 'prose' },
  { name: 'Əjdər Ağayev', years: '1937–2018', era: 'thaw', branch: 'poetry' },
  { name: 'Hüseyn Kürdoğlu', years: '1934–2003', era: 'thaw', branch: 'poetry' },
  { name: 'Famil Mehdi', years: '1934–2003', era: 'thaw', branch: 'poetry' },
  { name: 'Tofiq Mütəllibov', years: '1929–1992', era: 'thaw', branch: 'poetry' },
  { name: 'Ələkbər Salahzadə', years: '1941–2013', era: 'thaw', branch: 'poetry' },
  { name: 'Şahmar Əkbərzadə', years: '1941–2000', era: 'thaw', branch: 'poetry' },
  { name: 'Məmmədağa Sultanov', years: '1910–1991', era: 'thaw', branch: 'poetry' },
  { name: 'Cəfər Xəndan', years: '1910–1961', era: 'soviet', branch: 'poetry' },
  { name: 'Eldar Baxış', years: '', era: 'thaw', branch: 'poetry' },
  { name: 'Seyran Səxavət', years: 'd. 1946', era: 'thaw', branch: 'poetry' },
  { name: 'Vahid Əziz', years: 'd. 1945', era: 'independence', branch: 'poetry' },
  { name: 'Etimad Başkeçid', years: 'd. 1966', era: 'independence', branch: 'poetry' },
  { name: 'Həmid Herisçi', years: 'd. 1961', era: 'independence', branch: 'prose' },
  { name: 'Eldar İsgəndərzadə', years: 'd. 1964', era: 'independence', branch: 'poetry' },
  { name: 'Kənan Hacı', years: 'd. 1975', era: 'independence', branch: 'poetry' },
  { name: 'Faiq Balabəyli', years: 'd. 1964', era: 'independence', branch: 'poetry' },
  { name: 'Əli Rza Xələfli', years: 'd. 1953', era: 'independence', branch: 'poetry' },
  { name: 'Qəşəm İsabəyli', years: 'd. 1948', era: 'independence', branch: 'poetry' },
  { name: 'Çingiz Əlioğlu', years: '1944–2026', era: 'independence', branch: 'poetry' },
  { name: 'Mübariz Örən', years: 'd. 1967', era: 'independence', branch: 'prose' },
  { name: 'Rəşad Məcid', years: 'd. 1964', era: 'independence', branch: 'prose' },
  { name: 'Əli Əmirli', years: 'd. 1948', era: 'independence', branch: 'prose' },
  { name: 'Akif Əli', years: 'd. 1952', era: 'independence', branch: 'prose' },
  { name: 'Sevinc Nuruqızı', years: 'd. 1964', era: 'independence', branch: 'children' },
  { name: 'Çərkəz Məcid', years: '1937–1989', era: 'thaw', branch: 'poetry' },
  { name: 'Cəmil Əlibəyov', years: '1927–2014', era: 'thaw', branch: 'prose', note: '«Sınaq»' },
  { name: 'Aqşin Babayev', years: '1936–2020', era: 'thaw', branch: 'prose' },
  { name: 'Səyyad Aran', years: 'd. 1952', era: 'independence', branch: 'prose', note: '«Soyuq Günəş»' },
  // Third pass (2026-11-20): names neither on the site nor above, each checked on its az.wikipedia page
  { name: 'Şəfiqə Əfəndizadə', years: '1883–1959', era: 'mollanasreddin', branch: 'prose', note: 'İlk qadın publisistlərdən' },
  { name: 'Kərim Məşrutəçi Sönməz', years: 'd. 1928', era: 'south', branch: 'poetry' },
  { name: 'Cəlal Bərgüşad', years: '1924–1996', era: 'thaw', branch: 'prose' },
  { name: 'Şıxəli Qurbanov', years: '1925–1967', era: 'thaw', branch: 'prose', note: '«Sənsiz», «Əkizlər»' },
  { name: 'Tofiq Mahmud', years: '1931–1997', era: 'thaw', branch: 'children' },
  { name: 'Nurəngiz Gün', years: '1938–2014', era: 'thaw', branch: 'poetry' },
];

// ── placement ───────────────────────────────────────────────────────────────

export interface TreeAuthor {
  id: string;
  slug: string;
  nameAz: string;
  nameRu: string | null;
  nameEn: string | null;
  bornYear: number | null;
  bornYearApprox: boolean;
  diedYear: number | null;
  diedYearApprox: boolean;
  type: string;
  period: string | null;
  writingLangs: string[];
  works: number;
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
function roman(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], next = ROMAN[s[i + 1]] ?? 0;
    n += v < next ? -v : v;
  }
  return n;
}

/** The year an author was most active: born + 35 (not past death), else death − 15, else mid-century of `period` */
export function floruit(a: Pick<TreeAuthor, 'bornYear' | 'diedYear' | 'period'>): number | null {
  if (a.bornYear) return a.diedYear ? Math.min(a.bornYear + 35, a.diedYear) : a.bornYear + 35;
  if (a.diedYear) return a.diedYear - 15;
  const m = a.period?.match(/^([IVXL]+)/);
  if (m) return (roman(m[1]) - 1) * 100 + 50;
  return null;
}

export function placeAuthor(a: TreeAuthor): { era: EraKey; branch: BranchKey } {
  const o = PLACE[a.slug] ?? {};
  const year = floruit(a);
  let era: EraKey | undefined = o.era;
  let branch: BranchKey | undefined = o.branch;
  if (!era) {
    if (year == null) return { era: 'khanates', branch: branch ?? 'elsairleri' };
    era = (ERAS.find((e) => e.until != null && year < e.until) ?? ERAS[ERAS.length - 1]).key;
  }
  if (!branch) {
    const langs = a.writingLangs;
    const turkic = langs.some((l) => l.startsWith('AZ_'));
    if (a.type === 'FOLK') branch = 'folk';
    else if (/(^|\s)Aşıq(\s|$)/.test(a.nameAz)) branch = 'asiq';
    else if (!turkic && langs.includes('FA')) branch = 'persian';
    else if (!turkic && langs.includes('AR')) branch = 'arabic';
    else if (a.type !== 'POET') branch = 'prose';
    else branch = 'poetry';
  }
  return { era, branch };
}
