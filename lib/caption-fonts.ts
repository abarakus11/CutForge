/** Fonts for burned-in karaoke captions (system fonts via ffmpeg/libass). */
export const CAPTION_FONTS = [
  { id: "arial-black", label: "Arial Black", ass: "Arial Black" },
  { id: "impact", label: "Impact", ass: "Impact" },
  { id: "arial", label: "Arial", ass: "Arial" },
  { id: "verdana", label: "Verdana", ass: "Verdana" },
  { id: "tahoma", label: "Tahoma", ass: "Tahoma" },
  { id: "comic-sans", label: "Comic Sans", ass: "Comic Sans MS" },
  { id: "georgia", label: "Georgia", ass: "Georgia" },
] as const;

export type CaptionFontId = (typeof CAPTION_FONTS)[number]["id"];
