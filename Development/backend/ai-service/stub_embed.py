"""
============================================================
SRIS — STUB embedding service (chỉ để TEST luồng, KHÔNG phải AI thật)
------------------------------------------------------------
Thay tạm cho main.py (sentence-transformers) khi máy chưa cài được
torch/transformers (vd Python 3.14 chưa có wheel). Dùng stdlib thuần,
chạy ngay, không cần pip install.

Cách hoạt động: "hashing bag-of-words" -> vector 1024 chiều, chuẩn hóa L2.
- Mỗi token (từ) được hash về 1 chiều trong [0,1024).
- CV trùng nhiều từ khóa với JD -> cosine gần hơn -> điểm cao hơn.
=> Điểm KHÔNG mang ngữ nghĩa như model thật, nhưng ĐỦ để kiểm tra
   luồng tạo job -> nộp CV -> chấm điểm -> xếp hạng chạy đúng.

Contract khớp EmbeddingClient.cs:
  POST /embed  {"text": "..."}  -> {"vector": [1024 floats], "dim": 1024}
  GET  /health                  -> {"status":"ok","dim":1024}

Chạy:  python stub_embed.py   (mặc định port 8000)
============================================================
"""

import json
import math
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DIM = 1024
_token_re = re.compile(r"\w+", re.UNICODE)


def embed(text: str) -> list[float]:
    vec = [0.0] * DIM
    for tok in _token_re.findall((text or "").lower()):
        # hash ổn định (không phụ thuộc PYTHONHASHSEED)
        h = 1469598103934665603
        for ch in tok:
            h = ((h ^ ord(ch)) * 1099511628211) & 0xFFFFFFFFFFFFFFFF
        idx = h % DIM
        sign = 1.0 if (h >> 63) & 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok", "dim": DIM})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/embed":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            text = json.loads(raw).get("text", "")
        except Exception:
            text = ""
        vec = embed(text)
        self._json(200, {"vector": vec, "dim": len(vec)})

    def log_message(self, fmt, *args):  # bớt log ồn
        pass


if __name__ == "__main__":
    import sys

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f">> STUB embedding service (bag-of-words, dim={DIM}) chay tai http://127.0.0.1:{port}")
    print(">> LUU Y: day la stub de TEST luong, KHONG phai AI that.")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
