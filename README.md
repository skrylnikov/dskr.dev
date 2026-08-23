# dskr.dev

Личный блог о разработке, собственных проектах и вещах, которые интересно разбирать на практике.

Сайт собран на [Astro](https://astro.build/) и использует MDX, TypeScript и pnpm.

## Локальный запуск

```bash
pnpm install
pnpm dev
```

Для production-сборки:

```bash
pnpm build
```

## IndieWeb

Astro публикует microformats2-разметку и discovery-ссылки для Webmention,
IndieAuth и Micropub. Self-hosted backend находится в `services/indie` и
хранит короткие заметки, входящие Webmention и OAuth-токены в Postgres.

Для локального backend:

```sh
cp services/indie/.env.example services/indie/.env
pnpm indie:migrate
pnpm indie:dev
```

Production images собираются workflow `.github/workflows/site.yml` и
`.github/workflows/indie.yml`:

- `ghcr.io/skrylnikov/dskr.dev` — статический Astro-host на nginx;
- `ghcr.io/skrylnikov/dskr.dev-indie` — backend для заметок и Webmention.

Роутинг backend и Postgres/Flux-манифесты должны быть подключены в
GitOps-инфраструктуре с path-based reverse proxy для `/notes`, `/inbox`,
`/auth`, `/micropub`, `/webmention` и `/api/interactions`.

## Статьи

- `src/content/blog` — статьи на русском языке;
- `src/content/blogEn` — статьи на английском языке;
- `public/assets` — изображения и другие публичные ресурсы.

Новая статья начинается с frontmatter:

```md
---
title: Заголовок статьи
description: Краткое описание статьи
publishDate: 2026-08-23
---
```

## Ссылки

- [Сайт](https://dskr.dev)
- [GitHub](https://github.com/skrylnikov)
- [Telegram](https://t.me/dskrylnikov)
