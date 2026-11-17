# Kitabxana.az — Azerbaijani Cultural Heritage Portal

## Project structure
- **Monorepo** with pnpm workspaces
- `apps/api` — NestJS backend (port 4000)
- `apps/web` — Next.js 15 frontend (port 3000)
- `packages/shared` — Shared types and constants

## Commands
```bash
pnpm install                    # install all deps
pnpm services:up                # start Postgres (:5433) + Meilisearch (:7700) via docker compose
pnpm services:down              # stop them (data kept in named volumes)
pnpm dev                        # run both api + web in parallel
pnpm dev:api                    # run backend only
pnpm dev:web                    # run frontend only
pnpm db:generate                # prisma generate
pnpm db:migrate                 # prisma migrate dev
pnpm db:seed                    # seed database
pnpm build                      # build everything
pnpm check                      # typecheck every package (no build)
pnpm parse ocr-book --images <dir> --out <file.md> [--lang aze_cyrl]   # OCR scanned spreads (pNNN.jpg) with Tesseract into the data/proofread format; Cyrillic books are read with the Russian model and resolved to Latin by the site's word list; needs `brew install tesseract` and python3 with Pillow
pnpm parse ocr-book --images <dir> --out <file.md> --lang aze_cyrl --engine vlm   # same, read by a local vision model (Qwen3-VL-30B-A3B via mlx-vlm, ~12 s/page): ~7% word errors on Cyrillic verse vs ~22% for Tesseract; still proofread against the scans. Setup: `uv venv --python 3.12 ~/.local/share/irs-local-ocr && uv pip install --python ~/.local/share/irs-local-ocr/bin/python mlx-vlm` (or set OCR_VLM_PYTHON); the model (~17 GB) downloads on first use
pnpm parse ocr-book --images <dir> --out <file.md> --lang aze_yanalif --engine vlm --single   # 1922–39 Latin-alphabet prints (Halle MENAdoc): each word read every way its look-alike letters allow and the commonest modern form on the site kept; the model's raw pages are cached in <file>.vlm.json so a re-run only re-lays them out
pnpm parse scan-starts [--book anl-8289] [--dry-run]   # after importing a National Library book whose works share one page mark (a play by act, a novel by chapter): OCR the scan pages they span and find where each starts, so a work's PDF download is just its pages; rewrites apps/api/src/downloads/scan-starts.ts (commit it, rebuild the API). OCR'd pages are cached in packages/parser/data/raw/scan-ocr/psm<n>; needs tesseract, poppler, qpdf
```

## Stack
- **Backend**: NestJS 11, Prisma 6, PostgreSQL, Meilisearch, JWT auth
- **Frontend**: Next.js 15 (App Router), next-intl, React 19
- **Languages**: TypeScript throughout

## Key architecture decisions
- **Reading page** is the core experience — every work/poem has its own URL with prev/next navigation within collections
- **Parallel text** — works have translations (AZ, RU, FA, EN) rendered side-by-side or stacked
- **Markdown** for work body storage, rendered to HTML and cached in `bodyHtml`
- **`@@index([collectionId, order])`** on Work — the compound index powers prev/next queries
- **Translations**: several per language are allowed (different translators); `isDefault` marks the one shown first per work + language, and the first one added becomes the default. The reading page switches versions via `?tr=<id>`
- **Submissions** use a single table with JSON payload, type-discriminated
- **Reader accounts** (`apps/api/src/account`, `apps/api/src/library`): sign-in by emailed 6-digit code or Google, no passwords; the session is an HttpOnly cookie scoped to `/api`, so pages stay identical and edge-cacheable for everyone. All per-reader UI (saved, read marks, reading position, book want/reading/read, lists, shelf at `/refim`) loads in the browser (`apps/web/lib/account.ts`, `lib/library.ts`); writes need the `x-kitabxana: 1` header. A book's status follows its parts by the rules in `library/rules.ts` (`pnpm --dir apps/api test`). Mail and Google are off until `MAIL_API_KEY` / `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set
- **Work slugs** are readable (`fuzuli-qezel-7`). `Work.sourceId` is the stable import key (e.g. `ganjoor-116713`); renamed slugs go into `previousSlugs` and old URLs 308-redirect (middleware for legacy slugs, page fallback otherwise)

## i18n
- Three UI languages: az (default), ru, en
- next-intl for frontend routing: Azerbaijani has no prefix (`/works/...`), then `/ru/...`, `/en/...`. Build links with `localePath(locale, path)` from `apps/web/lib/i18n.ts`; old `/az/...` URLs 308 to the unprefixed path (middleware)
- Message files in `apps/web/messages/`

## Design
One design, **Nar**, in light and dark. Full system in `apps/web/DESIGN.md`.
- A bookshop you read in (LitRes-like, calmer): white pages, ink text, grey surfaces, one pomegranate `#A81E28`; Inter for the interface, Literata for titles and reading; books shown as generated covers (`components/works/BookCover.tsx`, six cloth colours by author) on shelves (`Shelf.tsx`)
- Base and shared components in `apps/web/styles/globals.css`; Nar's tokens and overrides in `apps/web/styles/nar.css`, every rule scoped `:root:where(:not([data-skin='gazette']))` (no added specificity)
- The old **Gazette** still renders underneath for developers only, no button: `localStorage.skin = 'gazette'; location.reload()` in the console (`localStorage.removeItem('skin')` to return). New components are designed for Nar and need only not break under it
- Theme via `[data-theme]` (OS preference until the reader chooses, `localStorage.theme`), set before paint with the gazette flag by the inline script in `app/layout.tsx`
- Pages never set cookies (HTML is edge-cached for everyone); anything per reader loads in the browser
