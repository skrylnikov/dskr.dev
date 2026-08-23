FROM node:24.11.1-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY tsconfig.json ./tsconfig.json
COPY services/indie ./services/indie
RUN pnpm indie:build

FROM node:24.11.1-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/indie/dist ./dist
COPY services/indie/migrations ./migrations
EXPOSE 4322
CMD ["node", "dist/server.js"]
