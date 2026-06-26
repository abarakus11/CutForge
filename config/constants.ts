import type { ClipTag, PlatformFormat, ProcessingStage } from "@/types";

/**
 * Target platforms the user can forge clips for.
 * Aspect ratios drive the preview frame on each clip card.
 */
export const PLATFORM_FORMATS: PlatformFormat[] = [
  {
    id: "shorts",
    label: "Shorts",
    icon: "Smartphone",
    aspect: "9:16",
    hint: "YouTube Shorts — até 60s, vertical",
  },
  {
    id: "reels",
    label: "Instagram Reels",
    icon: "Instagram",
    aspect: "9:16",
    hint: "Reels — vertical, foco em retenção",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: "Music2",
    aspect: "9:16",
    hint: "TikTok — ganchos rápidos",
  },
  {
    id: "twitter",
    label: "Twitter / X",
    icon: "Twitter",
    aspect: "1:1",
    hint: "X — clipes curtos e citáveis",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: "Facebook",
    aspect: "16:9",
    hint: "Facebook — alcance amplo",
  },
];

/**
 * Stages shown during processing. Weights sum to 1 and control how the
 * progress bar advances — heavier stages take proportionally longer.
 */
export const PROCESSING_STAGES: ProcessingStage[] = [
  { label: "Analisando áudio", weight: 0.16 },
  { label: "Detectando momentos virais", weight: 0.24 },
  { label: "Separando assuntos", weight: 0.16 },
  { label: "Criando legendas", weight: 0.18 },
  { label: "Gerando cortes", weight: 0.18 },
  { label: "Finalizando", weight: 0.08 },
];

/** Human labels + accent colors for each AI moment category. */
export const TAG_META: Record<
  ClipTag,
  { label: string; className: string }
> = {
  funny: { label: "Engraçado", className: "text-amber-300/90 bg-amber-300/10" },
  impactful: {
    label: "Impactante",
    className: "text-spark-blue bg-spark-blue/10",
  },
  emotional: { label: "Emocionante", className: "text-rose-300/90 bg-rose-300/10" },
  viral: { label: "Viral", className: "text-spark-violet bg-spark-violet/10" },
  lesson: { label: "Ensinamento", className: "text-emerald-300/90 bg-emerald-300/10" },
  question: { label: "Pergunta", className: "text-sky-300/90 bg-sky-300/10" },
  answer: { label: "Resposta", className: "text-teal-300/90 bg-teal-300/10" },
  "topic-shift": {
    label: "Mudança de assunto",
    className: "text-indigo-300/90 bg-indigo-300/10",
  },
  retention: {
    label: "Alta retenção",
    className: "text-fuchsia-300/90 bg-fuchsia-300/10",
  },
};

/** Highlight colors for karaoke word-by-word captions. */
export const CAPTION_HIGHLIGHT_COLORS = [
  { id: "yellow", label: "Amarelo", hex: "#FFFF00" },
  { id: "lime", label: "Verde limão", hex: "#B8FF00" },
  { id: "cyan", label: "Ciano", hex: "#00FFFF" },
  { id: "orange", label: "Laranja", hex: "#FF9500" },
  { id: "pink", label: "Rosa", hex: "#FF4FD8" },
  { id: "red", label: "Vermelho", hex: "#FF3333" },
] as const;

export const DEFAULT_CAPTION_SETTINGS = {
  language: "auto",
  highlightColor: "#FFFF00",
} as const;

/** Human-readable labels for common YouTube subtitle language codes. */
export const CAPTION_LANG_LABELS: Record<string, string> = {
  pt: "Português",
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  en: "Inglês",
  "en-US": "Inglês (EUA)",
  "en-GB": "Inglês (UK)",
  es: "Espanhol",
  fr: "Francês",
  de: "Alemão",
  it: "Italiano",
  ja: "Japonês",
  ko: "Coreano",
  zh: "Chinês",
  "zh-Hans": "Chinês (simplificado)",
  "zh-Hant": "Chinês (tradicional)",
  ru: "Russo",
  ar: "Árabe",
  hi: "Hindi",
  auto: "Automático (idioma do vídeo)",
};

/** Brand constants reused across metadata and UI. */
export const BRAND = {
  name: "CutForge AI",
  slogan:
    "Transforme qualquer vídeo do YouTube em dezenas de cortes virais em segundos.",
  author: "SheikDev",
} as const;
