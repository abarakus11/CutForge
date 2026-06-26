import { NextRequest, NextResponse } from "next/server";
import { parsePlatformFormat } from "@/lib/platform-output";
import { parseHighlightColor } from "@/lib/captions";
import { renderClipToBuffer } from "@/lib/render-clip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const videoId = searchParams.get("videoId")?.trim();
  const start = Number(searchParams.get("start"));
  const end = Number(searchParams.get("end"));
  const format = parsePlatformFormat(searchParams.get("format"));
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

  const workerUrl = process.env.CLIP_WORKER_URL?.replace(/\/$/, "");
  if (workerUrl) {
    try {
      const params = new URLSearchParams({
        videoId,
        start: String(Math.floor(start)),
        end: String(Math.floor(end)),
      });
      const res = await fetch(`${workerUrl}/clip?${params}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(280000),
      });
      if (res.ok && res.body) {
        return new NextResponse(res.body, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": 'attachment; filename="clip.mp4"',
          },
        });
      }
      console.warn("[clips/render] worker status", res.status);
    } catch (err) {
      console.warn("[clips/render] worker:", err);
    }
  }

  try {
    const buffer = await renderClipToBuffer({
      videoId,
      start,
      end,
      format,
      quality: "full",
      captionLang,
      highlightColor,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="clip.mp4"',
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("[clips/render]", err);
    return NextResponse.json(
      { error: "Não foi possível gerar o corte. Tente novamente." },
      { status: 500 },
    );
  }
}
