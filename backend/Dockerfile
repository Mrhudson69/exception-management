# ---- Build stage: compile TypeScript -> dist/ ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
    # tsc only emits .js; copy the SQL the migrate step reads at runtime
    && cp src/db/schema.sql dist/db/schema.sql

# ---- Runtime stage: prod deps + compiled JS only ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
