import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./config/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core surfaces — near-black with a cold blue undertone.
        ink: {
          DEFAULT: "#07080C",
          800: "#0B0D13",
          700: "#0F1219",
          600: "#141823",
          500: "#1B2030",
        },
        // The forge spark — electric blue → violet.
        spark: {
          blue: "#5B8CFF",
          indigo: "#6E7BFF",
          violet: "#A66BFF",
          glow: "#7C93FF",
        },
        line: "rgba(255,255,255,0.08)",
        haze: "rgba(255,255,255,0.04)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,147,255,0.18), 0 8px 40px -8px rgba(91,140,255,0.35)",
        soft: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 24px 60px -24px rgba(0,0,0,0.8)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -30px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "spark-gradient":
          "linear-gradient(120deg, #5B8CFF 0%, #6E7BFF 45%, #A66BFF 100%)",
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) forwards",
        shimmer: "shimmer 1.8s infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spin-slow 14s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
