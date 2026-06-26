import { NextRequest, NextResponse } from "next/server";
import { parsePlatformFormat } from "@/lib/platform-output";
import { parseHighlightColor, parseCaptionFontSetting } from "@/lib/captions";
import { renderClipToBuffer } from "@/lib/render-clip";
import { fetchClipFromWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sanitizeFilename(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "corte"
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const videoId = searchParams.get("videoId");
  const start = Number(searchParams.get("start"));
  const end = Number(searchParams.get("end"));
  const title = searchParams.get("title") || "corte";
  const format = parsePlatformFormat(searchParams.get("format"));
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
    quality: "full",
  });
  if (captionLang) workerParams.set("captionLang", captionLang);
  if (highlightColor) workerParams.set("highlightColor", highlightColor);
  if (captionFont) workerParams.set("captionFont", captionFont);

  const workerRes = await fetchClipFromWorker(workerParams);
  if (workerRes?.body) {
    const filename = `${sanitizeFilename(title)}.mp4`;
    return new NextResponse(workerRes.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  try {
    const buffer = await renderClipToBuffer({
      videoId,
      start,
      end,
      format,
      quality: "full",
      videoDuration: Number.isFinite(videoDuration) ? videoDuration : undefined,
      captionLang,
      highlightColor,
      captionFont,
    });
    const filename = `${sanitizeFilename(title)}.mp4`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("[clips/download]", err);
    return NextResponse.json(
      { error: "Não foi possível gerar o corte. Tente novamente." },
      { status: 500 },
    );
  }
}
