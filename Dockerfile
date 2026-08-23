FROM node:24.11.1-bookworm-slim AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
