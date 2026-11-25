# Contributing

Kitabxana.az is part of [Azad Bilik](https://github.com/azadbilik), open knowledge about Azerbaijani culture and history. Issues and pull requests are welcome in Azerbaijani, English or Russian.

*Səhv, təklif və ya yeni mənbə? Azərbaycan, ingilis və ya rus dilində yazın.*

## Report a Mistake in a Text

Typos, missing lines, a wrong title or author: [open a "Text error" issue](https://github.com/azadbilik/kitabxana/issues/new?template=text-error.yml). Give the page link and what is wrong. If you have the printed book, the page number helps most.

## Suggest a Work, Author or Source

[Open a "Missing work or author" issue](https://github.com/azadbilik/kitabxana/issues/new?template=missing.yml) with the source: a book (publisher, year), a scan or a link. Texts and your own translations can also be sent through the site's [contribute form](https://kitabxana.az/contribute), which an editor checks against the source before publishing.

Before suggesting a text, check its rights in [CONTENT.md](CONTENT.md).

## Report a Bug

[Open a "Bug" issue](https://github.com/azadbilik/kitabxana/issues/new?template=bug.yml) with the page, what you did, what you expected and your browser or phone. For security problems, see [SECURITY.md](SECURITY.md) instead.

## Change the Code

1. Set up the project as in the [README](README.md#getting-started).
2. Make the change on a branch. Keep it to one thing.
3. Run the checks:
   ```bash
   pnpm check                     # types
   pnpm --dir apps/web lint
   pnpm --dir apps/web test
   pnpm --dir apps/api test
   pnpm --dir apps/web a11y       # accessibility, with the site running
   ```
4. Open a pull request saying what changed and why. Add a screenshot for anything visible.

Things to know before changing the site:

- **The reading page is the core.** Every work has its own URL and prev/next navigation in its collection.
- **Pages are cached at the edge for everyone.** Never set cookies on a page. Anything per reader loads in the browser.
- **Three languages.** Every visible string goes in `apps/web/messages/` for `az`, `ru` and `en`.
- **Accessible by default.** Pages must pass the a11y check in both themes, at phone width, and with large text.
- **Design.** Follow `apps/web/DESIGN.md`.

Changes merged to `main` deploy to kitabxana.az automatically once CI passes.
