import { NextRequest, NextResponse } from "next/server";
import {
  parsePlatformFormat,
  parseRenderQuality,
} from "@/lib/platform-output";
import { parseHighlightColor, parseCaptionFontSetting } from "@/lib/captions";
import { renderClipToBuffer } from "@/lib/render-clip";
import { fetchClipFromWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
  const captionFont = parseCaptionFontSetting(searchParams.get("captionFont"));

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return NextResponse.json({ error: "Intervalo inválido" }, { status: 400 });
  }

  const workerParams = new URLSearchParams({
    videoId,
    start: String(Math.floor(start)),
    end: String(Math.floor(end)),
    format,
    quality,
  });
  if (captionLang) workerParams.set("captionLang", captionLang);
  if (highlightColor) workerParams.set("highlightColor", highlightColor);
  if (captionFont) workerParams.set("captionFont", captionFont);

  const workerRes = await fetchClipFromWorker(workerParams);
  if (workerRes?.body) {
    return new NextResponse(workerRes.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=86400",
      },
    });
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
      captionFont,
    });

    return new NextResponse(new Uint8Array(buffer), {
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
