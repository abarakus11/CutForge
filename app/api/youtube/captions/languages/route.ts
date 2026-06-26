import { NextRequest, NextResponse } from "next/server";
import { parseYouTubeId } from "@/services/youtube";
import { listSubtitleLanguages } from "@/lib/captions";
import { fetchFromClipWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const videoId =
    request.nextUrl.searchParams.get("videoId")?.trim() ||
    parseYouTubeId(request.nextUrl.searchParams.get("url")?.trim() || "");

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }

  try {
    const workerRes = await fetchFromClipWorker(
      `/captions/languages?videoId=${encodeURIComponent(videoId)}`,
    );
    if (workerRes) {
      return NextResponse.json(await workerRes.json());
    }

    const tracks = await listSubtitleLanguages(videoId);
    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("[captions/languages]", err);
    return NextResponse.json(
      { error: "Não foi possível listar as legendas disponíveis." },
      { status: 500 },
    );
  }
}
