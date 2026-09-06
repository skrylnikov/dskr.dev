## 1. Red phase: executable acceptance tests

- [x] 1.1 Replace the placeholder root `test` script with the build-and-test command from `test-plan.md`; write `dskr.photos has the complete required catalog metadata` in `src/data/projects.test.ts`, run it, and confirm it fails because `dskr-photos` is absent
- [x] 1.2 Write `dskr.photos is appended after unchanged existing projects`, including exact baseline objects plus the required third slug; run it and confirm it fails because the third entry is absent
- [x] 1.3 Write `dskr.photos image resolves to the exact supplied PNG`, covering reference resolution, PNG signature, 1440×1000 IHDR dimensions, 1,537,484-byte length, and the required SHA-256; run it and confirm it fails because the entry/asset is absent
- [x] 1.4 Write `dskr.photos asset validation rejects missing or altered captures with the path`, requiring the real catalog entry before exercising missing, truncated, resized, and recompressed fixtures; run it and confirm it fails first because `dskr-photos` is absent
- [x] 1.5 Write `Russian home renders the dskr.photos preview and exact fragment link` in `src/pages/_projects.test.ts`; run it against freshly built output and confirm it fails because the preview is absent
- [x] 1.6 Write `English home renders only the English dskr.photos preview and exact fragment link`; run it and confirm it fails because the preview is absent
- [x] 1.7 Write `Russian projects renders the complete dskr.photos card`; run it and confirm it fails because `article#dskr-photos` is absent
- [x] 1.8 Write `English projects renders the complete English dskr.photos card`; run it and confirm it fails because `article#dskr-photos` is absent
- [x] 1.9 Write `existing project previews and cards remain on their route-specific surfaces`, including the dskr.photos precondition; run it and confirm it fails on that missing precondition before checking the existing-project mapping

## 2. Green phase: catalog and asset

- [x] 2.1 Implement the exact dskr.photos field values in `src/data/projects.ts` to pass test 1.1
- [x] 2.2 Place that record third, after byte-for-byte-equivalent existing `dskr-dev` and `phoronis` objects, to pass test 1.2
- [x] 2.3 Copy the supplied `dskr-photos.png` to `public/assets/dskr-photos.png` without transformation to pass test 1.3
- [x] 2.4 Complete the test-local asset integrity helper/fixtures so missing or altered content reports `/assets/dskr-photos.png` and test 1.4 passes without adding a production validator
- [x] 2.5 Use the shared record through the existing Russian home-page mapping, with no page-specific duplicate data, and run test 1.5 green
- [x] 2.6 Use the same shared record through the existing English home-page mapping, with no locale fallback, and run test 1.6 green
- [x] 2.7 Use the existing `ProjectCard.astro` rendering path and accepted `PERSONAL SITE` fallback for the Russian card, making only a minimal correction if the named assertions expose a mismatch; run test 1.7 green
- [x] 2.8 Use the same card path and fallback for the English card, preserving localized copy and external-link attributes; run test 1.8 green
- [x] 2.9 Confirm the shared append leaves the exact route-specific dskr.dev and Phoronis previews/cards intact, correcting only regressions introduced by this change; run test 1.9 green

## 3. Refactor phase: keep each scenario green

- [x] 3.1 Refactor the complete-metadata assertion and catalog addition for clarity; test 1.1 stays green
- [x] 3.2 Refactor the preservation baseline to avoid incidental source-format coupling; test 1.2 stays green
- [x] 3.3 Refactor PNG metadata/digest helpers without adding an image dependency; test 1.3 stays green
- [x] 3.4 Refactor failure fixtures to remain test-local and deterministic; test 1.4 stays green
- [x] 3.5 Refactor Russian home selectors to semantic, entry-scoped assertions; test 1.5 stays green
- [x] 3.6 Refactor English home selectors while retaining the no-Russian-copy assertion; test 1.6 stays green
- [x] 3.7 Refactor Russian card assertions to remain scoped to `article#dskr-photos`; test 1.7 stays green
- [x] 3.8 Refactor English card assertions to remain scoped to `article#dskr-photos`; test 1.8 stays green
- [x] 3.9 Refactor existing-project regression assertions without broad snapshots or unrelated markup counts; test 1.9 and the full suite stay green

## 4. Verification and browser QA

- [x] 4.1 Run `pnpm test`; confirm all nine test-plan entries pass with zero skipped, pending, or commented-out tests, then flip every ledger row from 🔴 red to 🟢 green
- [x] 4.2 Run `pnpm build` independently and confirm the production Astro build succeeds
- [x] 4.3 Run `openspec validate add-dskr-photos-project --strict --json` and `openspec validate --all --strict --json`; confirm both report zero issues
- [x] 4.4 Against the already-running development URL, inspect `/projects/` and `/en/projects/` at desktop and narrow viewport widths; confirm the screenshot is legible, the card layout remains responsive, both localized descriptions are correct, and source/live links open the intended destinations

## 5. Fix round: human acceptance feedback (routed by Lead)

- [x] 5.1 Red-first: write `the dskr.photos card shows the full uncropped screenshot` in `src/pages/_projects.test.ts` (asserts the dskr-photos contain rule in the built CSS plus preserved Phoronis/base rules); run it and confirm it fails because the dskr-photos rule is absent
- [x] 5.2 Add `.project-card--dskr-photos .project-visual > img { object-fit: contain; object-position: center; }` to `src/styles/blog.css` (mirrors the existing Phoronis slug-specific rule); PNG, catalog values, and other cards untouched; run the new test green
- [x] 5.3 Update artifacts for the presentation amendment (spec scenario, design decision, test-plan row); run the full suite, `pnpm build`, strict OpenSpec validation, and live desktop/narrow light/dark QA
