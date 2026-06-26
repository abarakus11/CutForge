import { NextRequest, NextResponse } from "next/server";
import { TRANSCRIPTION_LANGUAGES } from "@/config/constants";
import { fetchFromClipWorker } from "@/lib/worker-proxy";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Idiomas disponíveis para transcrição Whisper (não legendas do YouTube). */
export async function GET(_request: NextRequest) {
  const workerRes = await fetchFromClipWorker("/captions/languages");
  if (workerRes) {
    return NextResponse.json(await workerRes.json());
  }

  return NextResponse.json({
    tracks: TRANSCRIPTION_LANGUAGES.map((t) => ({
      lang: t.lang,
      label: t.label,
      auto: t.lang === "auto",
    })),
  });
}
