# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apk add --no-cache openssl libc6-compat \
 && addgroup -S nexus && adduser -S nexus -G nexus
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# prisma.config.ts (Prisma 7) holds the datasource url for the CLI; without it
# `prisma migrate deploy` errors "datasource.url property is required".
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Full node_modules from the builder, overlaid on the standalone trace. It includes
# the generated Prisma client AND the complete Prisma CLI dependency closure. The
# Next.js standalone trace prunes the CLI's transitive deps (effect, fast-check,
# pure-rand, pathe, @prisma/dev, ...), which breaks `prisma migrate deploy` at deploy
# time. `prisma` is a devDependency, so we keep devDeps (no production prune). Larger
# image, but migrations run reliably without cherry-picking each transitive dep.
COPY --from=builder /app/node_modules ./node_modules
ENV PATH=/app/node_modules/.bin:$PATH
USER nexus
EXPOSE 3000
CMD ["node", "server.js"]
