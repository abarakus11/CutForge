FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 pipx \
  && pipx install yt-dlp \
  && ln -s /root/.local/bin/yt-dlp /usr/local/bin/yt-dlp \
  && pip3 install --no-cache-dir faster-whisper \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY lib/captions-core.ts lib/transcription-langs.ts ./lib/
COPY worker/package.json ./worker/
RUN cd worker && npm install

COPY worker/server.ts worker/platform.ts worker/clip-render.ts worker/captions.ts worker/transcribe.ts worker/transcribe.py worker/thumbnail.ts worker/streams.ts ./worker/

ENV PORT=3001
ENV YT_DLP_PATH=/usr/local/bin/yt-dlp
ENV WHISPER_MODEL=small
WORKDIR /app/worker
EXPOSE 3001
CMD ["npx", "tsx", "server.ts"]
