import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function isAllowedStreamHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return (
    host.endsWith("googlevideo.com") ||
    host.endsWith("youtube.com") ||
    host.endsWith("ytimg.com") ||
    host.endsWith("googleusercontent.com")
  );
}

/** Proxy YouTube CDN streams so ffmpeg.wasm can fetch without CORS. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "url obrigatória" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "url inválida" }, { status: 400 });
  }

  if (!isAllowedStreamHost(target)) {
    return NextResponse.json({ error: "host não permitido" }, { status: 403 });
  }

  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "*/*",
    Referer: "https://www.youtube.com/",
    Origin: "https://www.youtube.com",
  };

  const range = request.headers.get("range");
  if (range) headers.Range = range;

  try {
    const upstream = await fetch(target.toString(), { headers, cache: "no-store" });

    const outHeaders = new Headers();
    const pass = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
    ];
    for (const key of pass) {
      const val = upstream.headers.get(key);
      if (val) outHeaders.set(key, val);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch (err) {
    console.error("[stream-proxy]", err);
    return NextResponse.json(
      { error: "Falha ao buscar stream" },
      { status: 502 },
    );
  }
}
