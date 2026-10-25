# IBM Plex

Локальные WOFF2 из Google Fonts, скачаны 2026-10-25. Сборка и браузер не обращаются к Google.

- IBM Plex Sans v23: variable 400–700, normal и italic.
- IBM Plex Mono v20: 400 и 700, normal.
- Все исходные языковые поднаборы сохранены; `unicode-range` в `src/styles/fonts.css` позволяет браузеру загружать только нужные символы и начертания.

Источник: [Google Fonts CSS](https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:ital,wght@0,400..700;1,400..700&display=swap), с User-Agent современного Chrome для WOFF2. При обновлении заменять CSS и соответствующие файлы вместе.

[IBM Plex](https://github.com/IBM/plex) распространяется по SIL Open Font License 1.1; оригинальная лицензия — `public/fonts/ibm-plex-OFL.txt`, доступна и на собранном сайте.

Vite добавляет хеш содержимого к URL шрифтов. Nginx кеширует их на год с `immutable`; при обновлении кеш автоматически обходится новым URL. В `BaseHead.astro` предзагружается только основной Sans: Latin на всех страницах и Cyrillic на русских. Остальные начертания загружаются по использованию, с `font-display: swap`.
