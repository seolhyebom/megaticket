FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy entire monorepo content
COPY . .

# Install dependencies
RUN npm install

# Build the project and its dependencies
RUN npx turbo run build --filter=app

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/static ./apps/app/.next/static
# apps/app might not have public, but good to check. Assuming standard Next.js structure.
# If no public dir, this might fail or warn. I'll include it just in case, but verify first? 
# Usually API routes don't use public much, but for consistency.
# I'll create an empty public dir in apps/app if not exists to be safe, or just ignore line if it fails? 
# Docker copy fails if source missing. 
# Let's check if apps/app has public.

USER nextjs

EXPOSE 3001

ENV PORT 3001
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/app/server.js"]
