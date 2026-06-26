/**
 * Shared domain types for CutForge AI.
 *
 * These are intentionally backend-agnostic. When the real pipeline lands
 * (YouTube download → transcription → viral detection → render), the service
 * layer can return these exact shapes without any UI changes.
 */

export type PlatformId =
  | "shorts"
  | "reels"
  | "tiktok"
  | "twitter"
  | "facebook";

export interface PlatformFormat {
  id: PlatformId;
  label: string;
  /** Lucide icon name resolved in the component layer. */
  icon: string;
  /** e.g. "9:16" — used for the card preview frame. */
  aspect: string;
  hint: string;
}

export interface VideoMeta {
  id: string;
  url: string;
  title: string;
  channel: string;
  /** Seconds. */
  duration: number;
  thumbnail: string;
}

/** A category the AI assigns to a detected moment. */
export type ClipTag =
  | "funny"
  | "impactful"
  | "emotional"
  | "viral"
  | "lesson"
  | "question"
  | "answer"
  | "topic-shift"
  | "retention";

export interface Clip {
  id: string;
  title: string;
  /** Seconds. */
  start: number;
  end: number;
  duration: number;
  /** Model confidence that this is share-worthy (0–1). */
  score: number;
  tags: ClipTag[];
  thumbnail: string;
  format: PlatformId;
}

/** Steps in the generation flow. */
export type FlowStep = "url" | "format" | "processing" | "results";

/** User-selected caption rendering options. */
export interface CaptionSettings {
  /** BCP-47 / YouTube lang code, e.g. "pt", "en". */
  language: string;
  /** Hex color for the spoken-word highlight, e.g. "#FFFF00". */
  highlightColor: string;
  /** Caption font id from CAPTION_FONTS. */
  fontFamily: string;
}

export interface SubtitleTrack {
  lang: string;
  label: string;
  auto: boolean;
}

export interface ProcessingStage {
  label: string;
  /** Weight of this stage in the overall progress bar (0–1). */
  weight: number;
}
