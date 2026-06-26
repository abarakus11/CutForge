# Clip Worker

Worker de vídeo com yt-dlp + ffmpeg. Na Vercel o download passa por `/api/clips/render`, que usa `CLIP_WORKER_URL`.

## Já configurado

- `CLIP_WORKER_URL` está definido na Vercel (produção)
- Deploy do app: https://cut-forge.vercel.app

## Rodar localmente

```bash
npm run worker:install
npm run worker
```

## Deploy permanente (Render)

O repositório inclui `render.yaml` na raiz. No [Render](https://render.com):

1. **New → Blueprint** → conecte o repo `CutForge`
2. Após o deploy, copie a URL do serviço `cutforge-clip-worker`
3. Atualize `CLIP_WORKER_URL` na Vercel:

```bash
npx vercel env rm CLIP_WORKER_URL production
echo https://SEU-WORKER.onrender.com | npx vercel env add CLIP_WORKER_URL production
npx vercel --prod
```

## Deploy no Fly.io

```bash
cd worker
fly launch --no-deploy
fly deploy
```

## Endpoints

| Rota | Descrição |
|------|-----------|
| `GET /health` | Status |
| `GET /streams?videoId=` | URLs de vídeo/áudio |
| `GET /clip?videoId=&start=&end=` | MP4 do trecho |
