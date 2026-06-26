#!/usr/bin/env python3
"""Transcreve áudio com faster-whisper e retorna palavras com timestamps (JSON)."""
import json
import os
import sys


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: transcribe.py <audio.wav> [lang]"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ("auto", "") else None

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper não instalado"}))
        sys.exit(2)

    model_name = os.environ.get("WHISPER_MODEL", "small")
    model = WhisperModel(model_name, device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        audio_path,
        language=lang,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
    )

    words = []
    for seg in segments:
        if seg.words:
            for w in seg.words:
                text = (w.word or "").strip()
                if not text:
                    continue
                words.append(
                    {
                        "start": round(float(w.start), 3),
                        "end": round(float(w.end), 3),
                        "text": text,
                    }
                )
        else:
            text = (seg.text or "").strip()
            if text:
                words.append(
                    {
                        "start": round(float(seg.start), 3),
                        "end": round(float(seg.end), 3),
                        "text": text,
                    }
                )

    print(
        json.dumps(
            {
                "language": info.language or lang or "pt",
                "words": words,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
