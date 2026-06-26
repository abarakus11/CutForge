# CutForge

> Transforme qualquer vídeo do YouTube em cortes prontos para Shorts, Reels, TikTok, Twitter/X e Facebook.

Aplicação web construída com **Next.js 14**, **TypeScript**, **TailwindCSS** e **Framer Motion**. Baixa trechos reais do YouTube, renderiza em **4K** no formato da rede escolhida e queima **legendas karaokê** (palavra por palavra com cor personalizável).

## Funcionalidades

- Validação de links do YouTube e metadados reais (título, duração, canal)
- Cortes automáticos por plataforma (9:16, 1:1, 16:9)
- Prévia e download em MP4 com crop, escala e legendas embutidas
- Escolha de **idioma da legenda** e **cor de destaque** por palavra falada
- Thumbnails por trecho de corte
- Cache em memória para prévias e downloads repetidos

## Stack

- **Next.js 14** (App Router) + **React 18**
- **TypeScript**
- **TailwindCSS** + **Framer Motion** + **Lucide React**
- **yt-dlp** + **ffmpeg-static** (extração e renderização no servidor)

## Requisitos

- **Node.js** 18+
- Conexão com a internet (download de vídeos e legendas do YouTube)

## Instalação

```bash
git clone https://github.com/abarakus11/CutForge.git
cd CutForge
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Build de produção

```bash
npm run build
npm start
```

## Variáveis de ambiente

Não são obrigatórias para o fluxo atual. Copie `.env.example` para `.env.local` quando integrar APIs externas (YouTube Data API, IA, storage, auth).

## Estrutura do projeto

```
app/                 # Rotas e API (meta, preview, download, thumbnails)
components/          # UI, landing e fluxo de geração
config/              # Formatos, tags, cores de legenda
hooks/               # useClipForge (estado do fluxo)
lib/                 # render-clip, captions, yt-dlp, cache
services/            # YouTube, clips, legendas
types/               # Tipos compartilhados
utils/               # Download, formatação, plataforma
```

## Fluxo do usuário

1. **Link** — cola a URL do YouTube
2. **Formato + legendas** — escolhe rede social, idioma e cor do destaque
3. **Processamento** — geração dos cortes
4. **Resultados** — prévia em 4K e download individual ou em lote

## Deploy

Compatível com **Vercel**, mas rotas de renderização (`/api/clips/*`) exigem **Node.js** (não Edge) e tempo de execução maior — configure `maxDuration` adequado ou use um servidor dedicado para produção com vídeos longos.

## Licença

MIT — veja [LICENSE](LICENSE).

---

Desenvolvido por **SheikDev**.
