import { NextRequest, NextResponse } from "next/server";
import {
  parsePlatformFormat,
  parseRenderQuality,
} from "@/lib/platform-output";
import { parseHighlightColor } from "@/lib/captions";
import { renderClipToBuffer } from "@/lib/render-clip";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const videoId = searchParams.get("videoId");
  const start = Number(searchParams.get("start"));
  const end = Number(searchParams.get("end"));
  const format = parsePlatformFormat(searchParams.get("format"));
  const quality = parseRenderQuality(searchParams.get("quality"));
  const videoDuration = Number(searchParams.get("duration"));
  const captionLang = searchParams.get("captionLang");
  const highlightColor = parseHighlightColor(
    searchParams.get("highlightColor"),
  );

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return NextResponse.json({ error: "Intervalo inválido" }, { status: 400 });
  }

  try {
    const buffer = await renderClipToBuffer({
      videoId,
      start,
      end,
      format,
      quality,
      videoDuration: Number.isFinite(videoDuration) ? videoDuration : undefined,
      captionLang,
      highlightColor,
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "inline",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[clips/preview]", message, err);
    return NextResponse.json(
      {
        error:
          "Não foi possível gerar a prévia. Tente novamente ou baixe o corte.",
      },
      { status: 500 },
    );
  }
}
