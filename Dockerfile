# US-08: imagem do Events fork (Fastify 5 + Drizzle). Multi-stage: build (tsc) +
# runtime enxuto. O stage `builder` guarda drizzle-kit + migrations, usado pelo
# serviço `migrate` do compose (`npm run db:migrate`).
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
