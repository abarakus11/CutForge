import { tmpdir } from "os";
import { isVercelRuntime } from "@/lib/youtube-meta";

let configured = false;

/** ytdl-core writes player scripts to disk; on Vercel only /tmp is writable. */
export function configureYtdlForServerless(): void {
  if (configured) return;
  configured = true;

  if (!isVercelRuntime()) return;

  process.env.YTDL_NO_DEBUG_FILE = "1";
  process.env.YTDL_NO_UPDATE = "1";
  process.env.YTDL_DEBUG_PATH = tmpdir();
}
