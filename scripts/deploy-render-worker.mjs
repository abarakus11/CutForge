#!/usr/bin/env node
/**
 * Cria ou atualiza o worker no Render via API.
 * Requer: RENDER_API_KEY, RENDER_OWNER_ID (workspace id)
 * Opcional: RENDER_SERVICE_ID (se já existir)
 */
const API = "https://api.render.com/v1";
const key = process.env.RENDER_API_KEY;
const ownerId = process.env.RENDER_OWNER_ID;
const serviceId = process.env.RENDER_SERVICE_ID;
const repo = process.env.RENDER_REPO || "https://github.com/abarakus11/CutForge";

if (!key || !ownerId) {
  console.error("Defina RENDER_API_KEY e RENDER_OWNER_ID");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  let id = serviceId;

  if (!id) {
    const created = await api("/services", {
      method: "POST",
      body: JSON.stringify({
        type: "web_service",
        name: "cutforge-clip-worker",
        ownerId,
        repo,
        branch: "main",
        autoDeploy: "yes",
        serviceDetails: {
          runtime: "docker",
          plan: "free",
          region: "oregon",
          healthCheckPath: "/health",
          dockerContext: ".",
          dockerfilePath: "./worker/Dockerfile",
          envVars: [
            { key: "WHISPER_MODEL", value: "small" },
            { key: "PORT", value: "3001" },
            { key: "YT_DLP_PATH", value: "/usr/local/bin/yt-dlp" },
          ],
        },
      }),
    });
    id = created?.service?.id || created?.id;
    console.log("Service created:", id);
  } else {
    await api(`/services/${id}/deploys`, {
      method: "POST",
      body: JSON.stringify({ clearCache: "do_not_clear" }),
    });
    console.log("Deploy triggered:", id);
  }

  const service = await api(`/services/${id}`);
  const url = service?.service?.serviceDetails?.url || service?.serviceDetails?.url;
  if (url) {
    console.log("\nWorker URL:", url);
    console.log("\nAtualize na Vercel:");
    console.log(`echo ${url} | npx vercel env rm CLIP_WORKER_URL production -y`);
    console.log(`echo ${url} | npx vercel env add CLIP_WORKER_URL production`);
    console.log("npx vercel --prod");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
