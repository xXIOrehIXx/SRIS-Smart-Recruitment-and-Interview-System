# -*- coding: utf-8 -*-
"""
Seed dữ liệu cho màn "Quyết định tuyển dụng" (DM).

Điều kiện để một hồ sơ hiện ở màn đó (HiringDecision.jsx):
  - Application đang ở state INTERVIEW
  - Job thuộc ĐÚNG phòng ban của DM đang đăng nhập (V023 — BE tự thu hẹp)
  - decision-brief có totalSubmitted > 0  => phải có phiếu chấm ĐÃ NỘP

Nên mỗi ứng viên seed sẽ: nộp CV -> SCREENING -> INTERVIEW -> chốt lịch tay
(panel interviewer) -> từng interviewer chấm đủ tiêu chí + nộp phiếu kèm đề xuất.

Khác seed_demo.py: script kia dựng CẢ pipeline từ đầu trong công ty của tài khoản admin
truyền vào; script này chỉ bơm thêm hồ sơ đã-chấm-xong vào MỘT job có sẵn (JOB_ID bên dưới)
để màn Quyết định của trưởng bộ phận có dữ liệu ngay. Đổi JOB_ID / tài khoản khi seed công ty khác.

Chạy: python tools/seed_decision.py
Yêu cầu: backend :5082 + MinIO :9000 (KHÔNG cần AI service).
"""
import json, sys, time, uuid, urllib.request, urllib.error

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:5082/api"
PASS = "demo123456"
RECRUITER = "recruiter.7b880@demo.vn"
# Cửa SCREENING->INTERVIEW là của Trưởng bộ phận (chốt 15/08/2026): token nhân sự bị 403.
MANAGER = "dm.7b880@demo.vn"
IV1 = "interviewer1.7b880@demo.vn"
IV2 = "interviewer2.7b880@demo.vn"
JOB_ID = 45          # "Lập trình viên Backend (.NET)" — Phòng Kỹ thuật, DM = manager@test.com
IV1_ID, IV2_ID = 33, 34
RUN = uuid.uuid4().hex[:4]
INBOX = "giakhanh27403@gmail.com"


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
        raise SystemExit(f"LOI {what}: HTTP {status} {json.dumps(data, ensure_ascii=False)[:400]}")
    return data


def login(email):
    s, d = call("POST", "/account/login", body={"email": email, "password": PASS})
    must(s, d, f"login {email}")
    return d["accessToken"]


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
    """HR nộp hộ CV -> tạo Candidate + Application (NEW)."""
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


def submit_sheet(iv_token, schedule_id, scores_by_index, recommendation, summary, notes=None):
    """Chấm ĐỦ mọi tiêu chí rồi nộp — thiếu 1 tiêu chí hoặc thiếu đề xuất là BE chặn."""
    s, sheet = call("GET", f"/interview-schedules/{schedule_id}/my-sheet", token=iv_token)
    must(s, sheet, "lay phieu cham")
    crits = sheet["criteria"]
    items = []
    for i, c in enumerate(crits):
        raw = scores_by_index[i % len(scores_by_index)]
        items.append({
            "criteriaId": c["criteriaId"],
            "score": min(raw, c.get("maxScore") or 10),
            "note": (notes or {}).get(i),
        })
    must(*call("PUT", f"/interview-schedules/{schedule_id}/my-sheet", token=iv_token,
               body={"items": items, "recommendation": recommendation, "summary": summary}), "luu nhap")
    must(*call("POST", f"/interview-schedules/{schedule_id}/my-sheet/submit", token=iv_token), "nop phieu")


# ---------------------------------------------------------------- dữ liệu ứng viên
# (tên, CV, lịch phỏng vấn ngày +N, panel, [(điểm nền, đề xuất, nhận xét, note tiêu chí)])
CANDIDATES = [
    dict(
        name="Đặng Minh Khoa", phone="0901234501", day=3,
        cv=["DANG MINH KHOA - Backend Developer",
            "5 nam kinh nghiem C# / ASP.NET Core, dan dat nhom 4 nguoi.",
            "Thanh thao SQL Server, EF Core, toi uu truy van cho he thong 2 trieu ban ghi.",
            "Trien khai CI/CD GitHub Actions, kinh nghiem he thong multi-tenant."],
        panel="both",
        sheets=[
            dict(scores=[9, 9, 8], rec="STRONG_HIRE",
                 summary="Nền tảng .NET rất chắc, giải thích được vì sao chọn từng giải pháp. "
                         "Có kinh nghiệm multi-tenant đúng thứ dự án đang cần. Đề nghị tuyển sớm.",
                 notes={0: "Trả lời sâu về async/await và deadlock", 2: "Viết được query tối ưu ngay trên giấy"}),
            dict(scores=[8, 9, 8], rec="HIRE",
                 summary="Kỹ thuật tốt, tư duy hệ thống rõ ràng. Hơi ít kinh nghiệm làm việc với khách hàng "
                         "nhưng không phải vấn đề với vị trí này."),
        ],
    ),
    dict(
        name="Bùi Thu Trang", phone="0901234502", day=4,
        cv=["BUI THU TRANG - .NET Developer",
            "3 nam kinh nghiem ASP.NET Core, lam he thong quan ly kho.",
            "Dung EF Core, SQL Server o muc kha. Da tung viet REST API co JWT.",
            "Chua tung lam CI/CD, dang tu hoc Docker."],
        panel="both",
        sheets=[
            dict(scores=[8, 7, 7], rec="HIRE",
                 summary="Đủ sức nhận việc ngay ở mức Middle. Phần DevOps còn yếu nhưng học nhanh, "
                         "đội có người kèm được."),
            dict(scores=[6, 7, 6], rec="CONSIDER",
                 summary="Kiến thức nền ổn nhưng trả lời phần bảo mật còn chung chung. "
                         "Cần cân nhắc nếu vị trí đòi tự chủ ngay.",
                 notes={5: "Chưa phân biệt rõ authentication và authorization"}),
        ],
    ),
    dict(
        name="Lý Hoàng Nam", phone="0901234503", day=5,
        cv=["LY HOANG NAM - Lap trinh vien",
            "2 nam kinh nghiem, chu yeu lam PHP, moi chuyen sang C# duoc 6 thang.",
            "Biet SQL co ban. Chua lam viec voi EF Core."],
        panel="both",
        sheets=[
            dict(scores=[5, 6, 5], rec="CONSIDER",
                 summary="Nhiệt tình, chịu học, nhưng nền .NET còn mỏng — nhận thì phải tính thời gian kèm."),
            dict(scores=[4, 5, 4], rec="NO_HIRE",
                 summary="Chưa đáp ứng yêu cầu kỹ thuật của vị trí ở thời điểm này. "
                         "Có thể xem lại sau 6–12 tháng nữa."),
        ],
    ),
    dict(
        name="Trịnh Khánh Vy", phone="0901234504", day=6,
        cv=["TRINH KHANH VY - Fresher",
            "Moi tot nghiep, lam do an web bang ASP.NET Core.",
            "Chua co kinh nghiem di lam chinh thuc."],
        panel="both",
        sheets=[
            dict(scores=[4, 4, 3], rec="NO_HIRE",
                 summary="Kiến thức mới dừng ở mức đồ án, chưa đủ cho vị trí yêu cầu 2+ năm."),
            dict(scores=[3, 4, 4], rec="NO_HIRE",
                 summary="Thái độ tốt nhưng chưa phù hợp vị trí này. Gợi ý ứng tuyển lại vị trí thực tập."),
        ],
    ),
    dict(
        name="Đỗ Quang Hải", phone="0901234505", day=7,
        cv=["DO QUANG HAI - Senior Backend",
            "7 nam kinh nghiem .NET, tung lam kien truc su cho he thong ban le.",
            "Manh ve SQL Server, EF Core, bao mat ung dung web, CI/CD."],
        panel="one",  # chỉ 1 interviewer -> blind review không bật, demo ca panel 1 người
        sheets=[
            dict(scores=[9, 8, 9], rec="HIRE",
                 summary="Kinh nghiệm dày, tự chủ hoàn toàn. Mức lương mong muốn hơi cao so với khung, "
                         "cần trưởng bộ phận cân nhắc ngân sách."),
        ],
    ),
]


print(">> Dang nhap ...")
rec = login(RECRUITER)
dm = login(MANAGER)
iv1 = login(IV1)
iv2 = login(IV2)
# Ai bấm bước nào: nhân sự sàng lọc, Trưởng bộ phận duyệt vào vòng phỏng vấn.
STEP_TOKEN = {"SCREENING": rec, "INTERVIEW": dm}
iv_tokens = {IV1_ID: iv1, IV2_ID: iv2}

s, job = call("GET", f"/jobs/{JOB_ID}", token=rec)
must(s, job, "lay job")
print(f">> Job {JOB_ID}: {job.get('title')} | phong ban: {job.get('department')} | run={RUN}")

local, domain = INBOX.split("@")
created = []

for c in CANDIDATES:
    email = f"{local}+{c['name'].split()[-1].lower()}.{RUN}@{domain}"
    app_id = upload_cv(rec, c["name"], email, c["phone"], c["cv"])

    # V045: Truong bo phan chi dinh nguoi phong van NGAY khi duyet vao vong phong van.
    # Khong gui interviewerIds thi lenh dat lich ben duoi bi BE tu choi (409).
    panel = [IV1_ID, IV2_ID] if c["panel"] == "both" else [IV1_ID]

    for state in ("SCREENING", "INTERVIEW"):
        body = {"toState": state}
        if state == "INTERVIEW":
            body["interviewerIds"] = panel
        must(*call("POST", f"/applications/{app_id}/transition", token=STEP_TOKEN[state], body=body),
             f"{c['name']} -> {state}")

    start = time.strftime(f"%Y-%m-%dT09:00:00Z", time.gmtime(time.time() + c["day"] * 86400))
    s, sch = call("POST", f"/applications/{app_id}/interviews", token=rec,
                  body={"interviewerIds": panel, "startTime": start, "roundNumber": 1})
    must(s, sch, f"chot lich {c['name']}")
    sched_id = sch["scheduleId"]

    for idx, sheet in enumerate(c["sheets"]):
        submit_sheet(iv_tokens[panel[idx]], sched_id, sheet["scores"],
                     sheet["rec"], sheet["summary"], sheet.get("notes"))

    created.append((app_id, c["name"], len(c["sheets"])))
    print(f"   + {c['name']:18s} app {app_id} | lich {start[:10]} | {len(c['sheets'])} phieu DA NOP")

print(f"""
============================================================
SEED XONG — {len(created)} ho so cho man "Quyet dinh tuyen dung"
Dang nhap: manager@test.com (DepartmentManager, Phong Ky thuat)
  -> Quyet dinh tuyen dung: {', '.join(n for _, n, _ in created)}
Ho so van o INTERVIEW, DM bam Duyet (-> OFFER) hoac Tu choi.
============================================================""")
