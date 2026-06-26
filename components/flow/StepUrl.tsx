"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Link2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { validateYouTubeUrl } from "@/services/youtube";
import { cn } from "@/utils/cn";

interface StepUrlProps {
  url: string;
  isValidating: boolean;
  error: string | null;
  onChange: (url: string) => void;
  onSubmit: (url: string) => void;
}

const EXAMPLES = [
  "youtu.be/dQw4w9WgXcQ",
  "youtube.com/watch?v=...",
];

export function StepUrl({
  url,
  isValidating,
  error,
  onChange,
  onSubmit,
}: StepUrlProps) {
  const [touched, setTouched] = useState(false);
  const valid = validateYouTubeUrl(url);
  const showInlineError = touched && url.length > 0 && !valid;

  const handleSubmit = () => {
    setTouched(true);
    if (valid && !isValidating) onSubmit(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div
        className={cn(
          "group relative rounded-2xl border bg-white/[0.03] p-1.5 backdrop-blur-xl transition-all duration-300",
          showInlineError
            ? "border-rose-400/40"
            : "border-line focus-within:border-spark-glow/50 focus-within:shadow-glow",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3 px-4">
            <Link2 className="h-5 w-5 shrink-0 text-white/35" />
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Cole o link do vídeo do YouTube"
              aria-label="Link do vídeo do YouTube"
              className="h-12 w-full bg-transparent text-[15px] text-white placeholder:text-white/30 focus:outline-none sm:h-14"
            />
          </div>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={isValidating}
            className="shrink-0 sm:min-w-[180px]"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar cortes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex min-h-[20px] items-center justify-between px-1">
        {showInlineError || error ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-rose-300/90">
            <AlertCircle className="h-3.5 w-3.5" />
            {error ?? "Cole um link válido do YouTube para continuar."}
          </span>
        ) : (
          <span className="hidden items-center gap-2 text-xs text-white/30 sm:flex">
            Exemplos:
            {EXAMPLES.map((ex) => (
              <code
                key={ex}
                className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/45"
              >
                {ex}
              </code>
            ))}
          </span>
        )}
      </div>
    </motion.div>
  );
}
