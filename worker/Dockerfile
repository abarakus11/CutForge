FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 pipx \
  && pipx install yt-dlp \
  && ln -s /root/.local/bin/yt-dlp /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker/package.json ./
RUN npm install
COPY worker/server.ts worker/platform.ts worker/clip-render.ts ./

ENV PORT=3001
ENV YT_DLP_PATH=/usr/local/bin/yt-dlp
EXPOSE 3001
CMD ["npx", "tsx", "server.ts"]
