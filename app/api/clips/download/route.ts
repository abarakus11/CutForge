import { NextRequest, NextResponse } from "next/server";
import { isVercelRuntime } from "@/lib/youtube-meta";
import { parsePlatformFormat } from "@/lib/platform-output";
import { parseHighlightColor } from "@/lib/captions";
import { renderClipToBuffer } from "@/lib/render-clip";

export const runtime = "nodejs";
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
  if (isVercelRuntime()) {
    return NextResponse.json(
      {
        error:
          "Na Vercel o download é gerado no seu navegador. Atualize a página (Ctrl+Shift+R).",
        clientOnly: true,
      },
      { status: 503 },
    );
  }

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

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return NextResponse.json({ error: "Intervalo inválido" }, { status: 400 });
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
