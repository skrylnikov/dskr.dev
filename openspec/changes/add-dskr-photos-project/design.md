## Context

The portfolio is intentionally data-driven. `src/data/projects.ts` defines one typed `Project[]`; both locale home pages map it into linked previews, and both locale project pages map it through `ProjectCard.astro`. A project record supports a source URL, optional live URL and image, stack labels, and Russian/English copy. `ProjectCard.astro` renders supplied images with the shared responsive card styles and supplies `PERSONAL SITE` as the existing eyebrow fallback for every non-Phoronis slug, so dskr.photos needs no new component or route.

Repository and live-product research resolved the content details. The existing `photo-lib-part-1.mdx` article identifies dskr.photos as the deployed Photo lib demo and links `https://github.com/skrylnikov/photo-lib` as its source. The live site returned HTTP 200 and its current bundle identifies React; the current public repository identifies React 19, TypeScript, Vite 8, Fastify 5, and SQLite. The supplied 1440×1000 PNG shows the current `dskr.photos` landing page with album selections including “Московский зоопарк” and “Парад ретротранспорта”.

The root package currently has a placeholder failing `test` script, while `pnpm build` is the existing Astro integration check. The repository already depends on `tsx` and `linkedom`, which are sufficient for focused TypeScript tests and static build-output inspection without adding dependencies.

## Goals / Non-Goals

**Goals:**

- Represent dskr.photos through the existing shared project-data contract.
- Publish the supplied screenshot unchanged as the representative card image.
- Provide concise, stable Russian and English descriptions.
- Preserve existing project order and behavior while making the new project discoverable on all four affected routes.
- Add deterministic coverage for data, asset integrity, and rendered localized output.

**Non-Goals:**

- Redesign the projects page, card component, responsive image treatment, or navigation.
- Change dskr.photos itself or reproduce its albums inside dskr.dev.
- Add new dependencies, an image optimization pipeline, or a browser end-to-end framework.
- Update unrelated About-page prose or other portfolio content.

## Decisions

### Append one record to the shared catalog

Add dskr.photos as the third `Project` in `src/data/projects.ts`. This preserves the existing order and automatically feeds the four current consumers. Use `dskr-photos` as the slug because it is URL-fragment-safe and matches the established kebab-case convention.

The card intentionally retains the existing `PERSONAL SITE` eyebrow. Within the current component this is the established category for non-bot personal web properties, and accepting it keeps this catalog-only change narrow. Rendered-output coverage will assert the exact label so the behavior is explicit rather than accidental.

Rejected alternatives:

- Hand-code cards in the locale pages: duplicates existing rendering logic and can make locales diverge.
- Create a dedicated dskr.photos component or route: the existing project rendering path already supplies every required card element, including the accepted fallback eyebrow.
- Add a new eyebrow field or another slug conditional: increases the shared model or renderer complexity for a label whose existing fallback is acceptable here.
- Insert the project ahead of current entries: unnecessarily changes established presentation order.

### Treat photo-lib as the source project

Use `https://github.com/skrylnikov/photo-lib` for the source link and `https://dskr.photos` for the live link. This relationship is stated in the repository's existing Photo lib article and in the source repository README. Present the current representative stack as `React`, `TypeScript`, `Vite`, `Fastify`, and `SQLite`; it covers the public UI, build tooling, API, and storage without overcrowding the card with every library.

Rejected alternatives:

- Link a guessed `dskr.photos` repository: that public repository does not exist.
- Omit the source link or make `github` optional: unnecessary because an authoritative public source is known, and it would expand the shared data/component contract.
- Include every infrastructure/library dependency: produces a noisy card and departs from the concise stack convention.

### Preserve the supplied screenshot byte-for-byte

Copy the supplied capture to `public/assets/dskr-photos.png` without recompression, resizing, or format conversion. The existing `/assets/...` convention makes it directly deployable. Record size, dimensions, and SHA-256 in the spec so implementation cannot silently substitute a stale or lossy image.

*Fix-round update (human acceptance feedback):* the base card rule's `object-fit: cover` cropped the 1440×1000 capture in the card's visual box. Following the Lead-routed fix, the dskr.photos card now renders the image with `object-fit: contain; object-position: center` — the same slug-specific pattern the existing Phoronis card already uses — so the full capture stays visible. The base cover rule and the Phoronis rule are untouched, and the PNG itself is never cropped or transformed.

Rejected alternatives:

- Reuse the older `photo-lib-part-1` article hero: it is not the requested current site screenshot.
- Convert to AVIF or crop before committing: saves bytes but violates fidelity to the supplied capture and adds subjective image-processing choices.
- Hotlink dskr.photos assets: couples the portfolio to remote filenames, availability, and cross-origin behavior.

### Use stable bilingual copy rather than album-count claims

Use exact short descriptions about curated images from trips, walks, and city events. This describes the product visible in the supplied capture without encoding album names or counts that can quickly become stale.

Rejected alternatives:

- List all current albums or exact photo counts: accurate only for the capture date and likely to age poorly.
- Reuse the 2023 article's “self-hosted Google Photos” framing: describes a broader technical ambition rather than the public visitor experience.

### Test the data boundary and generated HTML

Replace the placeholder root test command with a build followed by focused `tsx --test` files. A catalog test will assert the exact dskr.photos record, unchanged preceding records, and PNG signature/size/dimensions/digest; it will also exercise failing fixtures so missing or altered image paths are reported. A rendering test will parse the generated HTML with the existing `linkedom` dependency. It will assert titles, descriptions, and exact locale-relative fragment links only on `/` and `/en/`; it will assert the card article, `PERSONAL SITE` eyebrow, image, ordered stack, and external-link attributes only on `/projects/` and `/en/projects/`. Existing-project regression checks use the same explicit route-to-element mapping.

Rejected alternatives:

- Rely only on `pnpm build`: compilation does not prove the new entry's content or rendered links.
- Add Playwright screenshots: no root browser-test setup exists, and static output assertions cover this data-only change more deterministically.
- Assert source text with grep: couples tests to formatting and does not verify Astro's localized output.

## Risks / Trade-offs

- **The 1.5 MB PNG increases repository and page-transfer size** → retain it because the user explicitly requested the captured screenshot; lazy loading already limits transfer until the card approaches the viewport.
- **Exact screenshot digest makes intentional future replacement fail tests** → update the asset expectation deliberately alongside a future catalog-image change.
- **Live-site content and technology can evolve** → keep user-facing copy product-focused and treat stack labels as a concise snapshot; future maintenance is a simple data edit.
- **Static HTML assertions can be brittle if markup is redesigned** → select semantic anchors and exact user-visible requirements rather than broad snapshots.
- **The card image has empty alternative text under the existing decorative-image convention** → preserve current accessibility behavior; changing image semantics across cards is outside this request.

## Migration Plan

1. Add failing catalog, asset-integrity, and rendered-route tests, including failure fixtures.
2. Copy the supplied capture to `public/assets/dskr-photos.png` unchanged.
3. Append the specified dskr.photos record to `src/data/projects.ts`.
4. Replace the root placeholder test script with the deterministic build-and-test command.
5. Run the focused tests, `pnpm build`, and the OpenSpec validation commands from the test plan.
6. Perform browser QA against the already-running development URL at desktop and narrow viewport sizes, confirming the card image and both localized routes.

Rollback is a normal source revert: remove the third catalog entry, screenshot, and focused tests/script change. No database or deployment migration is involved.

## Open Questions

None. The source repository, live URL, representative stack, supplied screenshot, copy, ordering, and locale behavior are resolved from the issue, repository, and live-site research.
