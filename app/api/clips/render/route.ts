import { NextRequest, NextResponse } from "next/server";
import { parsePlatformFormat, parseRenderQuality } from "@/lib/platform-output";
import { parseHighlightColor, parseCaptionFontSetting } from "@/lib/captions";
import { renderClipToBuffer } from "@/lib/render-clip";
import { fetchClipFromWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function clipQueryFromRequest(searchParams: URLSearchParams) {
  const videoId = searchParams.get("videoId")?.trim();
  const start = Number(searchParams.get("start"));
  const end = Number(searchParams.get("end"));
  const format = parsePlatformFormat(searchParams.get("format"));
  const quality = parseRenderQuality(searchParams.get("quality"));
  const captionLang = searchParams.get("captionLang");
  const highlightColor = parseHighlightColor(
    searchParams.get("highlightColor"),
  );
  const captionFont = parseCaptionFontSetting(searchParams.get("captionFont"));
  const videoDuration = Number(searchParams.get("duration"));

  return {
    videoId,
    start,
    end,
    format,
    quality,
    captionLang,
    highlightColor,
    captionFont,
    videoDuration: Number.isFinite(videoDuration) ? videoDuration : undefined,
  };
}

function workerParamsFromClip(clip: ReturnType<typeof clipQueryFromRequest>) {
  const params = new URLSearchParams({
    videoId: clip.videoId!,
    start: String(Math.floor(clip.start)),
    end: String(Math.floor(clip.end)),
    format: clip.format,
    quality: clip.quality,
  });
  if (clip.captionLang) params.set("captionLang", clip.captionLang);
  if (clip.highlightColor) params.set("highlightColor", clip.highlightColor);
  if (clip.captionFont) params.set("captionFont", clip.captionFont);
  return params;
}

export async function GET(request: NextRequest) {
  const clip = clipQueryFromRequest(request.nextUrl.searchParams);

  if (!clip.videoId || !/^[\w-]{11}$/.test(clip.videoId)) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }
  if (!Number.isFinite(clip.start) || !Number.isFinite(clip.end) || clip.end <= clip.start) {
    return NextResponse.json({ error: "Intervalo inválido" }, { status: 400 });
  }

  const workerRes = await fetchClipFromWorker(workerParamsFromClip(clip));
  if (workerRes?.body) {
    return new NextResponse(workerRes.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="clip.mp4"',
      },
    });
  }

  try {
    const buffer = await renderClipToBuffer({
      videoId: clip.videoId,
      start: clip.start,
      end: clip.end,
      format: clip.format,
      quality: clip.quality,
      videoDuration: clip.videoDuration,
      captionLang: clip.captionLang,
      highlightColor: clip.highlightColor,
      captionFont: clip.captionFont,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="clip.mp4"',
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[clips/render]", message, err);
    return NextResponse.json(
      { error: "Não foi possível gerar o corte. Tente novamente." },
      { status: 500 },
    );
  }
}
