FROM node:20 AS base

# Install dependencies only when needed
FROM base AS builder
# RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy entire monorepo content
COPY . .

# Remove nested package-lock.json to prevent native module conflicts
RUN rm -f apps/web/package-lock.json apps/app/package-lock.json

# Install dependencies
RUN npm install --legacy-peer-deps

# Build the project and its dependencies
RUN npx turbo run build --filter=web

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN groupadd -g 1001 nodejs
RUN useradd -u 1001 -g nodejs -s /bin/bash -m nextjs

# Copy standalone build
# Standard output for monorepo: apps/web/.next/standalone -> /app/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
