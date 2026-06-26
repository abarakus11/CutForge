"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

const PLANS = [
  {
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    desc: "Para experimentar a CutForge.",
    features: ["3 vídeos por mês", "Cortes em 720p", "Legendas automáticas", "Download individual"],
    cta: "Começar grátis",
    featured: false,
  },
  {
    name: "Pro",
    price: "R$ 49",
    period: "/mês",
    desc: "Para criadores que publicam todo dia.",
    features: [
      "Vídeos ilimitados",
      "Cortes em 1080p",
      "Download em ZIP",
      "Tradução de legendas",
      "Histórico de cortes",
    ],
    cta: "Assinar Pro",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    desc: "Para agências e times de conteúdo.",
    features: ["Tudo do Pro", "Fila prioritária", "API de integração", "Múltiplos usuários", "Suporte dedicado"],
    cta: "Falar com vendas",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="precos" className="relative mt-40 sm:mt-48">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <Eyebrow>Planos</Eyebrow>
          </div>
          <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Comece grátis. Escale quando quiser.
          </h2>
          <p className="mt-4 text-white/55">
            Estrutura de planos pronta para integração de pagamento (Stripe, Mercado
            Pago, Pix) e sistema de créditos.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "relative flex flex-col rounded-3xl border p-6 backdrop-blur-xl transition-all duration-300",
                plan.featured
                  ? "border-spark-glow/40 bg-white/[0.04] shadow-glow"
                  : "border-line bg-white/[0.025] hover:border-white/15",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-spark-gradient px-3 py-1 text-[11px] font-medium text-white shadow-glow">
                  <Sparkles className="h-3 w-3" />
                  Mais popular
                </span>
              )}

              <h3 className="text-lg font-medium text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-white/45">{plan.desc}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-white">
                  {plan.price}
                </span>
                <span className="text-sm text-white/40">{plan.period}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm text-white/65">
                    <Check className="h-4 w-4 shrink-0 text-spark-glow" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.featured ? "primary" : "glass"}
                className="mt-7 w-full"
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
