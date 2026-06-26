# Clip Worker — download na Vercel

A Vercel **não consegue** baixar vídeos do YouTube (IPs bloqueados).  
Este worker roda em um servidor com **yt-dlp + ffmpeg** e resolve o download.

## Deploy no Render (grátis)

1. Crie conta em [render.com](https://render.com)
2. **New → Web Service** → conecte o repo `CutForge`
3. Configuração:
   - **Root Directory:** `worker` (ou use Docker abaixo)
   - **Runtime:** Docker
   - **Dockerfile Path:** `worker/Dockerfile`
   - **Docker Build Context:** `.` (raiz do repo)
4. Plano **Free** → Create Web Service
5. Copie a URL (ex: `https://cutforge-worker.onrender.com`)

## Configurar na Vercel

1. Painel Vercel → projeto **cut-forge** → Settings → Environment Variables
2. Adicione:
   - `CLIP_WORKER_URL` = `https://cutforge-worker.onrender.com`
3. **Redeploy** o projeto

## Testar

```bash
curl "https://SEU-WORKER.onrender.com/health"
curl "https://SEU-WORKER.onrender.com/streams?videoId=6YxnJbowEJ8"
```

## Rodar localmente (alternativa)

```bash
cd worker && npm install && npx tsx server.ts
# http://localhost:3001
```

No `.env.local` da Vercel/local:

```
CLIP_WORKER_URL=http://localhost:3001
```

## Endpoints

| Rota | Descrição |
|------|-----------|
| `GET /health` | Status |
| `GET /streams?videoId=` | URLs de vídeo/áudio |
| `GET /clip?videoId=&start=&end=` | MP4 do trecho |
