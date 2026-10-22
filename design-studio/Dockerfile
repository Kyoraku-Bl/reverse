FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY shared ./shared
COPY public ./public
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3001 DATA_DIR=/app/data FFMPEG_PATH=/usr/bin/ffmpeg FFPROBE_PATH=/usr/bin/ffprobe
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg gosu && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
RUN mkdir -p /app/data && chown node:node /app/data && chmod 700 /app/data
RUN chmod 755 /app/server/container-entrypoint.sh
VOLUME /app/data
EXPOSE 3001
ENTRYPOINT ["/app/server/container-entrypoint.sh"]
CMD ["node","server/index.mjs"]
