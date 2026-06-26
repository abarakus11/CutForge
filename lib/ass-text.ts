/** Normalize caption text for ASS / libass (Unicode NFC). */
export function normalizeCaptionText(text: string): string {
  return text.normalize("NFC").replace(/\uFFFD/g, "");
}

/** Map Windows font names to Linux fonts with full Portuguese glyph coverage. */
export function resolveAssFontForRuntime(fontName: string): string {
  if (typeof window !== "undefined") return fontName;
  if (typeof process !== "undefined" && process.platform === "win32") {
    return fontName;
  }

  const map: Record<string, string> = {
    "Arial Black": "DejaVu Sans Bold",
    Arial: "DejaVu Sans",
    Impact: "DejaVu Sans Bold",
    Verdana: "DejaVu Sans",
    Tahoma: "DejaVu Sans",
    "Comic Sans MS": "DejaVu Sans",
    Georgia: "DejaVu Serif",
  };

  return map[fontName] || "DejaVu Sans Bold";
}

/** Ensure ASS content has UTF-8 BOM and Unix line endings for libass. */
export function finalizeAssContent(content: string): string {
  const body = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  return `\uFEFF${body}`;
}

/** ffmpeg subtitles filter path with explicit UTF-8 for libass. */
export function assFilterForPath(filePath: string): string {
  const escaped = filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
  return `subtitles='${escaped}':charenc=UTF-8`;
}
