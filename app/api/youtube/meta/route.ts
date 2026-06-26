import { NextRequest, NextResponse } from "next/server";
import { parseYouTubeId, thumbnailFor } from "@/services/youtube";
import { watchUrl, ytDlp } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim();
  const videoId =
    request.nextUrl.searchParams.get("videoId")?.trim() ||
    (url ? parseYouTubeId(url) : null);

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "Link do YouTube inválido" }, { status: 400 });
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

    if (!info.duration || info.duration <= 0) {
      return NextResponse.json(
        { error: "Não foi possível ler a duração do vídeo" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      id: videoId,
      url: url || watchUrl(videoId),
      title: info.title || "Vídeo do YouTube",
      channel: info.channel || info.uploader || "YouTube",
      duration: Math.floor(info.duration),
      thumbnail: thumbnailFor(videoId),
    });
  } catch (err) {
    console.error("[youtube/meta]", err);
    return NextResponse.json(
      { error: "Não foi possível buscar os dados do vídeo" },
      { status: 500 },
    );
  }
}
