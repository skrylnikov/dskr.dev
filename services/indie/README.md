# dskr.dev IndieWeb backend

This service owns short notes, IndieAuth, Micropub, and Webmentions. The Astro
site remains static; the public ingress routes `/notes`, `/inbox`, `/auth`,
`/micropub`, `/webmention`, and `/api/interactions` here.

```sh
cp services/indie/.env.example services/indie/.env
pnpm install
pnpm indie:migrate
pnpm indie:dev
```

Incoming Webmention content is stored and rendered as plain text. HTML from
another site is never inserted into the response.

The production image is published as `ghcr.io/skrylnikov/dskr.dev-indie` by
`.github/workflows/indie.yml`. The Flux deployment belongs in the separate
`infra` repository because this repository currently has no ingress ownership.
