## ADDED Requirements

### Requirement: dskr.photos catalog metadata

The shared project catalog SHALL contain exactly one dskr.photos entry after the existing dskr.dev and Phoronis entries. The entry MUST use slug `dskr-photos`, source URL `https://github.com/skrylnikov/photo-lib`, live URL `https://dskr.photos`, image URL `/assets/dskr-photos.png`, and stack labels `React`, `TypeScript`, `Vite`, `Fastify`, and `SQLite` in that order. Its localized copy MUST be exactly:

- Russian title: `dskr.photos`
- Russian description: `Фотоальбомы с авторскими подборками снимков из поездок, прогулок и городских событий.`
- English title: `dskr.photos`
- English description: `Curated photo albums featuring images from trips, walks, and city events.`

#### Scenario: Complete dskr.photos entry is available

- **GIVEN** the shared project catalog
- **WHEN** the entry with slug `dskr-photos` is selected
- **THEN** exactly one entry exists and every source, live, image, stack, title, and description value equals the required value

#### Scenario: Existing project entries are preserved

- **GIVEN** the catalog before dskr.photos is added contains `dskr-dev` followed by `phoronis`
- **WHEN** the updated catalog is read
- **THEN** those two entries retain their existing field values and order, and `dskr-photos` is the third entry

### Requirement: Supplied screenshot asset

The dskr.photos project card SHALL use the supplied PNG homepage capture without recompression or cropping at rest. The rendered project card MUST display the full capture uncropped, via `object-fit: contain` centered on the dskr.photos card, while the base and Phoronis card image rules keep their existing `object-fit` values. The checked-in file MUST be available at `public/assets/dskr-photos.png`, be 1,537,484 bytes, have dimensions 1440 by 1000 pixels, and have SHA-256 digest `75f827b10c6aa888c38eb507d8f4a3e2367fb7982bef3d6c52c2dd539349ed04`.

#### Scenario: Supplied screenshot resolves from the project image URL

- **GIVEN** the dskr.photos catalog entry references `/assets/dskr-photos.png`
- **WHEN** that URL is resolved against the Astro `public` directory
- **THEN** it identifies a valid PNG whose byte length, dimensions, and SHA-256 digest match the supplied capture

#### Scenario: Dangling or altered screenshot is rejected

- **GIVEN** a catalog image reference whose resolved file is missing, truncated, resized, or recompressed
- **WHEN** the catalog asset integrity test runs
- **THEN** the test fails with the affected image path rather than accepting a broken or altered asset

#### Scenario: dskr.photos card renders the full capture uncropped

- **GIVEN** the built site CSS
- **WHEN** the project-card image rules are inspected
- **THEN** the dskr.photos card image rule applies `object-fit: contain` with `object-position: center`, while the Phoronis card rule keeps `object-fit: contain` and the base card rule keeps `object-fit: cover`

### Requirement: Localized project discovery

The existing data-driven pages SHALL expose dskr.photos in both supported locales. The Russian and English home pages MUST include a preview linking to the exact locale-relative projects-page fragment. The corresponding projects pages MUST contain an article with `id="dskr-photos"`, the locale-appropriate title and description, the `PERSONAL SITE` eyebrow supplied by the existing non-Phoronis renderer fallback, the screenshot, the five stack labels, a source link, and a live-site link. External links MUST retain `target="_blank"` and `rel="noreferrer"`.

#### Scenario: dskr.photos preview renders on the Russian home route

- **GIVEN** the site is built with the updated shared catalog
- **WHEN** `/` is inspected
- **THEN** it contains the dskr.photos title and Russian description plus exactly one `href="/projects/#dskr-photos"`

#### Scenario: dskr.photos preview renders on the English home route

- **GIVEN** the site is built with the updated shared catalog
- **WHEN** `/en/` is inspected
- **THEN** it contains the dskr.photos title and English description plus exactly one `href="/en/projects/#dskr-photos"`, without containing the Russian description

#### Scenario: dskr.photos card renders on the Russian projects route

- **GIVEN** the site is built with the updated shared catalog
- **WHEN** `/projects/` is inspected
- **THEN** it contains exactly one `article#dskr-photos` with the Russian title and description, `PERSONAL SITE`, one image with `src="/assets/dskr-photos.png"`, the ordered stack labels `React`, `TypeScript`, `Vite`, `Fastify`, `SQLite`, and exact `https://github.com/skrylnikov/photo-lib` and `https://dskr.photos` links carrying `target="_blank"` and `rel="noreferrer"`

#### Scenario: dskr.photos card renders on the English projects route

- **GIVEN** the site is built with the updated shared catalog
- **WHEN** `/en/projects/` is inspected
- **THEN** it contains exactly one `article#dskr-photos` with the English title and description, `PERSONAL SITE`, one image with `src="/assets/dskr-photos.png"`, the ordered stack labels `React`, `TypeScript`, `Vite`, `Fastify`, `SQLite`, and exact `https://github.com/skrylnikov/photo-lib` and `https://dskr.photos` links carrying `target="_blank"` and `rel="noreferrer"`, without containing the Russian description

#### Scenario: Existing projects remain discoverable

- **GIVEN** dskr.photos is present in the shared catalog
- **WHEN** all four localized home and projects routes are inspected
- **THEN** `/` contains exactly one `href="/projects/#dskr-dev"` and one `href="/projects/#phoronis"`, `/en/` contains exactly one `href="/en/projects/#dskr-dev"` and one `href="/en/projects/#phoronis"`, and each of `/projects/` and `/en/projects/` contains exactly one `article#dskr-dev` and one `article#phoronis`
