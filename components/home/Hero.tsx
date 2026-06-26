"use client";

import { motion } from "framer-motion";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Logo } from "@/components/ui/Logo";
import { ClipForge } from "@/components/flow/ClipForge";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-36 sm:pt-44">
      {/* Atmosphere: spotlight + faint grid, masked so it fades out */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-spotlight" />
      <div className="pointer-events-none absolute inset-0 -z-10 mask-fade-b bg-grid-faint bg-[size:64px_64px] opacity-60" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 flex justify-center"
          >
            <Logo variant="full" priority className="mx-auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <Eyebrow>Cortes virais com IA</Eyebrow>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl"
          >
            Transforme qualquer vídeo do YouTube em{" "}
            <span className="text-spark">dezenas de cortes virais</span> usando IA.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg text-white/55"
          >
            Cole um link do YouTube e nossa IA encontra automaticamente os melhores
            momentos para criar vídeos prontos para Shorts, TikTok, Instagram,
            Facebook e Twitter.
          </motion.p>
        </div>

        {/* The forge itself */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 sm:mt-14"
        >
          <ClipForge />
        </motion.div>
      </div>
    </section>
  );
}
