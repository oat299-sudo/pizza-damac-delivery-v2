# Dockerfile for Pizza Damac (Vite frontend + Express server) on Google Cloud Run
FROM node:20-slim

WORKDIR /app

# 1) Install dependencies (dev deps included — needed to build)
COPY package.json package-lock.json* ./
RUN npm install

# 2) Copy the rest of the source code
COPY . .

# 3) Build: Vite builds the frontend, esbuild bundles the server into dist/server.cjs
RUN npm run build

# Cloud Run injects the PORT env var (server.ts already reads process.env.PORT)
ENV NODE_ENV=production
EXPOSE 8080

# 4) Start the production server
CMD ["npm", "start"]
