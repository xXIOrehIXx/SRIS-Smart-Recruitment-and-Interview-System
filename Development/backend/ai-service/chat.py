import json
import urllib.request
import urllib.error
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["Test Chat"])

OLLAMA_BASE_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")

@router.get("/models")
def get_ollama_models():
    """Lấy danh sách các model đang cài trong Ollama cục bộ."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags")
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return {"models": [m["name"] for m in data.get("models", [])]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không kết nối được Ollama: {e}")

class ChatRequest(BaseModel):
    model: str
    message: str

from fastapi.responses import StreamingResponse

@router.post("/chat/stream")
def chat_stream_ollama(req: ChatRequest):
    """Chat trực tiếp với Ollama sử dụng luồng (Stream) để tránh timeout."""
    def generate():
        payload = json.dumps({
            "model": req.model,
            "messages": [{"role": "user", "content": req.message}],
            "stream": True
        }).encode('utf-8')
        
        http_req = urllib.request.Request(
            f"{OLLAMA_BASE_URL}/api/chat",
            data=payload,
            headers={'Content-Type': 'application/json'}
        )
        try:
            with urllib.request.urlopen(http_req) as response:
                for line in response:
                    if line:
                        yield line
        except Exception as e:
            yield json.dumps({"error": str(e)}).encode('utf-8')

    return StreamingResponse(generate(), media_type="application/x-ndjson")
