FROM node:20-alpine AS builder

# Install build deps for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev) for building
RUN npm ci

# Copy source
COPY . .

# Build the app
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production deps only (rebuild native modules)
RUN npm ci --omit=dev

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Data directory for SQLite persistent volume
RUN mkdir -p /data

EXPOSE 5000

ENV NODE_ENV=production
ENV DATABASE_URL=/data/azure_assistant.db

CMD ["node", "dist/index.cjs"]
