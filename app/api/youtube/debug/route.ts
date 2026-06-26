import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const KEY = "AIzaSyAO_FJ2SlbwU7RmtKx_thw_vz3mce3NZSY";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "6YxnJbowEJ8";
  const out: Record<string, unknown> = { id, vercel: process.env.VERCEL };

  // oEmbed
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      { headers: { "User-Agent": UA }, cache: "no-store" },
    );
    out.oembed = { status: r.status, body: r.ok ? await r.json() : await r.text() };
  } catch (e) {
    out.oembed = { error: String(e) };
  }

  // Innertube ANDROID
  try {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        Origin: "https://www.youtube.com",
        Referer: `https://www.youtube.com/watch?v=${id}`,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 30,
            hl: "en",
            gl: "US",
          },
        },
        videoId: id,
      }),
      cache: "no-store",
    });
    const d = await r.json();
    out.innertube = {
      status: r.status,
      playability: d.playabilityStatus?.status,
      reason: d.playabilityStatus?.reason,
      title: d.videoDetails?.title,
      duration: d.videoDetails?.lengthSeconds,
    };
  } catch (e) {
    out.innertube = { error: String(e) };
  }

  // Data API (if key set)
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${id}&key=${apiKey}`,
        { cache: "no-store" },
      );
      out.dataApi = { status: r.status, body: r.ok ? await r.json() : await r.text() };
    } catch (e) {
      out.dataApi = { error: String(e) };
    }
  } else {
    out.dataApi = "YOUTUBE_API_KEY not set";
  }

  // Watch page scrape
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR" },
      cache: "no-store",
    });
    const html = await r.text();
    const len =
      html.match(/"lengthSeconds":"(\d+)"/) ||
      html.match(/lengthSeconds\\":\\"(\d+)/) ||
      html.match(/"approxDurationMs":"(\d+)"/);

    let playerDuration: string | undefined;
    const pIdx = html.indexOf("ytInitialPlayerResponse");
    if (pIdx > 0) {
      const start = html.indexOf("{", pIdx);
      let depth = 0;
      for (let i = start; i < Math.min(html.length, start + 500000); i++) {
        if (html[i] === "{") depth++;
        else if (html[i] === "}") {
          depth--;
          if (depth === 0) {
            try {
              const parsed = JSON.parse(html.slice(start, i + 1)) as {
                videoDetails?: { lengthSeconds?: string };
                playabilityStatus?: { status?: string };
              };
              playerDuration = parsed.videoDetails?.lengthSeconds;
              out.playerPlayability = parsed.playabilityStatus?.status;
            } catch {
              /* ignore */
            }
            break;
          }
        }
      }
    }

    out.watchPage = {
      status: r.status,
      htmlLen: html.length,
      duration: len?.[1] || playerDuration,
      approxMs: html.match(/"approxDurationMs":"(\d+)"/)?.[1],
      hasPlayer: pIdx > 0,
      sample: html.includes("lengthSeconds") ? "has lengthSeconds string" : "no lengthSeconds",
    };
  } catch (e) {
    out.watchPage = { error: String(e) };
  }

  // m.youtube.com
  try {
    const r = await fetch(`https://m.youtube.com/watch?v=${id}`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    const html = await r.text();
    const len = html.match(/"lengthSeconds":"(\d+)"/);
    out.mobileWatch = { status: r.status, htmlLen: html.length, duration: len?.[1] };
  } catch (e) {
    out.mobileWatch = { error: String(e) };
  }

  return NextResponse.json(out);
}
