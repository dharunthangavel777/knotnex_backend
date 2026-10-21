FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

RUN npm run build

# ─── Production Runner ───
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY src/db/migrations ./dist/db/migrations
COPY src/db/migrations ./src/db/migrations
RUN mkdir -p uploads keys

EXPOSE 8080

CMD ["node", "dist/server.js"]
