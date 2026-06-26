import { NextRequest, NextResponse } from "next/server";
import { fetchInnertubePlayer } from "@/lib/innertube-shared";
import { fetchStreamsServer } from "@/lib/youtube-streams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Innertube player data (captions + streams) via server proxy. */
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")?.trim();

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }

  try {
    const player = await fetchInnertubePlayer(videoId);
    if (player?.captions) {
      return NextResponse.json({ player });
    }

    const streams = await fetchStreamsServer(videoId);
    if (!streams) {
      return NextResponse.json(
        { error: "Dados do player indisponíveis" },
        { status: 502 },
      );
    }

    return NextResponse.json({ player, streams });
  } catch (err) {
    console.error("[youtube/player]", err);
    return NextResponse.json(
      { error: "Falha ao buscar dados do player" },
      { status: 500 },
    );
  }
}
