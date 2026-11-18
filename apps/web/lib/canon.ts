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
    title: { az: 'Kökler: şifahi dastan və ilk yazılar', ru: 'Корни: устный эпос и первые письмена', en: 'Roots: oral epic and the first writing' },
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
  'mikayil-rzaquluzade': { branch: 'children' },
};

/** What is still missing of an author the site has: titles, shown after "Not yet on the site" */
export const GAPS: Record<string, string> = {
  xalq: 'Bayatılar · nağıllar · atalar sözləri · laylalar · tapmacalar · «Əsli və Kərəm» · «Aşıq Qərib» · «Şah İsmayıl» · «Abbas və Gülgəz» · «Tahir və Zöhrə» · «Valeh və Zərnigar» · «Qaçaq Nəbi» · holavarlar · ağılar',
  nizami: 'Lirik divan (qəzəllər, qəsidələr, rübailər)',
  fuzuli: '«Rind və Zahid» · «Səhhət və Mərəz» · ərəbcə divan · «Mətləül-etiqad»',
  xetai: '«Dəhnamə» · «Nəsihətnamə»',
  'cahansah-heqiqi': 'Türkcə və farsca divanın çoxu',
  'sari-asiq': 'Bayatıların çoxu',
  talibov: '«Kitabi-Əhməd» · «Məsalikül-möhsinin»',
  vazeh: 'Şeirlərin çoxu; Bodenştedtin «Mirzə Şəfinin nəğmələri»',
  memmedquluzade: 'Hekayələrin çoxu · «Molla Nəsrəddin» felyetonları · «Kamança» · «Anamın kitabı» tam',
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
  { name: 'Mustafa Zərir', years: 'XIV əsr', era: 'sufi', branch: 'masnavi', note: '«Yusif və Züleyxa»' },
  { name: 'Şeyx Səfiəddin Ərdəbili', years: '1252–1334', era: 'sufi', branch: 'persian', note: 'Dübeytilər' },
  { name: 'Əbdülqadir Marağayi', years: '1353–1435', era: 'sufi', branch: 'persian', note: 'Musiqi risalələri' },
  { name: 'Fəzlullah Nəimi', years: '1340–1394', era: 'sufi', branch: 'persian', note: '«Cavidannamə»' },
  { name: 'Nəsir Bakuvi', years: 'XIV əsr', era: 'sufi', branch: 'persian' },
  { name: 'Seyid Yəhya Bakuvi', years: 'ö. 1464', era: 'sufi', branch: 'persian' },
  { name: 'Dədə Ömər Rövşəni', years: 'ö. 1487', era: 'sufi', branch: 'poetry' },
  // safavid
  { name: 'Məsihi', years: 'XVII əsr', era: 'safavid', branch: 'masnavi', note: '«Vərqa və Gülşa»' },
  { name: 'Tərzi Əfşar', years: 'XVII əsr', era: 'safavid', branch: 'poetry' },
  { name: 'Əmani', years: 'XVII əsr', era: 'safavid', branch: 'poetry' },
  { name: 'Fəzli', years: 'ö. 1605', era: 'safavid', branch: 'masnavi', note: 'Füzulinin oğlu' },
  { name: 'Sultan Məhəmməd', years: 'XVI əsr', era: 'safavid', branch: 'poetry' },
  // khanates
  { name: 'Mirzə Camal Cavanşir', years: '1773–1853', era: 'khanates', branch: 'chronicles', note: '«Qarabağ tarixi»' },
  { name: 'Mirzə Adıgözəl bəy', years: '1780–1848', era: 'khanates', branch: 'chronicles', note: '«Qarabağnamə»' },
  { name: 'Sayat Nova', years: '1712–1795', era: 'khanates', branch: 'asiq', note: 'Azərbaycanca divan' },
  { name: 'Məhcur Şirvani', years: 'XVIII əsr', era: 'khanates', branch: 'poetry' },
  // enlightenment
  { name: 'İsmayıl bəy Qutqaşınlı', years: '1806–1869', era: 'enlightenment', branch: 'prose', note: '«Rəşid bəy və Səadət xanım» (1835)' },
  { name: 'Həsən bəy Zərdabi', years: '1842–1907', era: 'enlightenment', branch: 'prose', note: '«Əkinçi»' },
  { name: 'Zeynalabdin Marağayi', years: '1838–1910', era: 'enlightenment', branch: 'prose', note: '«İbrahim bəyin səyahətnaməsi»' },
  { name: 'Mirzə Kazım bəy', years: '1802–1870', era: 'enlightenment', branch: 'prose' },
  { name: 'Mirzə Cəfər Topçubaşov', years: '1790–1869', era: 'enlightenment', branch: 'prose' },
  { name: 'Əsgər ağa Gorani', years: '1812–1910', era: 'enlightenment', branch: 'poetry' },
  { name: 'Mehdiqulu xan Vəfa', years: '1855–1900', era: 'enlightenment', branch: 'poetry', note: '«Məclisi-üns»' },
  { name: 'Qönçəbəyim', years: 'XIX əsr', era: 'enlightenment', branch: 'poetry', note: '«Məclisi-üns»' },
  { name: 'Mirzə Rəhim Fəna', years: 'XIX əsr', era: 'enlightenment', branch: 'poetry', note: '«Məclisi-üns»' },
  { name: 'Məhəmmədtağı Sidqi', years: '1854–1903', era: 'enlightenment', branch: 'prose' },
  { name: 'Mirzə Ağa Təbrizi', years: 'XIX əsr', era: 'enlightenment', branch: 'prose', note: 'İlk pyeslər fars dilində' },
  { name: 'Eynəli bəy Sultanov', years: '1866–1935', era: 'enlightenment', branch: 'prose' },
  // mollanasreddin
  { name: 'Seyid Hüseyn', years: '1887–1938', era: 'mollanasreddin', branch: 'prose' },
  { name: 'Tağı Şahbazi Simurq', years: '1892–1938', era: 'mollanasreddin', branch: 'prose' },
  { name: 'Hacı Kərim Sanılı', years: '1876–1937', era: 'mollanasreddin', branch: 'poetry' },
  { name: 'Əbdülxaliq Cənnəti', years: '1855–1931', era: 'mollanasreddin', branch: 'poetry' },
  { name: 'Salman Mümtaz', years: '1884–1941', era: 'mollanasreddin', branch: 'poetry', note: '«El şairləri»nin tərtibçisi' },
  { name: 'Ağadadaş Müniri', years: '1876–1938', era: 'mollanasreddin', branch: 'poetry' },
  // soviet
  { name: 'Mikayıl Rəfili', years: '1905–1958', era: 'soviet', branch: 'poetry' },
  { name: 'Əhməd Cəmil', years: '1913–1977', era: 'soviet', branch: 'poetry' },
  { name: 'Əbülhəsən', years: '1906–1986', era: 'soviet', branch: 'prose' },
  { name: 'Qılman İlkin', years: '1914–2004', era: 'soviet', branch: 'prose' },
  { name: 'Aşıq Şəmşir', years: '1893–1980', era: 'soviet', branch: 'asiq' },
  { name: 'Teymur Elçin', years: '1924–1992', era: 'soviet', branch: 'children' },
  // emigration
  { name: 'Ceyhun Hacıbəyli', years: '1891–1962', era: 'emigration', branch: 'prose' },
  { name: 'Mirzə Bala Məmmədzadə', years: '1898–1959', era: 'emigration', branch: 'prose' },
  { name: 'Banin (Ümmülbanu)', years: '1905–1992', era: 'emigration', branch: 'prose', note: '«Jours caucasiens»' },
  { name: 'Qurban Səid', years: '1937', era: 'emigration', branch: 'prose', note: '«Əli və Nino»' },
  { name: 'Əhməd bəy Ağaoğlu', years: '1869–1939', era: 'emigration', branch: 'prose' },
  // south
  { name: 'Səhənd (Bulud Qaraçorlu)', years: '1926–1979', era: 'south', branch: 'poetry', note: '«Sazımın sözü»' },
  { name: 'Mədinə Gülgün', years: '1926–1991', era: 'south', branch: 'poetry' },
  { name: 'Balaş Azəroğlu', years: '1921–2011', era: 'south', branch: 'poetry' },
  { name: 'Səməd Behrəngi', years: '1939–1967', era: 'south', branch: 'children', note: '«Balaca qara balıq»' },
  { name: 'Rza Bərahəni', years: '1935–2022', era: 'south', branch: 'persian' },
  { name: 'Əli Tudə', years: '', era: 'south', branch: 'poetry' },
  // thaw
  { name: 'Anar', years: 'd. 1938', era: 'thaw', branch: 'prose', note: '«Beşmərtəbəli evin altıncı mərtəbəsi»' },
  { name: 'Elçin', years: 'd. 1943', era: 'thaw', branch: 'prose', note: '«Ölüm hökmü»' },
  { name: 'Əkrəm Əylisli', years: 'd. 1937', era: 'thaw', branch: 'prose' },
  { name: 'Sabir Əhmədli', years: '1930–2009', era: 'thaw', branch: 'prose' },
  { name: 'Mövlud Süleymanlı', years: 'd. 1945', era: 'thaw', branch: 'prose' },
  { name: 'Fərman Kərimzadə', years: '1937–1989', era: 'thaw', branch: 'prose', note: '«Xudafərin körpüsü»' },
  { name: 'İsi Məlikzadə', years: '1934–2012', era: 'thaw', branch: 'prose' },
  { name: 'Musa Yaqub', years: '1937–2023', era: 'thaw', branch: 'poetry' },
  { name: 'Məmməd İsmayıl', years: 'd. 1939', era: 'thaw', branch: 'poetry' },
  { name: 'Ramiz Rövşən', years: 'd. 1946', era: 'thaw', branch: 'poetry' },
  { name: 'Vaqif Bayatlı Odər', years: 'd. 1950', era: 'thaw', branch: 'poetry' },
  { name: 'Maqsud İbrahimbəyov', years: '1935–2016', era: 'thaw', branch: 'russian' },
  { name: 'Rüstəm İbrahimbəyov', years: '1939–2023', era: 'thaw', branch: 'russian' },
  { name: 'Çingiz Hüseynov', years: '1929–2023', era: 'thaw', branch: 'russian' },
  { name: 'Nəriman Həsənzadə', years: 'd. 1931', era: 'thaw', branch: 'poetry' },
  { name: 'Sabir Rüstəmxanlı', years: 'd. 1946', era: 'thaw', branch: 'poetry' },
  { name: 'Əliağa Kürçaylı', years: '1928–1980', era: 'thaw', branch: 'poetry' },
  { name: 'Tofiq Bayram', years: '1934–1991', era: 'thaw', branch: 'poetry' },
  { name: 'Söhrab Tahir', years: '1926–2016', era: 'thaw', branch: 'poetry' },
  { name: 'Fikrət Sadıq', years: '1930–2020', era: 'thaw', branch: 'poetry' },
  { name: 'Nüsrət Kəsəmənli', years: '1946–2001', era: 'thaw', branch: 'poetry' },
  { name: 'Əzizə Cəfərzadə', years: '1921–2003', era: 'thaw', branch: 'prose' },
  { name: 'Hüseyn Abbaszadə', years: '', era: 'thaw', branch: 'prose' },
  { name: 'Qəşəm Nəcəfzadə', years: '', era: 'thaw', branch: 'children' },
  { name: 'Zahid Xəlil', years: '', era: 'thaw', branch: 'children' },
  // independence
  { name: 'Kamal Abdulla', years: 'd. 1950', era: 'independence', branch: 'prose', note: '«Yarımçıq əlyazma»' },
  { name: 'Afaq Məsud', years: 'd. 1957', era: 'independence', branch: 'prose' },
  { name: 'Aqil Abbas', years: 'd. 1959', era: 'independence', branch: 'prose' },
  { name: 'Natiq Rəsulzadə', years: 'd. 1949', era: 'independence', branch: 'prose' },
  { name: 'Rafiq Tağı', years: '1950–2011', era: 'independence', branch: 'prose' },
  { name: 'Seymur Baycan', years: 'd. 1977', era: 'independence', branch: 'prose' },
  { name: 'Şərif Ağayar', years: 'd. 1974', era: 'independence', branch: 'prose' },
  { name: 'Səlim Babullaoğlu', years: 'd. 1972', era: 'independence', branch: 'poetry' },
  { name: 'Salam Sarvan', years: 'd. 1974', era: 'independence', branch: 'poetry' },
  { name: 'Aqşin Yeniseyli', years: '', era: 'independence', branch: 'poetry' },
  { name: 'Elçin Hüseynbəyli', years: 'd. 1961', era: 'independence', branch: 'prose' },
  { name: 'Çingiz Abdullayev', years: 'd. 1959', era: 'independence', branch: 'russian' },
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
