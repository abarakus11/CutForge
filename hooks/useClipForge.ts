"use client";

/**
 * useClipForge — the single source of truth for the generation flow.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CaptionSettings,
  Clip,
  FlowStep,
  PlatformId,
  VideoMeta,
} from "@/types";
import { DEFAULT_CAPTION_SETTINGS } from "@/config/constants";
import { fetchVideoMeta } from "@/services/youtube";
import { generateClips } from "@/services/clips";

interface ClipForgeState {
  step: FlowStep;
  url: string;
  video: VideoMeta | null;
  format: PlatformId | null;
  captions: CaptionSettings;
  clips: Clip[];
  isValidating: boolean;
  error: string | null;
}

const INITIAL: ClipForgeState = {
  step: "url",
  url: "",
  video: null,
  format: null,
  captions: { ...DEFAULT_CAPTION_SETTINGS },
  clips: [],
  isValidating: false,
  error: null,
};

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useClipForge() {
  const [state, setState] = useState<ClipForgeState>(INITIAL);
  const stateRef = useLatest(state);

  const setUrl = useCallback((url: string) => {
    setState((s) => ({ ...s, url, error: null }));
  }, []);

  const setCaptions = useCallback((captions: CaptionSettings) => {
    setState((s) => ({ ...s, captions }));
  }, []);

  const submitUrl = useCallback(
    async (rawUrl?: string) => {
      const url = (rawUrl ?? "").trim();
      setState((s) => ({ ...s, isValidating: true, error: null, url: url || s.url }));

      try {
        const target = url || stateRef.current.url;
        const video = await fetchVideoMeta(target);
        setState((s) => ({ ...s, video, step: "format", isValidating: false }));
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Não foi possível analisar esse vídeo. Tente novamente.";
        setState((s) => ({
          ...s,
          isValidating: false,
          error: msg,
        }));
      }
    },
    [stateRef],
  );

  const confirmFormat = useCallback(
    (format: PlatformId, captions: CaptionSettings) => {
      setState((s) => ({ ...s, format, captions, step: "processing" }));
    },
    [],
  );

  const finishProcessing = useCallback(async () => {
    const { video, format } = stateRef.current;
    if (!video || !format) return;
    const clips = await generateClips(video, format);
    setState((s) => ({ ...s, clips, step: "results" }));
  }, [stateRef]);

  const reset = useCallback(() => setState(INITIAL), []);

  const goToStep = useCallback((step: FlowStep) => {
    setState((s) => ({ ...s, step }));
  }, []);

  return {
    ...state,
    setUrl,
    setCaptions,
    submitUrl,
    confirmFormat,
    finishProcessing,
    reset,
    goToStep,
  };
}
