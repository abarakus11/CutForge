/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@distube/ytdl-core", "ffmpeg-static"],
    outputFileTracingIncludes: {
      "/api/clips/render": ["./node_modules/ffmpeg-static/**/*"],
      "/api/clips/preview": ["./node_modules/ffmpeg-static/**/*"],
      "/api/clips/download": ["./node_modules/ffmpeg-static/**/*"],
    },
  },
  env: {
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
