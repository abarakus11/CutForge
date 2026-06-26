import { NextRequest, NextResponse } from "next/server";
import {
  buildClipAss,
  loadVideoCaptions,
  parseHighlightColor,
} from "@/lib/captions";
import {
  outputForQuality,
  parsePlatformFormat,
  parseRenderQuality,
} from "@/lib/platform-output";
import { fetchFromClipWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Generate ASS karaoke subtitles for a clip segment. */
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
    const workerParams = new URLSearchParams({
      videoId,
      start: String(start),
      end: String(end),
      width: String(dims.width),
      height: String(dims.height),
      captionLang: captionLang || "auto",
      highlightColor,
    });
    const workerRes = await fetchFromClipWorker(
      `/captions/ass?${workerParams}`,
      60_000,
    );
    if (workerRes) {
      const ass = await workerRes.text();
      if (ass.includes("Dialogue:")) {
        return new NextResponse(ass, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }

    const captions = await loadVideoCaptions(videoId, captionLang);
    if (!captions) {
      return NextResponse.json(
        { error: "Legendas indisponíveis para este vídeo" },
        { status: 404 },
      );
    }

    const ass = buildClipAss(
      captions.cues,
      start,
      end,
      dims.width,
      dims.height,
      { highlightColor },
    );

    if (!ass.includes("Dialogue:")) {
      return NextResponse.json(
        { error: "Nenhuma legenda no intervalo do corte" },
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
      { error: "Falha ao gerar legendas" },
      { status: 500 },
    );
  }
}
