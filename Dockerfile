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
# Prisma legacy generator output sits under node_modules in the builder image,
# but standalone tracing already includes what is needed for runtime. Copy
# any missed engine binaries to be safe.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# .bin contains the `prisma` symlink that `npx prisma` resolves to.
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
ENV PATH=/app/node_modules/.bin:$PATH
USER nexus
EXPOSE 3000
CMD ["node", "server.js"]
