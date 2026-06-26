import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { CAPTION_LANG_LABELS } from "@/config/constants";
import type { SubtitleTrack } from "@/types";
import {
  downloadCaptionVttHttp,
  fetchYouTubeCaptionTracksHttp,
  isVercelRuntime,
} from "@/lib/youtube-meta";
import { watchUrl, ytDlp } from "@/lib/ytdlp";

export * from "@/lib/captions-core";

import type { CaptionCue, WordCue } from "@/lib/captions-core";
import {
  buildClipAss,
  mergeCues,
  mergeWordCues,
  parseVtt,
  parseVttWords,
} from "@/lib/captions-core";

interface VideoSubtitleMeta {
  language?: string;
  subtitles?: Record<string, unknown>;
  automatic_captions?: Record<string, unknown>;
}

interface CachedCaptions {
  language: string;
  cues: CaptionCue[];
  words: WordCue[];
}

const captionStore = new Map<string, CachedCaptions>();
const CAPTION_PARSE_VERSION = "v4-clean-karaoke";

function langScore(candidate: string, preferred: string): number {
  const c = candidate.toLowerCase();
  const p = preferred.toLowerCase();
  if (c === p) return 100;
  if (c.startsWith(p) || p.startsWith(c.split("-")[0])) return 80;
  if (c.split("-")[0] === p.split("-")[0]) return 60;
  return 0;
}

function labelForLang(lang: string): string {
  return CAPTION_LANG_LABELS[lang] || CAPTION_LANG_LABELS[lang.split("-")[0]] || lang;
}

async function downloadSubs(
  videoId: string,
  lang: string,
  auto: boolean,
  dir: string,
): Promise<string | null> {
  await mkdir(dir, { recursive: true });

  await ytDlp(watchUrl(videoId), {
    writeSubs: !auto,
    writeAutoSubs: auto,
    subLangs: [lang],
    subFormat: "vtt",
    skipDownload: true,
    output: join(dir, "subs"),
    noPlaylist: true,
    quiet: true,
  });

  const files = await readdir(dir);
  const sub = files.find((f) => f.endsWith(".vtt") || f.endsWith(".srt"));
  return sub ? join(dir, sub) : null;
}

/** List subtitle tracks available for a YouTube video. */
export async function listSubtitleLanguages(
  videoId: string,
): Promise<SubtitleTrack[]> {
  if (isVercelRuntime()) {
    const httpTracks = await fetchYouTubeCaptionTracksHttp(videoId);
    return httpTracks.map((t) => ({
      lang: t.lang,
      label: t.auto ? `${t.label} (automática)` : t.label,
      auto: t.auto,
    }));
  }

  const meta = (await ytDlp(watchUrl(videoId), {
    dumpSingleJson: true,
  })) as VideoSubtitleMeta;

  const manual = Object.keys(meta.subtitles || {}).map((lang) => ({
    lang,
    label: labelForLang(lang),
    auto: false,
  }));
  const auto = Object.keys(meta.automatic_captions || {}).map((lang) => ({
    lang,
    label: `${labelForLang(lang)} (automática)`,
    auto: true,
  }));

  return [...manual, ...auto];
}

async function loadVideoCaptionsHttp(
  videoId: string,
  preferredLang?: string | null,
): Promise<CachedCaptions | null> {
  const tracks = await fetchYouTubeCaptionTracksHttp(videoId);
  if (!tracks.length) return null;

  const preferred =
    preferredLang && preferredLang !== "auto"
      ? preferredLang
      : tracks[0]?.lang || "pt";

  const ranked = [...tracks].sort((a, b) => {
    const scoreA = langScore(a.lang, preferred) + (a.auto ? 0 : 10);
    const scoreB = langScore(b.lang, preferred) + (b.auto ? 0 : 10);
    return scoreB - scoreA;
  });

  for (const track of ranked) {
    if (!track.baseUrl) continue;
    try {
      const content = await downloadCaptionVttHttp(track.baseUrl);
      const words = parseVttWords(content);
      const cues =
        words.length > 0
          ? mergeWordCues(words)
          : mergeCues(parseVtt(content));
      if (!cues.length) continue;

      return {
        language: track.lang,
        cues,
        words: words.length > 0 ? words : cues.flatMap(wordsFromPlainCue),
      };
    } catch {
      continue;
    }
  }

  return null;
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

/** Load and cache normalized captions for a video. */
export async function loadVideoCaptions(
  videoId: string,
  preferredLang?: string | null,
): Promise<CachedCaptions | null> {
  const langKey = preferredLang || "auto";
  const cacheKey = `${CAPTION_PARSE_VERSION}:${langKey}:${videoId}`;
  const cached = captionStore.get(cacheKey);
  if (cached) return cached;

  if (isVercelRuntime()) {
    const result = await loadVideoCaptionsHttp(videoId, preferredLang);
    if (result) captionStore.set(cacheKey, result);
    return result;
  }

  const meta = (await ytDlp(watchUrl(videoId), {
    dumpSingleJson: true,
  })) as VideoSubtitleMeta;

  const tmpDir = join(process.cwd(), ".cache", "captions", videoId, langKey);
  const attempts = buildLangAttempts(meta, preferredLang);

  for (const attempt of attempts) {
    const subPath = await downloadSubs(
      videoId,
      attempt.lang,
      attempt.auto,
      tmpDir,
    );
    if (!subPath) continue;

    const content = await readFile(subPath, "utf-8");
    const words = parseVttWords(content);
    const cues =
      words.length > 0
        ? mergeWordCues(words)
        : mergeCues(parseVtt(content));
    if (!cues.length) continue;

    const result = { language: attempt.lang, cues, words };
    captionStore.set(cacheKey, result);
    return result;
  }

  return null;
}

function buildLangAttempts(
  meta: VideoSubtitleMeta,
  preferredLang?: string | null,
): { lang: string; auto: boolean }[] {
  const videoLang = meta.language || "pt";
  const preferred =
    preferredLang && preferredLang !== "auto" ? preferredLang : videoLang;

  const manual = Object.keys(meta.subtitles || {}).map((l) => ({
    lang: l,
    auto: false,
  }));
  const auto = Object.keys(meta.automatic_captions || {}).map((l) => ({
    lang: l,
    auto: true,
  }));

  const all = [...manual, ...auto].sort((a, b) => {
    const scoreA = langScore(a.lang, preferred) + (a.auto ? 0 : 10);
    const scoreB = langScore(b.lang, preferred) + (b.auto ? 0 : 10);
    return scoreB - scoreA;
  });

  const attempts: { lang: string; auto: boolean }[] = [];
  const seen = new Set<string>();

  for (const item of all) {
    const key = `${item.lang}:${item.auto}`;
    if (seen.has(key)) continue;
    seen.add(key);
    attempts.push(item);
  }

  return attempts;
}

/** Write ASS file for a clip; returns path or null if no captions. */
export async function writeClipAssFile(
  videoId: string,
  clipStart: number,
  clipEnd: number,
  width: number,
  height: number,
  dir: string,
  captionLang?: string | null,
  highlightColor?: string,
): Promise<string | null> {
  const captions = await loadVideoCaptions(videoId, captionLang);
  if (!captions) return null;

  const ass = buildClipAss(
    captions.cues,
    clipStart,
    clipEnd,
    width,
    height,
    { highlightColor: highlightColor || "#FFFF00" },
  );
  if (!ass.includes("Dialogue:")) return null;

  const assPath = join(dir, "subs.ass");
  await writeFile(assPath, ass, "utf-8");
  return assPath;
}

/** Escape path for ffmpeg subtitles filter (Windows-safe). */
export function escapeFfmpegSubPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}
