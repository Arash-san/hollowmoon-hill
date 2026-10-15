"""Kokoro text to speech for the NPCs (and the room speaker), on 127.0.0.1:8834. Runs on one GPU, about 0.15-0.35 s
per sentence, with TTS_WORKERS (6) sentences made at the same time. The game server calls it; browsers never talk to it directly.

    POST /tts  {"text": "...", "voice": "bm_george", "speed": 1.0}  ->  audio/wav (24 kHz mono)
    GET  /health

Start: tools/start.ps1 (hidden), or by hand: .venv\\Scripts\\python server.py
"""
import io
import json
import os
import queue
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import onnxruntime as ort

ort.preload_dlls()
from kokoro_onnx import Kokoro  # noqa: E402
import soundfile as sf  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("TTS_PORT", "8834"))
MODELS = os.path.join(HERE, "models")

# A small pool of sessions (each ~0.3 GB on the GPU) so many players' NPC lines are spoken at the same time.
WORKERS = int(os.environ.get("TTS_WORKERS", "6"))
pool = queue.Queue()
for _ in range(WORKERS):
    s = ort.InferenceSession(os.path.join(MODELS, "kokoro-v1.0.onnx"), providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    k = Kokoro.from_session(s, os.path.join(MODELS, "voices-v1.0.bin"))
    k.create("warm up", voice="bm_george", speed=1.0, lang="en-us")
    pool.put(k)
sess = s
VOICES = set(k.get_voices())


def synth(text, voice, speed):
    k = pool.get()
    try:
        samples, rate = k.create(text, voice=voice if voice in VOICES else "bm_george", speed=max(0.6, min(1.6, speed)), lang="en-us")
    finally:
        pool.put(k)
    buf = io.BytesIO()
    sf.write(buf, samples, rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype="application/json"):
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self.send(200, json.dumps({"ok": True, "providers": sess.get_providers(), "voices": len(VOICES), "workers": WORKERS}).encode())
        self.send(404, b"{}")

    def do_POST(self):
        if self.path != "/tts":
            return self.send(404, b"{}")
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0) or 0)) or b"{}")
            text = str(body.get("text", "")).strip()[:400]
            if not text:
                return self.send(400, b'{"error":"no text"}')
            t = time.time()
            wav = synth(text, str(body.get("voice", "bm_george")), float(body.get("speed", 1.0)))
            self.send_response(200)
            self.send_header("content-type", "audio/wav")
            self.send_header("content-length", str(len(wav)))
            self.send_header("x-ms", str(int((time.time() - t) * 1000)))
            self.end_headers()
            self.wfile.write(wav)
        except Exception as e:  # keep serving
            self.send(500, json.dumps({"error": str(e)[:200]}).encode())


if __name__ == "__main__":
    print(f"tts on 127.0.0.1:{PORT} providers={sess.get_providers()}", flush=True)
    ThreadingHTTPServer.request_queue_size = 256  # the default backlog of 5 refuses connections when many players talk
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
