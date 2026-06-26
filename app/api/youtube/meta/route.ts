import { NextRequest, NextResponse } from "next/server";
import { parseYouTubeId, thumbnailFor } from "@/services/youtube";
import {
  isVercelRuntime,
  resolveAndFetchYouTubeMeta,
} from "@/lib/youtube-meta";
import { watchUrl, ytDlp } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim();
  const rawId =
    request.nextUrl.searchParams.get("videoId")?.trim() ||
    (url ? parseYouTubeId(url) : null);

  if (!rawId || !/^[\w-]{11}$/.test(rawId)) {
    return NextResponse.json({ error: "Link do YouTube inválido" }, { status: 400 });
  }

  try {
    let videoId = rawId;
    let title: string;
    let channel: string;
    let duration: number;
    let needsClientDuration = false;

    if (isVercelRuntime()) {
      const resolved = await resolveAndFetchYouTubeMeta(rawId);
      videoId = resolved.id;
      title = resolved.title;
      channel = resolved.channel;
      duration = resolved.duration;
      needsClientDuration = Boolean(resolved.needsClientDuration);
    } else {
      try {
        const info = (await ytDlp(watchUrl(rawId), {
          dumpSingleJson: true,
          quiet: true,
        })) as {
          title?: string;
          channel?: string;
          uploader?: string;
          duration?: number;
        };

        if (info.duration && info.duration > 0) {
          title = info.title || "Vídeo do YouTube";
          channel = info.channel || info.uploader || "YouTube";
          duration = info.duration;
        } else {
          throw new Error("no duration");
        }
      } catch {
        const resolved = await resolveAndFetchYouTubeMeta(rawId);
        videoId = resolved.id;
        title = resolved.title;
        channel = resolved.channel;
        duration = resolved.duration;
        needsClientDuration = Boolean(resolved.needsClientDuration);
      }
    }

    if (!needsClientDuration && (!duration || duration <= 0)) {
      throw new Error("Não foi possível ler os dados do vídeo no YouTube");
    }

    return NextResponse.json({
      id: videoId,
      url: watchUrl(videoId),
      title,
      channel,
      duration: needsClientDuration ? 0 : Math.floor(duration),
      thumbnail: thumbnailFor(videoId),
      needsClientDuration,
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
