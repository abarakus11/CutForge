import { NextRequest, NextResponse } from "next/server";
import { parseHighlightColor, parseCaptionFontSetting } from "@/lib/captions";
import { buildTranscribedClipAss } from "@/lib/clip-captions";
import {
  outputForQuality,
  parsePlatformFormat,
  parseRenderQuality,
} from "@/lib/platform-output";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Gera legendas ASS via transcrição Whisper (não usa YouTube). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const videoId = searchParams.get("videoId")?.trim();
  const start = Number(searchParams.get("start"));
  const end = Number(searchParams.get("end"));
  const width = Number(searchParams.get("width"));
  const height = Number(searchParams.get("height"));
  const format = parsePlatformFormat(searchParams.get("format"));
  const quality = parseRenderQuality(searchParams.get("quality"));
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

  const dims =
    width > 0 && height > 0
      ? { width, height }
      : outputForQuality(format, quality);

  try {
    const ass = await buildTranscribedClipAss(
      videoId,
      start,
      end,
      dims.width,
      dims.height,
      captionLang,
      highlightColor,
      captionFont,
    );

    if (!ass) {
      return NextResponse.json(
        { error: "Nenhuma fala detectada no trecho" },
        { status: 404 },
      );
    }

    return new NextResponse(ass, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[captions/ass]", err);
    return NextResponse.json(
      { error: "Falha ao transcrever legendas" },
      { status: 500 },
    );
  }
}
