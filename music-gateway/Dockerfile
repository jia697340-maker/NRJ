FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src

ENV PORT=8787
ENV MUSIC_DATA_DIR=/data

RUN addgroup -S music && adduser -S music -G music && mkdir -p /data && chown -R music:music /app /data
USER music

EXPOSE 8787
CMD ["node", "src/server.mjs"]
