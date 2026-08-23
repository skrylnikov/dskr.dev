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
