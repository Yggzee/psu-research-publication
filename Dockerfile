# syntax = docker/dockerfile:1
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install dependencies (including devDependencies required for Vite build)
COPY package*.json ./
RUN npm ci

# Copy full source and compile React frontend
COPY . .
RUN npm run build

# Runner stage - Minimal production image
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

# Copy built frontend assets, server handlers, and dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/server ./src/server
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

# Create default data directory for SQLite database
RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "src/server/prod.mjs"]
