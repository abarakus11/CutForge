/**
 * Client-side YouTube duration via IFrame Player API.
 * Used when serverless (Vercel) cannot read duration — runs in the user's browser.
 */

const YT_IFRAME_API = "https://www.youtube.com/iframe_api";

interface YtPlayer {
  getDuration(): number;
  destroy(): void;
}

interface YtPlayerEvent {
  target: YtPlayer;
}

interface YtNamespace {
  Player: new (
    element: HTMLElement,
    config: {
      videoId: string;
      width?: number;
      height?: number;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: YtPlayerEvent) => void;
        onError?: () => void;
      };
    },
  ) => YtPlayer;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<void> | null = null;

function loadYtIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API só funciona no navegador"));
  }

  if (window.YT?.Player) return Promise.resolve();

  if (!apiLoadPromise) {
    apiLoadPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };

      if (document.querySelector(`script[src="${YT_IFRAME_API}"]`)) return;

      const script = document.createElement("script");
      script.src = YT_IFRAME_API;
      script.async = true;
      script.onerror = () => reject(new Error("Falha ao carregar API do YouTube"));
      document.head.appendChild(script);

      setTimeout(() => {
        if (!window.YT?.Player) {
          reject(new Error("Timeout ao carregar API do YouTube"));
        }
      }, 15000);
    });
  }

  return apiLoadPromise;
}

/** Read video duration from the user's browser (bypasses server IP blocks). */
export async function fetchYouTubeDurationClient(videoId: string): Promise<number> {
  await loadYtIframeApi();

  if (!window.YT?.Player) {
    throw new Error("API do YouTube indisponível");
  }

  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(host);

    let player: YtPlayer | null = null;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
      host.remove();
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("Timeout ao ler duração do vídeo")));
    }, 20000);

    player = new window.YT!.Player(host, {
      videoId,
      width: 1,
      height: 1,
      playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
      events: {
        onReady: (event) => {
          const duration = Math.floor(event.target.getDuration());
          if (duration > 0) {
            finish(() => resolve(duration));
          } else {
            finish(() =>
              reject(new Error("Não foi possível ler a duração do vídeo")),
            );
          }
        },
        onError: () => {
          finish(() => reject(new Error("Vídeo indisponível no YouTube")));
        },
      },
    });
  });
}
