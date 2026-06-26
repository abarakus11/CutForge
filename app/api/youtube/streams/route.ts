import { NextRequest, NextResponse } from "next/server";
import { fetchStreamsServer } from "@/lib/youtube-streams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")?.trim();

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }

  try {
    const streams = await fetchStreamsServer(videoId);
    if (!streams) {
      return NextResponse.json(
        {
          error: "Não foi possível obter o stream do vídeo.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(streams);
  } catch (err) {
    console.error("[youtube/streams]", err);
    return NextResponse.json(
      { error: "Não foi possível obter o stream do vídeo" },
      { status: 500 },
    );
  }
}
