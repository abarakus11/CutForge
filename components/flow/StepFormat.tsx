"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Instagram,
  Music2,
  Twitter,
  Facebook,
  ArrowRight,
  Subtitles,
  Palette,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type { CaptionSettings, PlatformId, VideoMeta } from "@/types";
import {
  CAPTION_HIGHLIGHT_COLORS,
  PLATFORM_FORMATS,
} from "@/config/constants";
import { VideoPreview } from "@/components/flow/VideoPreview";
import { Button } from "@/components/ui/Button";
import { fetchSubtitleLanguages } from "@/services/captions";
import { cn } from "@/utils/cn";

const ICONS: Record<string, LucideIcon> = {
  Smartphone,
  Instagram,
  Music2,
  Twitter,
  Facebook,
};

interface StepFormatProps {
  video: VideoMeta;
  captions: CaptionSettings;
  onCaptionsChange: (captions: CaptionSettings) => void;
  onConfirm: (format: PlatformId, captions: CaptionSettings) => void;
  onBack: () => void;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

export function StepFormat({
  video,
  captions,
  onCaptionsChange,
  onConfirm,
  onBack,
}: StepFormatProps) {
  const [selectedFormat, setSelectedFormat] = useState<PlatformId | null>(null);
  const [langOptions, setLangOptions] = useState<
    { lang: string; label: string }[]
  >([{ lang: "auto", label: "Automático (idioma do vídeo)" }]);
  const [loadingLangs, setLoadingLangs] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingLangs(true);
    fetchSubtitleLanguages(video.id)
      .then((tracks) => {
        if (cancelled) return;
        const opts = [
          { lang: "auto", label: "Automático (idioma do vídeo)" },
          ...tracks.map((t) => ({ lang: t.lang, label: t.label })),
        ];
        setLangOptions(opts);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingLangs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [video.id]);

  const canContinue = selectedFormat !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full space-y-7"
    >
      <VideoPreview video={video} />

      <div>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-medium tracking-tight text-white">
            Escolha o formato dos cortes
          </h2>
          <button
            onClick={onBack}
            className="text-sm text-white/45 transition-colors hover:text-white"
          >
            Trocar vídeo
          </button>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {PLATFORM_FORMATS.map((format) => {
            const Icon = ICONS[format.icon] ?? Smartphone;
            const selected = selectedFormat === format.id;
            return (
              <motion.button
                key={format.id}
                variants={item}
                onClick={() => setSelectedFormat(format.id)}
                className={cn(
                  "group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left backdrop-blur-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spark-glow/70",
                  selected
                    ? "border-spark-glow/60 bg-spark-violet/10 shadow-glow"
                    : "border-line bg-white/[0.03] hover:-translate-y-0.5 hover:border-spark-glow/40 hover:bg-white/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-xl transition-colors",
                    selected
                      ? "bg-spark-gradient text-white"
                      : "bg-white/[0.05] text-white/80 group-hover:bg-spark-gradient group-hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[15px] font-medium text-white">
                    {format.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/40">
                    {format.aspect} • {format.hint}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <div className="rounded-2xl border border-line bg-white/[0.03] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2 text-white">
          <Subtitles className="h-4 w-4 text-spark-violet" />
          <h3 className="text-[15px] font-medium">Legendas</h3>
        </div>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="caption-lang"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40"
            >
              Idioma da legenda
            </label>
            <div className="relative">
              <select
                id="caption-lang"
                value={captions.language}
                disabled={loadingLangs}
                onChange={(e) =>
                  onCaptionsChange({ ...captions, language: e.target.value })
                }
                className="h-11 w-full appearance-none rounded-xl border border-line bg-ink-600/80 px-4 text-sm text-white focus:border-spark-glow/50 focus:outline-none focus:ring-1 focus:ring-spark-glow/40"
              >
                {langOptions.map((opt) => (
                  <option key={opt.lang} value={opt.lang}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {loadingLangs && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-white/40" />
              <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                Cor da palavra falada
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CAPTION_HIGHLIGHT_COLORS.map((color) => {
                const selected = captions.highlightColor === color.hex;
                return (
                  <button
                    key={color.id}
                    type="button"
                    title={color.label}
                    onClick={() =>
                      onCaptionsChange({
                        ...captions,
                        highlightColor: color.hex,
                      })
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
                      selected
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-line bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white",
                    )}
                  >
                    <span
                      className="h-4 w-4 rounded-full ring-1 ring-white/20"
                      style={{ backgroundColor: color.hex }}
                    />
                    {color.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-white/35">
              Cada palavra fica{" "}
              <span
                className="font-medium"
                style={{ color: captions.highlightColor }}
              >
                destacada
              </span>{" "}
              no momento em que é falada no vídeo.
            </p>
          </div>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!canContinue}
        onClick={() => {
          if (!selectedFormat) return;
          onConfirm(selectedFormat, captions);
        }}
      >
        <ArrowRight className="h-4 w-4" />
        Gerar cortes com legendas
      </Button>
    </motion.div>
  );
}
