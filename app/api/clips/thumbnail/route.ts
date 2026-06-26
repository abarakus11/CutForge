import { NextRequest, NextResponse } from "next/server";
import { extractClipThumbnail } from "@/lib/extract-thumbnail";
import { parsePlatformFormat } from "@/lib/platform-output";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const videoId = searchParams.get("videoId");
  const start = Number(searchParams.get("start"));
  const end = Number(searchParams.get("end"));
  const format = parsePlatformFormat(searchParams.get("format"));

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }

  const clipStart = Number.isFinite(start) ? start : 0;
  const clipEnd = Number.isFinite(end) ? end : clipStart + 30;

  try {
    const buffer = await extractClipThumbnail({
      videoId,
      start: clipStart,
      end: clipEnd,
      format,
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[clips/thumbnail]", err);
    return NextResponse.json(
      { error: "Não foi possível gerar a thumbnail" },
      { status: 500 },
    );
  }
}
