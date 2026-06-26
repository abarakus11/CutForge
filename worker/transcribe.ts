import { spawn } from "child_process";
import { accessSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  mergeWordCues,
  type CaptionCue,
  type WordCue,
} from "../lib/captions-core";
import { runFfmpeg } from "./clip-render";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface TranscriptionResult {
  language: string;
  words: WordCue[];
  cues: CaptionCue[];
}

function pythonCmd(): string {
  return process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
}

function scriptPath(): string {
  return join(__dirname, "transcribe.py");
}

/** Extrai áudio mono 16 kHz WAV — ideal para Whisper. */
export async function extractAudioForWhisper(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
}

function runPythonTranscribe(
  audioPath: string,
  lang?: string | null,
): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    const args = [scriptPath(), audioPath];
    if (lang && lang !== "auto") args.push(lang);

    const proc = spawn(pythonCmd(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c) => (stdout += c.toString()));
    proc.stderr.on("data", (c) => (stderr += c.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `whisper exit ${code}`));
        return;
      }
      try {
        const data = JSON.parse(stdout) as {
          error?: string;
          language?: string;
          words?: WordCue[];
        };
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        const words = (data.words || []).filter(
          (w) => w.text?.trim() && w.end > w.start,
        );
        resolve({
          language: data.language || lang || "pt",
          words,
          cues: mergeWordCues(words),
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    proc.on("error", reject);
  });
}

/** Transcreve um arquivo de áudio/vídeo local com Whisper (worker). */
export async function transcribeMediaFile(
  mediaPath: string,
  workDir: string,
  lang?: string | null,
): Promise<TranscriptionResult> {
  const wavPath = join(workDir, "whisper-input.wav");
  await extractAudioForWhisper(mediaPath, wavPath);
  return runPythonTranscribe(wavPath, lang);
}

export function isWhisperAvailable(): boolean {
  try {
    accessSync(scriptPath());
    return true;
  } catch {
    return false;
  }
}
