"use client";

import { motion } from "framer-motion";
import {
  Laugh,
  Quote,
  HeartPulse,
  TrendingUp,
  GraduationCap,
  MessageCircleQuestion,
  Shuffle,
  Captions,
  Languages,
} from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const FEATURES = [
  { icon: Laugh, title: "Momentos engraçados", desc: "Detecta risadas e timing cômico que prendem a atenção." },
  { icon: Quote, title: "Frases impactantes", desc: "Encontra falas citáveis com potencial de viralizar." },
  { icon: HeartPulse, title: "Trechos emocionantes", desc: "Identifica picos de emoção na voz e no contexto." },
  { icon: TrendingUp, title: "Alta retenção", desc: "Prioriza os trechos com maior poder de reter o público." },
  { icon: GraduationCap, title: "Ensinamentos", desc: "Isola lições e insights que entregam valor real." },
  { icon: MessageCircleQuestion, title: "Perguntas e respostas", desc: "Separa as melhores perguntas e respostas da conversa." },
  { icon: Shuffle, title: "Mudanças de assunto", desc: "Reconhece transições para cortes coerentes e completos." },
  { icon: Captions, title: "Legendas por IA", desc: "Transcreve a fala de cada corte e gera legendas karaokê automaticamente." },
  { icon: Languages, title: "Tradução multilíngue", desc: "Estrutura pronta para traduzir legendas para vários idiomas." },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export function Features() {
  return (
    <section id="recursos" className="relative mt-40 sm:mt-48">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>O que a IA encontra</Eyebrow>
          <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Cada momento que merece um corte, identificado automaticamente.
          </h2>
          <p className="mt-4 text-balance text-white/55">
            Quanto mais momentos interessantes o vídeo tiver, mais cortes a CutForge
            produz. Sem limite de quantidade.
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={item}
                className="group rounded-2xl border border-line bg-white/[0.025] p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-spark-glow transition-colors group-hover:bg-spark-gradient group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-medium text-white">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/45">
                  {feature.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
