"use client";

import { motion } from "framer-motion";
import { Link2, Wand2, Download } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const STEPS = [
  {
    icon: Link2,
    title: "Cole o link",
    desc: "Insira qualquer URL do YouTube. Validamos e carregamos o vídeo na hora.",
  },
  {
    icon: Wand2,
    title: "A IA encontra os melhores momentos",
    desc: "Analisamos áudio, contexto e retenção para isolar os trechos com maior potencial viral.",
  },
  {
    icon: Download,
    title: "Baixe seus cortes",
    desc: "Receba todos os cortes prontos, individualmente ou em um único arquivo ZIP.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative mt-40 sm:mt-48">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>Como funciona</Eyebrow>
          <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Do link aos cortes em três passos.
          </h2>
        </div>

        <div className="relative mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Connecting hairline (desktop) */}
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" />

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative"
              >
                <div className="flex items-center gap-4">
                  <span className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-line bg-ink-700 text-spark-glow shadow-soft">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="font-mono text-sm text-white/30">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-medium tracking-tight text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/50">
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
