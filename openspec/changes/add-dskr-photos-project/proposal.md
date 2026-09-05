## Why

The projects catalog currently omits dskr.photos even though it is an active, publicly reachable photo-gallery project. Adding it with an up-to-date screenshot and concise bilingual copy makes the portfolio complete on both localized home and projects pages.

## What Changes

- Add dskr.photos to the shared project data with its live URL, public source repository, representative technology stack, and short Russian and English descriptions.
- Add the supplied current homepage screenshot as the project's card image.
- Ensure the existing data-driven Russian and English home previews and project lists expose the new entry and links without regressing existing projects; its project card intentionally uses the renderer's existing `PERSONAL SITE` eyebrow.
- Add focused automated coverage for the catalog entry, image asset, localization, and rendered routes.

## Capabilities

### New Capabilities

- `project-catalog`: Defines how dskr.photos is represented and rendered in the localized portfolio catalog.

### Modified Capabilities

None; the repository has no existing main OpenSpec capability specs.

## Impact

- `src/data/projects.ts`: one new project record and bilingual copy.
- `public/assets/`: one checked-in screenshot asset derived from the supplied capture.
- Existing consumers in `src/pages/index.astro`, `src/pages/en/index.astro`, `src/pages/projects.astro`, `src/pages/en/projects.astro`, and `src/components/ProjectCard.astro` render the added data without a new page architecture or component change; the existing non-Phoronis fallback supplies the required `PERSONAL SITE` eyebrow.
- Focused tests and the root test command may be introduced or updated so the behavior is mechanically verifiable.
- No API, database, dependency, or breaking compatibility changes are expected.
