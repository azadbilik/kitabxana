---
name: Kitabxana.az
description: Azerbaijani literary heritage as a bookshop you read in — shelves of books, the original beside its translation. One design ("Nar"), light and dark.
colors:
  white: "#FFFFFF"
  ink: "#16181D"
  muted: "#5A5F6B"
  rule: "#E8E9EC"
  control: "#868B96"
  surface: "#F4F5F7"
  surface-deep: "#E9EBEF"
  tint: "#FBF1F1"
  pomegranate: "#A81E28"
  pomegranate-deep: "#7F141C"
  dark-bg: "#121317"
  dark-ink: "#ECEDEF"
  dark-muted: "#A3A7B0"
  dark-rule: "#2A2C33"
  dark-surface: "#1D1F25"
  dark-surface-deep: "#272A31"
  dark-tint: "#2A1719"
  dark-pomegranate: "#F26D72"
  dark-pomegranate-fill: "#C22A35"
  cloth-red: "#6E1626"
  cloth-navy: "#1F3A5F"
  cloth-green: "#2F5D50"
  cloth-plum: "#4A2C4F"
  cloth-sand: "#E9E2D5"
  cloth-ochre: "#D9A441"
  read: "#2F6B4F"
  dark-read: "#7CC9A4"
typography:
  display:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  wordmark:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.6rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  reading:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.8
  interface:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.45
  note:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  fine:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 500
    lineHeight: 1.3
  subhead:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  lead:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.6
  title-large:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.25
  display-phone:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
  display-work:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.15
  display-feature:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.1
  title-feature:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  arabic:
    fontFamily: "Noto Naskh Arabic, Amiri, Geeza Pro, serif"
    fontSize: "1.26rem"
    fontWeight: 400
    lineHeight: 2.1
  reading-literary:
    fontFamily: "Alegreya, Georgia, serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.95
rounded:
  mark: "3px"
  focus: "6px"
  cover: "8px"
  control: "12px"
  card: "16px"
  feature: "20px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "1rem"
  md: "1.5rem"
  lg: "2.75rem"
  xl: "3.5rem"
  reading-measure: "36rem"
  verse-measure: "48rem"
  parallel-measure: "64rem"
  container: "80rem"
components:
  button-primary:
    backgroundColor: "{colors.pomegranate}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "0 1.6rem"
  button-primary-hover:
    backgroundColor: "{colors.pomegranate-deep}"
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  search-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  search-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  pill-active:
    backgroundColor: "{colors.pomegranate}"
    textColor: "{colors.white}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  feature-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.feature}"
  poem-card:
    backgroundColor: "{colors.tint}"
    rounded: "{rounded.feature}"
  book-cover:
    rounded: "{rounded.cover}"
---

# Design System: Kitabxana.az

## Overview

**Creative North Star: "A Bookshop You Read In"**

Kitabxana.az looks like a good online bookshop — white pages, a big search bar, shelves of covers — but everything on the shelves is free to read, and the reading page is quieter than any shop's. The design is called **Nar** (pomegranate): one red, used sparingly, on white.

The text comes first. A poem is set large in a serif at a comfortable measure, the original sits beside its translation, Persian is set right to left in a real Naskh face, and provenance sits under every text. The shop grammar (shelves, covers, a catalogue button) is for finding things; once a reader opens a text, the chrome steps back.

**Key characteristics**
- White page, ink text, grey surfaces, one pomegranate red.
- Inter for the interface and section heads; Literata for anything with a title or meant to be read.
- Books shown as **generated covers**: no images, a cloth colour and a stamped motif per book, the title in the book serif.
- Flat. Grouping by grey surfaces and space, not by lines or ornaments. Only floating panels cast a shadow.
- Light and dark themes (`data-theme`, from the OS until the reader chooses, set before paint).

**Files.** `styles/globals.css` holds the base rules and every shared component; `styles/nar.css` holds the design itself (tokens and restyling). Rules in `nar.css` start with `:root`, so they outrank the base rule for the same selector. The three faces are self-hosted through `next/font` in `app/layout.tsx`.

**The Gazette is gone.** The previous design, a Molla Nasraddin–era literary gazette, was removed in November 2026 (its switch, fonts, markup and unused rules). Some base rules in `globals.css` still carry its values underneath Nar's; fold them in when touching a component.

## Colors

### Accent
- **Pomegranate** (#A81E28, 7.3:1 on white; white on it 7.3:1) is the only accent. It fills the catalogue button, the primary button ("Start reading", "Read on"), the active pill and tab, and the current section's underline. It colours links that are actions ("See all", the author on a book page), the wordmark's `.az`, and titles on hover. **Pomegranate Deep** (#7F141C, `--pomeg-fill-hover`) is the hover of every red fill in both themes; `--pomeg-dark` is a text colour (light pink in dark theme) and never goes under white text. In dark theme the text accent is #F26D72 (red rather than pink; 4.9:1 or better on every dark surface) and fills lift to #C22A35 (3.3:1 against the dark page, white on it 5.7:1), with #A81E28 as their hover.
- **Tint** (#FBF1F1; dark #2A1719) is the accent's soft surface: the poem-of-the-day card, the reader's current place, and a couplet a link points at.

### Neutral
- **White** page, **Ink** text (#16181D), **Muted** (#5A5F6B, 6.4:1) for authors under titles, counts, labels and captions.
- **Surface** (#F4F5F7) and **Surface Deep** (#E9EBEF): cards, pills, contents rows, the browse band; deep is their hover.
- **Rule** (#E8E9EC): the header's bottom line and the rare divider. **Control** (#868B96, 3.4:1; dark #6E737D, 3.9:1): the edge of every field (inputs, selects, the phone's language control) and of inactive controls such as unread markers. A field is never told from the page by a grey fill alone. Placeholders are Muted, never the browser's grey.
- Dark theme: near-black page #121317, ink #ECEDEF, muted #A3A7B0, surfaces #1D1F25 / #272A31.
- **Read** (#2F6B4F, `--read`; as a mark on the dark page #7CC9A4, `--read-ink`): the one state colour, for a part the reader has marked read. It is a state, not an accent: it never colours an action.

### Cloths (covers only)
Six cover colours, picked from a hash of the book's id, so one author's books differ and a shelf or the books index never reads as a wall of one colour; on a shelf a book that would match its neighbour moves on one cloth (`clothSequence`): wine #6E1626 (deliberately not the accent's red: a red cover beside the red catalogue button read as a second accent), navy #1F3A5F, green #2F5D50, plum #4A2C4F (white text), sand #E9E2D5, ochre #D9A441 (ink text). They never appear outside a cover. Ink on sand and ochre is the page's Ink (#16181D). Every cover carries a 1px inset edge mixed from the page's ink (14%), because plum and navy on the dark page, and sand on the white one, are within 1.6:1 of it.

### Named rules
**The One Red Rule.** Pomegranate is the only accent; it goes on the one primary action, the one active choice in a group, and action links. No second accent hue. Cloths are not accents.

**The No Black Rule.** Black appears only as alpha: the masks that fade folded text and the nav strip, the shade of a cover's spine, and `--shadow-pop`. No surface or text is ever #000.

**The Surface Rule.** Things are grouped by grey surfaces and space, never by lines or ornaments.

## Typography

- **Inter** — interface: header, nav, buttons, pills, section heads ("New on the shelves"), card titles, labels.
- **Literata** — the wordmark, page titles (book, work, author, poet of the week), cover titles, body text and reading text.
- **Noto Naskh Arabic** (falls back to Amiri) — every Arabic-script text, at 1.2× with taller leading.
- Reader-chosen reading faces stay: Book (Literata), Literary (Alegreya), Sans (Inter), System (`system-ui`).

Every reading face carries Ə/ə (U+018F/U+0259). Inter, Literata and Naskh are self-hosted through `next/font` (`app/layout.tsx`). Literata is loaded by weight only, without its optical-size axis (about 100 KB a page for a difference found only by overlaying screenshots). Only the upright Latin and Latin Extended files of Inter and Literata are preloaded; Literata's italic, the Cyrillic files and Naskh load when a page has text that needs them.

### Hierarchy
- **Display** (Literata 700, 2.75rem; 2.1rem under 768px): book, work and author titles.
- **Headline** (Inter 700, 1.5rem, sentence case): section and shelf heads.
- **Title** (Inter 600, 1rem): titles under covers, contents rows.
- **Body / Reading** (Literata): bios, descriptions, the text of a work.
- **Label** (Inter 400, 0.875rem, muted, sentence case): authors under titles, counts, small headings over groups.
- **Small steps** (Inter): caption 0.8rem (meta lines, legends), note 0.75rem (counts, years), fine 0.7rem (the smallest label; tabular figures). Nothing below 0.7rem except text on a cover, which scales with the cover.
- **In-between steps**: subhead 1.125rem (card and group titles), lead 1.2rem (opening lines, Arabic-script card text), title-large 1.375rem (group heads, the original-script title), 1.75rem (a title inside a feature card: continue reading, the contact address), 2rem (titles and the catalogue's figures; every large title on phones), 2.5rem (the work title and plain page titles), 3rem (the poet of the week's name). A size between two steps is drift: take the nearer step.

**The Sentence Case Rule.** No tracked uppercase anywhere except the author line on a cover.

**The Two Scripts Rule.** Arabic-script text (`:lang(fa)`, `:lang(ar)`, `:lang(az-Arab)`) always gets the Naskh face, 1.2× size, taller leading and `dir="rtl"`, wherever it appears: reading column, cover, card, breadcrumb, contents row.

## Layout

Container up to 80rem with 1.5rem side padding (1rem on phones).

- **Header** (sticky, white, a rule below): row one is the wordmark, the red **Kataloq** button (to the books index), the search field with a black **Axtar** button, then language and theme. Row two is the section links (Poets, Writers, Playwrights, Philosophers, Works, Ghazals, Prose, Random, Contribute); the current one is red with a 2px underline. Under 900px the search takes its own row; under 600px the catalogue button joins the search row and the tools share the wordmark's row. The section row scrolls sideways on phones. It hides on scroll down under 1,119px.
- **Home**: a hero row (poet of the week on grey, 3fr; poem of the day on tint, 2fr; stacked under 900px), then shelves — New on the shelves, Classical heritage, Novels and stories, Plays — then a grey browse band (themes, centuries, forms) and the catalogue tiles. Signed-in readers will get "Continue reading" and their own shelf here.
- **Shelf**: a head (title, "See all") and one row of up to six covers on wide screens, scrolling sideways below that; a full shelf grid elsewhere (`repeat(auto-fill, minmax(9.5rem, 1fr))`, two columns on phones). Under each cover: title (two lines), author, a muted note.
- **Book page** (`/collections/<slug>`): breadcrumb (Books › author › book), a 15rem cover beside the title, author, fact pills (kind, year, century, language where it isn't Azerbaijani, number of parts), the description — or, where a book has none, its first lines on a grey card ("How it begins"; plays get none; in the reader's language where the first part is translated, with the original beneath) — the primary "Start reading", downloads; then contents as a grid of grey rows (a numbered circle, title, form), left out for a one-part book; then the author's other books.
- **Author page** (`/authors/<slug>`): breadcrumb (Authors › name), a 9rem round portrait with its credit beside the name, dates · kind · century, language pills and the bio — folded to five lines behind "Read more" when long (a checkbox and CSS; the whole text is always in the page) — with its source line and downloads; then the shelf of the author's books, manuscripts and miniatures, and the works that belong to no book as compact grey rows (thirty at most, the rest behind a link to the filtered works index). The works of a book are listed on the book's page only.
- **Authors index** (`/authors`): kind and century pills, the alphabet strip, then who is shown (authors with more than one work by default; "Everyone" adds the single-poem attributions) and the order (by number of works, or A–Z). Cards carry a 3.5rem round portrait at the right edge where there is one. Letter, everyone and re-sorted views are `noindex`.
- **Works index** (`/works`): genre, form and order pills (most read — one work per author in turn; by year; A–Z) over work cards; re-sorted views are `noindex`.
- **Books index** (`/collections`): genre, century and sort pills over a cover grid, paged by 36. Filtered and re-sorted views are `noindex`.
- **Reading measures**, unchanged: 36rem single column, 48rem Persian verse, 64rem parallel text. Wider layouts belong to indexes, never to reading.

Breakpoints: 480px (phones), 600px (header rows), 768px (stacking, single-column parallel text), 900px (hero and header), 960px / 60rem (side-by-side Persian couplets), 1100px (six-up shelves). On `pointer: coarse` targets grow to 2.75rem.

## Covers

`components/works/BookCover.tsx`. A 2:3 block: author (Inter, uppercase, two lines at most) at the top, the title (Literata 700) in the middle, the kind ("Roman", "Şeir") at the foot, a darker spine down the left edge with a light crease beside it, and a faint blind-stamped frame inside the board. Between author and title sits one of four small motifs in the cloth's own ink (a rule, three dots, the eight-pointed star between rules, an arch), picked by the book like the cloth; small covers leave it out. The cover is a size container: its padding is in % of its width and its type in `cqi`, so one rule serves shelf, index and book-page sizes. The title size is computed from the title's length and its longest word so that no word is ever split and the title fits in six lines. Arabic-script titles switch to Naskh, tagged with the book's own language (`fa`, `ar`, `az-Arab`; `lib/script.ts`). Covers are decorative (`aria-hidden`); the link around them carries the title and author as text.

**Generic titles.** A third of the books are titled by their kind — «Şeirlər» alone heads 235, then «Qəzəllər», «Qoşmalar», «Hekayələr», «Divan»… — so a shelf of them read as one word repeated. Such a cover is stamped the other way round: the title takes the small uppercase line at the top and the author's name the large serif line, and under the cover the name leads and the title follows. The set of generic titles is a short list in `BookCover.tsx` (`isGenericTitle`), derived from the database: a title shared by three or more authors, plus its Russian and English equivalents. The swap is switched off (`sameAuthor`) where every book is by one author — the author's own shelf and "more by the author" — since there the name would be the repeated word; those shelves also leave the author line out under the covers. Cloth, motif and seed are unaffected.

## Elevation

Flat. Hover on cards and rows is a tone step (surface → surface deep); a cover lifts 3px on hover (none with reduced motion). Only floating panels — the reading appearance popover, menus — cast `--shadow-pop`.

## Components

- **Buttons**: primary is red, 12px radius, white text, min-height 3rem on book pages; default is grey. **Pills**: grey 999px, active red. **Search**: 2px ink border, 12px radius, joined to the black button; focus turns the border red.
- **Cards**: grey, 16px radius. Feature cards (poet of the week, poem of the day, browse band) 20px.
- **Contents rows**: grey 12px rows with a numbered circle; the circle is where read / current marks will go. A title that repeats the book's is shortened for display ("Leyli və Məcnun, fəsil 20" → "Fəsil 20"), and a poem's row carries its first line (Literata, one line, in the reader's language where translated) so parts can be told apart; the form line is dropped where every row would say the same.
- **Breadcrumb**: muted Inter, › separators, current page bold ink.
- **Footer**: a deep-grey band: wordmark, the site's description, bold links.

### Reading page (signature)
Unchanged in structure (`components/reading/ReadingView.tsx`): breadcrumb, centred title in Literata, original-script title beneath, meta, glossary toggle; verse by beyt with hanging misras; parallel text lined up beyt by beyt; folding of long poems; paged prose with progress bar, remembered place and contents; provenance under every text; tags, share, prev/next, more by the author, the other-poets band; print styles. Nar restyles its chrome only.

- **Lines have addresses.** Every couplet of the original has an id (`#b7`); verse outside couplets has one per line (`#l12`). A link to one opens a folded poem, brings the line to the middle of the screen and sets it on Tint (`lib/verse.ts`, `ReadingView`). The translation carries no ids: it lines up beside the original.
- **Margin numbers** are the reader's choice (Aa › Numbers, off by default): every fifth couplet or line, in muted Inter outside the text's start edge, each a link to its line. The figure is drawn from `data-n`, so it is never copied or read out with the verse.
- **On phones** the path, title block and toolbar sit 0.75rem apart, so the first lines of a poem start about halfway up the first screen, not below it.

## Do's and Don'ts

### Do
- Write each component once against the shared custom properties (`--bg`, `--ink`, `--muted`, `--surf`, `--surf-2`, `--tint`, `--pomeg`, `--pomeg-fill`, `--rule`, `--control`) in `globals.css`; put Nar-only shape in `nar.css` under its scope.
- Check every surface in light and dark, at desktop and 375px, in az, ru and en.
- Give Arabic-script text its Naskh face, size, leading, `lang` and `dir` in every component that can show it.
- Use inline SVG icons (18px, 1.6–1.8 stroke, `aria-hidden`) and label the control.
- Keep Russian and English pages language-strict: shelves there list only books titled in that language.

### Don't
- Don't add a second accent colour, or use cloth colours outside covers.
- Don't add shadows to cards, tiles or buttons.
- Don't bring back Gazette devices in Nar: ◆ ornaments, double rules, ivory, tracked uppercase labels.
- Don't widen reading text past 36rem / 48rem / 64rem.
- Don't set new interface text below 0.7rem, or at a size between two documented steps.
- Don't let a page set cookies: HTML is edge-cached for everyone (see the Cloudflare cache rule); per-reader state loads in the browser.
- Don't rename a public filter URL word (`muellif-`, `janr-`, `forma-`, `esr-`, `sairler`…).
