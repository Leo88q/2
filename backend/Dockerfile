# Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
# Сборка из КОРНЯ репозитория:  docker build -f backend/Dockerfile -t piegeddon .
FROM node:22-slim AS build
WORKDIR /build
COPY backend/package.json backend/package-lock.json* backend/
WORKDIR /build/backend
RUN npm ci || npm install
COPY backend/tsconfig.json backend/
COPY backend/src backend/src
COPY backend/test backend/test
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json* backend/
WORKDIR /app/backend
RUN npm ci --omit=dev || npm install --omit=dev
COPY --from=build /build/backend/dist ./dist
COPY web /web
COPY NOTICE /NOTICE.txt
ENV WEB_ROOT=/web
ENV PIEGEDDON_DATA=/data
EXPOSE 8080
CMD ["node", "dist/src/index.js"]
