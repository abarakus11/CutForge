import { NextRequest, NextResponse } from "next/server";
import { extractClipThumbnail } from "@/lib/extract-thumbnail";
import { thumbnailTimestamp } from "@/lib/clip-thumbnail";
import { parsePlatformFormat, PLATFORM_OUTPUT } from "@/lib/platform-output";
import { fetchFromClipWorker } from "@/lib/worker-proxy";
import { extractStoryboardThumbnail } from "@/lib/youtube-storyboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function thumbDimensions(format: ReturnType<typeof parsePlatformFormat>) {
  const base = PLATFORM_OUTPUT[format];
  const width = 360;
  const height = Math.round((width * base.height) / base.width);
  return { width, height };
}

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
  const at = thumbnailTimestamp(clipStart, clipEnd);

  const workerParams = new URLSearchParams({
    videoId,
    start: String(Math.floor(clipStart)),
    end: String(Math.floor(clipEnd)),
    format,
    at: String(at),
  });

  const workerRes = await fetchFromClipWorker(
    `/thumbnail?${workerParams}`,
    90_000,
  );
  if (workerRes) {
    const buffer = await workerRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  try {
    const buffer = await extractClipThumbnail({
      videoId,
      start: clipStart,
      end: clipEnd,
      format,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    /* local ffmpeg/yt-dlp indisponível — tenta storyboard */
  }

  const { width, height } = thumbDimensions(format);
  const storyboard = await extractStoryboardThumbnail(
    videoId,
    at,
    width,
    height,
  );

  if (storyboard) {
    return new NextResponse(new Uint8Array(storyboard), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(storyboard.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return NextResponse.json(
    { error: "Não foi possível gerar a thumbnail" },
    { status: 500 },
  );
}
