# ─── Gemini Tutor - Google Cloud Run Dockerfile ───────────────────────────────
# Multi-stage build: builds frontend + backend, then creates a minimal image
# Deploy with: gcloud run deploy (see deploy.sh)

# Stage 1: Build the React frontend with Vite
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build the backend (TypeScript → JavaScript)
FROM node:20-slim AS backend-build
WORKDIR /app/server
COPY server/package.json ./
RUN npm install
COPY server/ ./
RUN npx tsc

# Stage 3: Production image
FROM node:20-slim AS production
WORKDIR /app

# Copy backend build + dependencies
COPY --from=backend-build /app/server/dist ./server/dist
COPY --from=backend-build /app/server/node_modules ./server/node_modules
COPY --from=backend-build /app/server/package.json ./server/package.json

# Copy frontend build
COPY --from=frontend-build /app/dist ./dist

WORKDIR /app/server

# Cloud Run sets PORT automatically (default 8080)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Start the backend server (which also serves the frontend static files)
CMD ["node", "dist/index.js"]
