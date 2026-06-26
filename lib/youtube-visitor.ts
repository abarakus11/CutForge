/**
 * Fetch YouTube visitorData from the homepage (helps Innertube on serverless).
 */
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export async function fetchVisitorData(): Promise<string | null> {
  try {
    const res = await fetch("https://www.youtube.com", {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/"VISITOR_DATA":"([^"]+)"/) ||
      html.match(/visitorData":"([^"]+)"/);
    return match?.[1]?.replace(/\\u0026/g, "&") ?? null;
  } catch {
    return null;
  }
}

export async function fetchInnertubeWithVisitor(
  videoId: string,
  apiKey: string,
  client: Record<string, unknown>,
  visitorData?: string | null,
): Promise<unknown | null> {
  const context: Record<string, unknown> = { client };
  if (visitorData) {
    context.clientScreenNonce = "";
    context.user = { lockedSafetyMode: false };
  }

  const body: Record<string, unknown> = { context, videoId };
  if (visitorData) body.context = { ...context, visitorData };

  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": UA,
          "X-Goog-Visitor-Id": visitorData || "",
          Origin: "https://www.youtube.com",
          Referer: `https://www.youtube.com/watch?v=${videoId}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
