"use client";

import { AnimatePresence } from "framer-motion";
import { useClipForge } from "@/hooks/useClipForge";
import { StepIndicator } from "@/components/flow/StepIndicator";
import { StepUrl } from "@/components/flow/StepUrl";
import { StepFormat } from "@/components/flow/StepFormat";
import { StepProcessing } from "@/components/flow/StepProcessing";
import { StepResults } from "@/components/flow/StepResults";

/**
 * ClipForge — the interactive core of the landing page.
 *
 * Renders exactly one step at a time and animates between them. All state and
 * transitions live in `useClipForge`, so this component stays declarative.
 */
export function ClipForge() {
  const forge = useClipForge();
  const isWide = forge.step === "results";

  return (
    <div
      className={
        isWide
          ? "mx-auto w-full max-w-6xl"
          : "mx-auto w-full max-w-2xl"
      }
    >
      {forge.step !== "url" && <StepIndicator current={forge.step} />}

      <AnimatePresence mode="wait">
        {forge.step === "url" && (
          <StepUrl
            key="url"
            url={forge.url}
            isValidating={forge.isValidating}
            error={forge.error}
            onChange={forge.setUrl}
            onSubmit={forge.submitUrl}
          />
        )}

        {forge.step === "format" && forge.video && (
          <StepFormat
            key="format"
            video={forge.video}
            captions={forge.captions}
            onCaptionsChange={forge.setCaptions}
            onConfirm={forge.confirmFormat}
            onBack={forge.reset}
          />
        )}

        {forge.step === "processing" && forge.video && (
          <StepProcessing
            key="processing"
            video={forge.video}
            onComplete={forge.finishProcessing}
          />
        )}

        {forge.step === "results" && forge.video && forge.format && (
          <StepResults
            key="results"
            video={forge.video}
            clips={forge.clips}
            selectedFormat={forge.format}
            captions={forge.captions}
            onReset={forge.reset}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
