# -*- coding: utf-8 -*-
"""
Seed ứng viên ĐANG Ở BƯỚC PHỎNG VẤN nhưng CHƯA có lịch — để test nút "Chốt lịch tay"
(nhánh gọi điện: bộ phận nhân sự tự chọn ứng viên + panel + giờ, không qua magic link).

Khác seed_decision.py: script kia chấm điểm sẵn cho màn Quyết định; script này dừng lại
đúng lúc hồ sơ vào INTERVIEW, không tạo lịch, để dropdown "Ứng viên (đang ở bước Phỏng vấn)"
có người để chọn.

Chạy: python tools/seed_interview_pending.py
Yêu cầu: backend :5082 + MinIO :9000.
"""
import json, sys, uuid, urllib.request, urllib.error

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:5082/api"
PASS = "demo123456"
RECRUITER = "recruiter.7b880@demo.vn"
JOB_ID = 45          # "Lập trình viên Backend (.NET)" — Phòng Kỹ thuật
RUN = uuid.uuid4().hex[:4]
INBOX = "giakhanh27403@gmail.com"

CANDIDATES = [
    ("Ngô Thanh Tùng", "0902000001", ["NGO THANH TUNG - Backend Developer",
        "4 nam kinh nghiem C#, ASP.NET Core, SQL Server.",
        "Tung lam he thong quan ly nhan su cho cong ty 300 nhan vien."]),
    ("Phan Diệu Linh", "0902000002", ["PHAN DIEU LINH - .NET Developer",
        "3 nam kinh nghiem .NET, EF Core, REST API.",
        "Quen lam viec voi Git, CI/CD co ban."]),
    ("Hồ Đăng Kiên", "0902000003", ["HO DANG KIEN - Lap trinh vien Backend",
        "5 nam kinh nghiem, manh ve bao mat ung dung web va JWT.",
        "Da tung thiet ke he thong nhieu khach hang dung chung (multi-tenant)."]),
]


def call(method, path, token=None, body=None, raw_body=None, ctype="application/json"):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = None
    if raw_body is not None:
        data = raw_body
        req.add_header("Content-Type", ctype)
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data=data, timeout=120) as r:
            txt = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(txt) if txt.strip() else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, {"raw": txt[:300]}


def must(status, data, what):
    if status not in (200, 201, 204):
        raise SystemExit(f"LOI {what}: HTTP {status} {json.dumps(data, ensure_ascii=False)[:300]}")
    return data


def make_pdf(lines):
    def esc(t):
        return t.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    content = "BT /F1 11 Tf 40 780 Td 14 TL\n"
    for ln in lines:
        content += f"({esc(ln)}) Tj T*\n"
    content += "ET"
    cb = content.encode("latin-1", "replace")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(cb)).encode() + b" >>\nstream\n" + cb + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 " + str(len(objs) + 1).encode() + b"\n0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (b"trailer\n<< /Size " + str(len(objs) + 1).encode() + b" /Root 1 0 R >>\nstartxref\n"
            + str(xref).encode() + b"\n%%EOF")
    return out


def upload_cv(token, name, email, phone, lines):
    boundary = "----sris" + uuid.uuid4().hex
    parts = b""
    for k, v in [("jobId", str(JOB_ID)), ("candidateName", name),
                 ("candidateEmail", email), ("candidatePhone", phone)]:
        parts += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode("utf-8")
    parts += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cv.pdf\"\r\n"
              f"Content-Type: application/pdf\r\n\r\n").encode() + make_pdf(lines) + b"\r\n"
    parts += f"--{boundary}--\r\n".encode()
    s, d = call("POST", "/cvs/upload", token=token, raw_body=parts,
                ctype=f"multipart/form-data; boundary={boundary}")
    must(s, d, f"upload CV {name}")
    return d.get("applicationId") or d.get("ApplicationId")


s, d = call("POST", "/account/login", body={"email": RECRUITER, "password": PASS})
must(s, d, "login")
rec = d["accessToken"]

local, domain = INBOX.split("@")
for name, phone, cv in CANDIDATES:
    email = f"{local}+{name.split()[-1].lower()}.{RUN}@{domain}"
    app_id = upload_cv(rec, name, email, phone, cv)
    for state in ("SCREENING", "INTERVIEW"):
        must(*call("POST", f"/applications/{app_id}/transition", token=rec, body={"toState": state}),
             f"{name} -> {state}")
    print(f"   + {name:16s} app {app_id} | INTERVIEW, chua co lich")

print(f"""
============================================================
Xong — {len(CANDIDATES)} ung vien o buoc Phong van, CHUA co lich.
Vao Lich phong van -> chon job "Lap trinh vien Backend (.NET)" -> "Chot lich tay":
ba nguoi tren nam trong dropdown "Ung vien (dang o buoc Phong van)".
============================================================""")
