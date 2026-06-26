import { NextRequest, NextResponse } from "next/server";
import { parseYouTubeId, thumbnailFor } from "@/services/youtube";
import {
  fetchYouTubeMetaHttp,
  resolveYouTubeVideoId,
} from "@/lib/youtube-meta";
import { watchUrl, ytDlp } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fetchMeta(videoId: string) {
  if (process.env.VERCEL === "1") {
    return fetchYouTubeMetaHttp(videoId);
  }

  try {
    const info = (await ytDlp(watchUrl(videoId), {
      dumpSingleJson: true,
      quiet: true,
    })) as {
      title?: string;
      channel?: string;
      uploader?: string;
      duration?: number;
    };

    if (info.duration && info.duration > 0) {
      return {
        title: info.title || "Vídeo do YouTube",
        channel: info.channel || info.uploader || "YouTube",
        duration: info.duration,
      };
    }
  } catch (err) {
    console.warn("[youtube/meta] yt-dlp failed, using HTTP fallback:", err);
  }

  return fetchYouTubeMetaHttp(videoId);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim();
  const rawId =
    request.nextUrl.searchParams.get("videoId")?.trim() ||
    (url ? parseYouTubeId(url) : null);

  if (!rawId || !/^[\w-]{11}$/.test(rawId)) {
    return NextResponse.json({ error: "Link do YouTube inválido" }, { status: 400 });
  }

  try {
    const videoId = await resolveYouTubeVideoId(rawId);
    const info = await fetchMeta(videoId);

    return NextResponse.json({
      id: videoId,
      url: watchUrl(videoId),
      title: info.title,
      channel: info.channel,
      duration: Math.floor(info.duration),
      thumbnail: thumbnailFor(videoId),
    });
  } catch (err) {
    console.error("[youtube/meta]", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    const isNotFound = msg.includes("ler os dados");
    return NextResponse.json(
      {
        error: isNotFound
          ? "Vídeo não encontrado. Confira se o link está correto."
          : "Não foi possível buscar os dados do vídeo",
      },
      { status: isNotFound ? 404 : 500 },
    );
  }
}
