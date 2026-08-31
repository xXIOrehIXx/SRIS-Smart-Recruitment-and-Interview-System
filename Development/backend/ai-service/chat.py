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

@router.post("/chat")
def chat_with_ollama(req: ChatRequest):
    """Chat hỏi đáp trực tiếp (Không stream) với một model do người dùng chọn."""
    try:
        payload = json.dumps({
            "model": req.model,
            "messages": [{"role": "user", "content": req.message}],
            "stream": False
        }).encode('utf-8')
        
        http_req = urllib.request.Request(
            f"{OLLAMA_BASE_URL}/api/chat",
            data=payload,
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(http_req) as response:
            data = json.loads(response.read().decode())
            return {"reply": data.get("message", {}).get("content", "")}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lỗi chat Ollama: {e}")
