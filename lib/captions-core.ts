/** Pure caption parsing + ASS (browser-safe). */

export interface WordCue {
  start: number;
  end: number;
  text: string;
}

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
  words?: WordCue[];
}

export interface CaptionStyleOptions {
  highlightColor: string;
  baseColor?: string;
  /** ASS Fontname, e.g. "Arial Black". */
  fontFamily?: string;
}

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

const WORD_TAG_RE =
  /<(\d{1,2}:\d{2}:\d{2}\.\d{3})><c>\s*([^<]*?)\s*<\/c>/g;
const FIRST_TAG_RE = /<(\d{1,2}:\d{2}:\d{2}\.\d{3})><c>/;

function parseTimestamp(value: string): number {
  const parts = value.trim().split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return Number(h) * 3600 + Number(m) * 60 + parseFloat(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return Number(m) * 60 + parseFloat(s);
  }
  return parseFloat(value);
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, entity: string) => {
    const named: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
      nbsp: " ",
    };
    if (named[entity]) return named[entity];
    if (entity.startsWith("#x")) {
      return String.fromCharCode(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCharCode(parseInt(entity.slice(1), 10));
    }
    return match;
  });
}

function stripVttTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\\N/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clean raw caption text from YouTube VTT/SRT artifacts. */
export function cleanCaptionText(text: string): string {
  return decodeHtmlEntities(stripVttTags(text))
    .replace(/(?:^|\s)>>\s*/g, " ")
    .replace(/\s*>>\s*/g, " ")
    .replace(/^[>\s]+/g, "")
    .replace(/[>\s]+$/g, "")
    .replace(/[♪🎵🎶\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidWord(text: string): boolean {
  const t = cleanCaptionText(text);
  if (!t || t.length > 36) return false;
  if (!/[a-zA-ZÀ-ÿ0-9]/.test(t)) return false;
  return true;
}

/** Extract per-word timings from a single VTT line (only lines with <c> tags). */
function parseWordTimedLine(
  line: string,
  blockStart: number,
  blockEnd: number,
): WordCue[] {
  if (!line.includes("<c>")) return [];

  const words: WordCue[] = [];
  const firstTag = line.match(FIRST_TAG_RE);

  if (firstTag?.index && firstTag.index > 0) {
    const preText = cleanCaptionText(line.slice(0, firstTag.index));
    if (preText && !preText.includes(" ") && isValidWord(preText)) {
      const firstTime = parseTimestamp(firstTag[1]);
      words.push({ start: blockStart, end: firstTime, text: preText });
    }
  }

  const tagged: { time: number; text: string }[] = [];
  let match: RegExpExecArray | null;
  WORD_TAG_RE.lastIndex = 0;
  while ((match = WORD_TAG_RE.exec(line)) !== null) {
    const text = cleanCaptionText(match[2]);
    if (text && isValidWord(text)) {
      tagged.push({ time: parseTimestamp(match[1]), text });
    }
  }

  for (let i = 0; i < tagged.length; i++) {
    const end = i + 1 < tagged.length ? tagged[i + 1].time : blockEnd;
    if (end > tagged[i].time) {
      words.push({ start: tagged[i].time, end, text: tagged[i].text });
    }
  }

  return words;
}

function dedupeWords(words: WordCue[]): WordCue[] {
  const sorted = [...words].sort((a, b) => a.start - b.start);
  const result: WordCue[] = [];

  for (const w of sorted) {
    const prev = result[result.length - 1];
    if (prev) {
      const sameText = prev.text.toLowerCase() === w.text.toLowerCase();
      if (sameText && Math.abs(prev.start - w.start) < 0.15) continue;
      if (sameText && w.start - prev.start < 0.6) continue;
    }
    result.push({ ...w });
  }

  for (let i = 0; i < result.length; i++) {
    const next = result[i + 1];
    if (next && next.start > result[i].start) {
      result[i].end = next.start;
    }
    if (result[i].end <= result[i].start) {
      result[i].end = result[i].start + 0.22;
    }
  }

  return result;
}

/** Parse YouTube VTT — only timed lines, skips rolling duplicate blocks. */
export function parseVttWords(content: string): WordCue[] {
  const allWords: WordCue[] = [];
  const blocks = content.replace(/\uFEFF/g, "").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (!lines.length) continue;

    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;

    const [rawStart, rawEnd] = timeLine
      .split("-->")
      .map((s) => s.trim().split(" ")[0]);
    const blockStart = parseTimestamp(rawStart);
    const blockEnd = parseTimestamp(rawEnd);

    if (blockEnd - blockStart < 0.05) continue;

    const textLines = lines.filter(
      (l) => l !== timeLine && !/^\d+$/.test(l) && !/^WEBVTT/.test(l),
    );

    for (const line of textLines) {
      if (!line.includes("<c>")) continue;
      allWords.push(...parseWordTimedLine(line, blockStart, blockEnd));
    }
  }

  return dedupeWords(allWords);
}

/** Parse a WebVTT file into plain timed cues (fallback). */
export function parseVtt(content: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  const blocks = content.replace(/\uFEFF/g, "").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (!lines.length) continue;

    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;

    const [rawStart, rawEnd] = timeLine
      .split("-->")
      .map((s) => s.trim().split(" ")[0]);
    const start = parseTimestamp(rawStart);
    const end = parseTimestamp(rawEnd);

    if (end - start < 0.05) continue;

    const textLines = lines.filter(
      (l) => l !== timeLine && !/^\d+$/.test(l) && !/^WEBVTT/.test(l) && !l.includes("<c>"),
    );
    const text = cleanCaptionText(textLines.join(" "));
    if (text && end > start && text.length <= 120) {
      cues.push({ start, end, text });
    }
  }

  return cues;
}

const MAX_LINE_CHARS = 28;
const MAX_WORDS_PER_CHUNK = 5;
const MAX_BLOCK_DURATION = 3.5;
const MERGE_GAP = 0.35;

export function formatDisplayText(text: string): string {
  const words = text.split(" ").filter(Boolean);
  if (!words.length) return "";
  if (text.length <= MAX_LINE_CHARS) return text;

  let bestSplit = -1;
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(" ");
    const line2 = words.slice(i).join(" ");
    if (line1.length > MAX_LINE_CHARS || line2.length > MAX_LINE_CHARS) continue;
    const score = Math.abs(line1.length - line2.length);
    if (score < bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  if (bestSplit > 0) {
    return `${words.slice(0, bestSplit).join(" ")}\n${words.slice(bestSplit).join(" ")}`;
  }

  return text;
}

export function mergeCues(cues: CaptionCue[]): CaptionCue[] {
  const cleaned = cues
    .map((c) => ({ ...c, text: cleanCaptionText(c.text) }))
    .filter((c) => c.text.length > 0);

  if (!cleaned.length) return [];

  const merged: CaptionCue[] = [];
  let buffer = cleaned[0].text;
  let start = cleaned[0].start;
  let end = cleaned[0].end;

  const flush = () => {
    const text = formatDisplayText(buffer.trim());
    if (!text) return;
    merged.push({
      start,
      end: Math.max(end, start + 0.6),
      text,
    });
  };

  for (let i = 1; i < cleaned.length; i++) {
    const cue = cleaned[i];
    const gap = cue.start - end;
    const combined = `${buffer} ${cue.text}`.trim();
    const duration = end - start;
    const endsSentence = /[.!?…]$/.test(buffer);

    const shouldFlush =
      gap > MERGE_GAP ||
      endsSentence ||
      duration >= MAX_BLOCK_DURATION ||
      combined.split(" ").length > MAX_WORDS_PER_CHUNK;

    if (shouldFlush) {
      flush();
      buffer = cue.text;
      start = cue.start;
      end = cue.end;
    } else {
      buffer = combined;
      end = cue.end;
    }
  }

  flush();
  return merged;
}

export function mergeWordCues(words: WordCue[]): CaptionCue[] {
  if (!words.length) return [];

  const merged: CaptionCue[] = [];
  let chunk: WordCue[] = [];
  let chunkStart = words[0].start;
  let chunkEnd = words[0].end;

  const flush = () => {
    if (!chunk.length) return;
    const text = formatDisplayText(chunk.map((w) => w.text).join(" "));
    if (!text) return;
    merged.push({
      start: chunkStart,
      end: Math.max(chunkEnd, chunkStart + 0.6),
      text,
      words: [...chunk],
    });
    chunk = [];
  };

  for (const w of words) {
    if (!chunk.length) {
      chunkStart = w.start;
      chunk.push(w);
      chunkEnd = w.end;
      continue;
    }

    const gap = w.start - chunkEnd;
    const wordCount = chunk.length + 1;
    const duration = chunkEnd - chunkStart;
    const endsSentence = /[.!?…]$/.test(chunk[chunk.length - 1].text);

    const shouldFlush =
      gap > MERGE_GAP ||
      endsSentence ||
      duration >= MAX_BLOCK_DURATION ||
      wordCount > MAX_WORDS_PER_CHUNK;

    if (shouldFlush) {
      flush();
      chunkStart = w.start;
    }

    chunk.push(w);
    chunkEnd = w.end;
  }

  flush();
  return merged;
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\N")
    .replace(/{/g, "(")
    .replace(/}/g, ")");
}

/** Convert #RRGGBB to ASS &HBBGGRR format. */
export function hexToAssColor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "&H00FFFFFF";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `&H00${b.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${r.toString(16).padStart(2, "0")}`.toUpperCase();
}

function wordToHighlightTag(
  w: WordCue,
  chunkStart: number,
  baseAss: string,
  highlightAss: string,
): string {
  const startMs = Math.max(0, Math.round((w.start - chunkStart) * 1000));
  const endMs = Math.max(startMs + 80, Math.round((w.end - chunkStart) * 1000));
  return `{\\1c${baseAss}&\\t(${startMs},${endMs},\\1c${highlightAss}&)}${escapeAssText(w.text)}`;
}

function buildKaraokeText(
  words: WordCue[],
  chunkStart: number,
  baseAss: string,
  highlightAss: string,
): string {
  if (!words.length) return "";

  const fullText = words.map((w) => w.text).join(" ");
  const formatted = formatDisplayText(fullText);

  if (!formatted.includes("\n")) {
    return words
      .map((w) => wordToHighlightTag(w, chunkStart, baseAss, highlightAss))
      .join(" ");
  }

  const line2WordCount = formatted.split("\n")[1].split(" ").filter(Boolean).length;
  const splitAt = words.length - line2WordCount;
  const line1 = words
    .slice(0, splitAt)
    .map((w) => wordToHighlightTag(w, chunkStart, baseAss, highlightAss))
    .join(" ");
  const line2 = words
    .slice(splitAt)
    .map((w) => wordToHighlightTag(w, chunkStart, baseAss, highlightAss))
    .join(" ");
  return `${line1}\\N${line2}`;
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

/** Build ASS subtitles for a clip segment, timed from 0. */
export function buildClipAss(
  cues: CaptionCue[],
  clipStart: number,
  clipEnd: number,
  width: number,
  height: number,
  style: CaptionStyleOptions = { highlightColor: "#FFFF00" },
): string {
  const fontSize = Math.round(height * 0.052);
  const marginV = Math.round(height * 0.11);
  const marginH = Math.round(width * 0.06);
  const baseAss = hexToAssColor(style.baseColor || "#FFFFFF");
  const highlightAss = hexToAssColor(style.highlightColor);
  const fontName = sanitizeAssFontName(style.fontFamily || "Arial Black");

  const clipped = cues
    .filter((c) => c.end > clipStart && c.start < clipEnd)
    .map((c) => {
      const words = (c.words ?? wordsFromPlainCue(c))
        .filter((w) => w.end > clipStart && w.start < clipEnd)
        .map((w) => ({
          start: Math.max(0, w.start - clipStart),
          end: Math.min(clipEnd - clipStart, w.end - clipStart),
          text: w.text,
        }))
        .filter((w) => w.end > w.start && w.text);

      if (!words.length) return null;

      const relStart = words[0].start;
      const relEnd = words[words.length - 1].end;

      return { start: relStart, end: relEnd, words };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.end - c.start > 0.05);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,${fontName},${fontSize},${baseAss},${highlightAss},&H00000000,&HC0000000,1,0,0,0,100,100,0,0,1,5,2,2,${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = clipped
    .map((c) => {
      const karaoke = buildKaraokeText(
        c.words,
        c.start,
        baseAss,
        highlightAss,
      );
      return `Dialogue: 0,${formatAssTime(c.start)},${formatAssTime(c.end + 0.15)},Karaoke,,0,0,0,,${karaoke}`;
    })
    .join("\n");

  return `${header}${events}\n`;
}

/** Validate a hex highlight color from user input. */
export function parseHighlightColor(value: string | null | undefined): string {
  if (!value) return "#FFFF00";
  const v = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  return "#FFFF00";
}

function sanitizeAssFontName(name: string): string {
  const cleaned = name.replace(/[^\w\s-]/g, "").trim().slice(0, 48);
  return cleaned || "Arial Black";
}

/** Resolve caption font id to ASS font name. */
export function resolveCaptionFontAssName(
  fontId: string | null | undefined,
  fonts: ReadonlyArray<{ id: string; ass: string }>,
): string {
  const found = fonts.find((f) => f.id === fontId);
  return sanitizeAssFontName(found?.ass || "Arial Black");
}

/** Validate caption font id from user input. */
export function parseCaptionFont(
  value: string | null | undefined,
  fonts: ReadonlyArray<{ id: string }>,
): string {
  if (!value) return fonts[0]?.id || "arial-black";
  return fonts.some((f) => f.id === value) ? value : fonts[0]?.id || "arial-black";
}