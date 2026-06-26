import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { create as CreateYtDlp } from "youtube-dl-exec";
import {
  buildClipAss,
  mergeCues,
  mergeWordCues,
  parseHighlightColor,
  parseVtt,
  parseVttWords,
  type CaptionCue,
  type WordCue,
} from "../lib/captions-core";

type YtDlpFn = ReturnType<typeof CreateYtDlp>;

function langScore(candidate: string, preferred: string): number {
  const c = candidate.toLowerCase();
  const p = preferred.toLowerCase();
  if (c === p) return 100;
  if (c.startsWith(p) || p.startsWith(c.split("-")[0])) return 80;
  if (c.split("-")[0] === p.split("-")[0]) return 60;
  return 0;
}

function wordsFromPlainCue(cue: CaptionCue): WordCue[] {
  const parts = cue.text.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const dur = (cue.end - cue.start) / parts.length;
  return parts.map((text, i) => ({
    start: cue.start + i * dur,
    end: cue.start + (i + 1) * dur,
    text,
  }));
}

async function downloadSubsFile(
  ytDlp: YtDlpFn,
  videoId: string,
  lang: string,
  auto: boolean,
  dir: string,
  flags: Record<string, string | boolean>,
): Promise<string | null> {
  await mkdir(dir, { recursive: true });

  await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
    ...flags,
    writeSubs: !auto,
    writeAutoSubs: auto,
    subLangs: [lang],
    subFormat: "vtt",
    skipDownload: true,
    output: join(dir, "subs"),
    quiet: true,
  });

  const files = await readdir(dir);
  const sub = files.find((f) => f.endsWith(".vtt") || f.endsWith(".srt"));
  return sub ? join(dir, sub) : null;
}

/** Write karaoke ASS subtitles for a clip segment (yt-dlp + captions-core). */
export async function writeWorkerClipAss(
  ytDlp: YtDlpFn,
  videoId: string,
  clipStart: number,
  clipEnd: number,
  width: number,
  height: number,
  dir: string,
  ytFlags: Record<string, string | boolean>,
  captionLang?: string | null,
  highlightColor?: string | null,
): Promise<string | null> {
  const subsDir = join(dir, "subs-cache");
  const preferred =
    captionLang && captionLang !== "auto" ? captionLang : "pt";

  let meta: {
    language?: string;
    subtitles?: Record<string, unknown>;
    automatic_captions?: Record<string, unknown>;
  } | null = null;

  try {
    meta = (await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
      ...ytFlags,
      dumpSingleJson: true,
    })) as typeof meta;
  } catch {
    return null;
  }

  const manual = Object.keys(meta?.subtitles || {}).map((lang) => ({
    lang,
    auto: false,
  }));
  const auto = Object.keys(meta?.automatic_captions || {}).map((lang) => ({
    lang,
    auto: true,
  }));

  const ranked = [...manual, ...auto].sort((a, b) => {
    const scoreA = langScore(a.lang, preferred) + (a.auto ? 0 : 10);
    const scoreB = langScore(b.lang, preferred) + (b.auto ? 0 : 10);
    return scoreB - scoreA;
  });

  if (!ranked.length) {
    ranked.push({ lang: preferred, auto: true });
    ranked.push({ lang: "pt", auto: true });
    ranked.push({ lang: "en", auto: true });
  }

  for (const attempt of ranked) {
    try {
      const subPath = await downloadSubsFile(
        ytDlp,
        videoId,
        attempt.lang,
        attempt.auto,
        subsDir,
        ytFlags,
      );
      if (!subPath) continue;

      const content = await readFile(subPath, "utf-8");
      const words = parseVttWords(content);
      const cues =
        words.length > 0
          ? mergeWordCues(words)
          : mergeCues(parseVtt(content));
      if (!cues.length) continue;

      const hl = parseHighlightColor(highlightColor ?? undefined);
      const ass = buildClipAss(cues, clipStart, clipEnd, width, height, {
        highlightColor: hl,
      });
      if (!ass.includes("Dialogue:")) continue;

      const assPath = join(dir, "subs.ass");
      await writeFile(assPath, ass, "utf-8");
      return assPath;
    } catch {
      continue;
    }
  }

  return null;
}

export function escapeFfmpegSubPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}
