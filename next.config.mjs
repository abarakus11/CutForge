/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Garante render no navegador em todo deploy Vercel (build-time).
    NEXT_PUBLIC_FORCE_CLIENT_RENDER:
      process.env.VERCEL === "1" ? "1" : "0",
    NEXT_PUBLIC_CLIP_WORKER_URL: process.env.CLIP_WORKER_URL || "",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i9.ytimg.com" },
    ],
  },
};

export default nextConfig;
