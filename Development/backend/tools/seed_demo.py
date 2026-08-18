# -*- coding: utf-8 -*-
"""
============================================================
SRIS — Seed dữ liệu DEMO qua API thật (đi qua RLS + hàng đợi chấm điểm + magic link).

Tạo trong company của tài khoản admin đăng nhập:
  - 4 user: recruiter / 2 interviewer / DM  (mật khẩu chung: demo123456)
  - 3 job JD đầy đủ + bộ tiêu chí APPROVED (chỉ name + weight + maxScore)
  - 1 Yêu cầu tuyển dụng của DM -> Recruiter duyệt -> convert vào job
  - 6 ứng viên nộp CV PDF qua career site
  - Pipeline đủ trạng thái: NEW / SCREENING / INTERVIEW / OFFER / HIRED / REJECTED
  - 1 pool phỏng vấn (panel 2 interviewer) + ứng viên đã chốt lịch qua magic link
  - Phiếu chấm ĐÃ NỘP kèm đề xuất + nhận xét (mở blind, qua guard G2, có dữ liệu
    cho màn "Quyết định tuyển dụng" của DM)
  - 1 offer đang chờ trả lời + 1 offer đã ghi nhận NHẬN VIỆC (-> HIRED)

Chạy:  python tools/seed_demo.py [email] [password]
       (mặc định claude-test@example.com / newpass123)
Yêu cầu: backend :5082 + MinIO :9000. KHÔNG cần AI service: tiêu chí seed gõ tay
(APPROVED ngay), không gọi /extract-criteria.
Chạy lại nhiều lần vô hại — mỗi lần tạo thêm 1 lứa dữ liệu mới.
============================================================
"""
import json, sys, time, uuid, unicodedata, random, urllib.request, urllib.error

# Console Windows mặc định cp1252 không in được tiếng Việt
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:5082/api"
ADMIN_EMAIL = sys.argv[1] if len(sys.argv) > 1 else "claude-test@example.com"
ADMIN_PASS = sys.argv[2] if len(sys.argv) > 2 else "newpass123"
PASS = "demo123456"
# Email ứng viên demo = plus-address của hộp thư thật -> mail magic link rơi vào inbox này,
# không bounce như địa chỉ bịa. Đổi qua env/tham số nếu cần.
DEMO_INBOX = "giakhanh27403@gmail.com"

def ascii_slug(text):
    t = unicodedata.normalize("NFD", text)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in t.lower() if c.isalnum())
RUN = uuid.uuid4().hex[:5]  # hậu tố để chạy lại không đụng email UNIQUE


def call(method, path, token=None, body=None, raw_body=None, ctype="application/json", ok_codes=(200, 201, 204)):
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
        with urllib.request.urlopen(req, data=data, timeout=180) as r:
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


def login(email, password):
    s, d = call("POST", "/account/login", body={"email": email, "password": password})
    must(s, d, f"login {email}")
    return d["accessToken"]


# ---------- PDF tối giản có lớp text (PdfExtractor đọc được) ----------
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


def apply_cv(slug, job_id, name, email, phone, cv_lines):
    boundary = "----sris" + uuid.uuid4().hex
    parts = b""
    for k, v in [("candidateName", name), ("candidateEmail", email), ("candidatePhone", phone)]:
        parts += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode("utf-8")
    pdf = make_pdf(cv_lines)
    parts += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cv.pdf\"\r\n"
              f"Content-Type: application/pdf\r\n\r\n").encode() + pdf + b"\r\n"
    parts += f"--{boundary}--\r\n".encode()
    s, d = call("POST", f"/public/{slug}/jobs/{job_id}/apply", raw_body=parts,
                ctype=f"multipart/form-data; boundary={boundary}")
    must(s, d, f"apply {name}")
    return d["applicationId"]


print(f">> Dang nhap admin {ADMIN_EMAIL} ...")
admin = login(ADMIN_EMAIL, ADMIN_PASS)
s, company = call("GET", "/company", token=admin)
must(s, company, "lay company")
slug = company.get("slug") or company.get("Slug")
print(f">> Company slug = {slug} | run = {RUN}")

# ---------- 1) User noi bo ----------
users = {}
for email, role, fullname in [
    (f"recruiter.{RUN}@demo.vn", "Recruiter", "Trần Thu Hà (Recruiter)"),
    (f"interviewer1.{RUN}@demo.vn", "Interviewer", "Lê Minh Đức (Interviewer)"),
    (f"interviewer2.{RUN}@demo.vn", "Interviewer", "Phạm Quang Huy (Interviewer)"),
    (f"dm.{RUN}@demo.vn", "DepartmentManager", "Ngô Thị Lan (Trưởng phòng)"),
    (f"director.{RUN}@demo.vn", "Director", "Bùi Quang Hưng (Giám đốc)"),
]:
    s, d = call("POST", "/users", token=admin,
                body={"email": email, "password": PASS, "fullName": fullname, "role": role})
    must(s, d, f"tao user {email}")
    users[role + ("2" if role == "Interviewer" and "interviewer2" in email else "")] = \
        {"id": d.get("userId") or d.get("UserId"), "email": email}
    print(f"   + {role:20s} {email}")

recruiter = login(users["Recruiter"]["email"], PASS)
dm = login(users["DepartmentManager"]["email"], PASS)
director = login(users["Director"]["email"], PASS)
iv1 = login(users["Interviewer"]["email"], PASS)
iv2 = login(users["Interviewer2"]["email"], PASS)

# ---------- 2) Jobs ----------
jobs = {}
for key, title, jd in [
    ("java", f"Java Developer [{RUN}]",
     "Tuyen Java Developer: toi thieu 2 nam kinh nghiem Java va Spring Boot, thanh thao SQL Server, "
     "uu tien biet Docker, CI/CD. Ky nang giao tiep tot, lam viec nhom. Luong 18-30 trieu."),
    ("ketoan", f"Kế toán tổng hợp [{RUN}]",
     "Tuyen Ke toan tong hop: 3 nam kinh nghiem ke toan, thanh thao Excel va phan mem MISA, "
     "uu tien co chung chi ke toan truong. Can than, trung thuc. Luong 12-18 trieu."),
    ("sale", f"Nhân viên kinh doanh [{RUN}]",
     "Tuyen Nhan vien kinh doanh: 1 nam kinh nghiem ban hang/cham soc khach hang, giao tiep tot, "
     "chiu duoc ap luc doanh so. Uu tien biet tieng Anh. Luong cung + hoa hong."),
]:
    # departmentManagerId BAT BUOC khi dang tin (Status mac dinh = Open): DM la cua duyet
    # ung vien vao vong phong van (chot 15/08/2026), thieu thi ho so ket o Sang loc.
    s, d = call("POST", "/jobs", token=recruiter,
                body={"title": title, "jdText": jd,
                      "departmentManagerId": users["DepartmentManager"]["id"]})
    must(s, d, f"tao job {title}")
    jobs[key] = d["jobId"]
    print(f"   + Job {d['jobId']}: {title}")

# ---------- 3) Tieu chi (manual -> APPROVED ngay, khong phu thuoc LLM) ----------
# Mot tieu chi CHI CON name + weight + maxScore: criteriaType (HARD/SOFT), cvMatchable,
# keywords la mo hinh du lieu cua may cham CV — tinh nang da cat khoi scope 08/08/2026,
# cot da xoa hẳn o V038.
CRITERIA = {
    "java": [
        ("2 năm kinh nghiệm Java", 3),
        ("Kinh nghiệm Spring Boot", 3),
        ("Thành thạo SQL Server", 2),
        ("Biết Docker / CI-CD", 1),
        ("Kỹ năng giao tiếp, làm việc nhóm", 1),
    ],
    "ketoan": [
        ("3 năm kinh nghiệm kế toán", 3),
        ("Thành thạo MISA", 3),
        ("Thành thạo Excel", 2),
        ("Chứng chỉ kế toán trưởng", 1),
    ],
    "sale": [
        ("Kinh nghiệm bán hàng", 3),
        ("Chăm sóc khách hàng", 2),
        ("Tiếng Anh giao tiếp", 1),
    ],
}
for key, items in CRITERIA.items():
    for name, w in items:
        s, d = call("POST", f"/jobs/{jobs[key]}/criteria", token=recruiter,
                    body={"name": name, "weight": w, "maxScore": 10})
        must(s, d, f"tieu chi {name}")
print("   + Tieu chi APPROVED cho 3 job")

# ---------- 4) Yeu cau tuyen dung: DM ra de -> duyet -> convert ----------
s, req = call("POST", "/recruitment-requests", token=dm, body={
    "title": f"Cần tuyển gấp Java Developer [{RUN}]", "department": "Phòng Kỹ thuật",
    "quantity": 2, "employmentType": "FULL_TIME", "experienceLevel": "Middle",
    "description": "Team backend thiếu người sau khi mở rộng dự án.",
    "requirements": "2 năm Java, Spring Boot\nƯu tiên biết Docker", "salaryMin": 18000000, "salaryMax": 30000000})
must(s, req, "tao yeu cau tuyen dung")
rid = req["requestId"]
must(*call("POST", f"/recruitment-requests/{rid}/review", token=recruiter, body={"approve": True}), "duyet yeu cau")
must(*call("POST", f"/recruitment-requests/{rid}/convert", token=recruiter, body={"jobId": jobs["java"]}), "convert yeu cau")
# them 1 yeu cau dang PENDING de demo man duyet
must(*call("POST", "/recruitment-requests", token=dm, body={
    "title": f"Tuyển Nhân viên kinh doanh khu vực miền Bắc [{RUN}]", "department": "Phòng Kinh doanh",
    "quantity": 3, "description": "Mở rộng thị trường Hà Nội."}), "yeu cau PENDING")
print("   + Yeu cau tuyen dung: 1 CONVERTED + 1 PENDING")

# ---------- 5) Ung vien nop CV qua career site ----------
CVS = [
    # (job, ten, cv lines) — do khop giam dan
    ("java", "Nguyễn Văn An", ["NGUYEN VAN AN - Java Developer",
        "4 nam kinh nghiem Java, Spring Boot, xay dung API thanh toan.",
        "Thanh thao SQL Server, toi uu truy van cho he thong lon.",
        "Su dung Docker, CI/CD voi GitHub Actions. Truong nhom 3 nguoi.",
        "Ky nang giao tiep tot, tung thuyet trinh cho khach hang."]),
    ("java", "Trần Bích Ngọc", ["TRAN BICH NGOC - Backend Developer",
        "2 nam kinh nghiem Java va Spring Boot tai cong ty fintech.",
        "Lam viec voi SQL Server va PostgreSQL.",
        "Dang hoc Docker. Tinh than hoc hoi cao."]),
    ("java", "Phạm Hữu Thọ", ["PHAM HUU THO - Fresher IT",
        "Tot nghiep CNTT, biet C# va Python co ban.",
        "Chua co kinh nghiem lam viec chinh thuc.",
        "Mong muon duoc dao tao them."]),
    ("ketoan", "Lê Thị Hồng", ["LE THI HONG - Ke toan tong hop",
        "5 nam kinh nghiem ke toan tong hop tai cong ty san xuat.",
        "Thanh thao MISA, Excel nang cao (pivot, vlookup).",
        "Co chung chi ke toan truong. Can than, trung thuc."]),
    ("ketoan", "Vũ Đình Long", ["VU DINH LONG - Nhan vien kho",
        "3 nam lam thu kho, kiem ke hang hoa.",
        "Biet Excel co ban. Chua dung MISA."]),
    ("sale", "Hoàng Mai Phương", ["HOANG MAI PHUONG - Nhan vien kinh doanh",
        "2 nam kinh nghiem ban hang B2B, cham soc khach hang.",
        "Dat 120% doanh so nam 2025. Tieng Anh giao tiep."]),
]
apps = {}
for jobkey, name, lines in CVS:
    local, domain = DEMO_INBOX.split("@")
    email = f"{local}+uv.{ascii_slug(name.split()[-1])}.{RUN}@{domain}"
    app_id = apply_cv(slug, jobs[jobkey], name, email, "0912345678", lines)
    apps[name] = {"id": app_id, "job": jobkey}
    print(f"   + {name} -> nop CV job {jobkey} (app {app_id})")

# ---------- 6) Pipeline: keo trang thai ----------
# (Truoc day cho AI cham diem CV o day. Sang loc CV bang AI + Talent Pool da bi cat khoi
#  scope 08/08/2026: khong con endpoint /cv-scoring, nhan ho so chi con parse + luu file.)
# Panel co dinh cua demo. V045: Truong bo phan chi dinh nguoi phong van NGAY khi duyet vao
# vong phong van; khong chi dinh thi BE tu choi moi lenh dat lich o muc 7.
iv_ids = [users["Interviewer"]["id"], users["Interviewer2"]["id"]]


def transition(app, to):
    # Ai bam buoc nao (V043): nhan su sang loc (NEW->SCREENING), Truong bo phan duyet vao
    # vong phong van (SCREENING->INTERVIEW), GIAM DOC quyet tuyen (INTERVIEW->OFFER, roi OFFER).
    token = director if to in ("OFFER", "HIRED") else dm if to == "INTERVIEW" else recruiter
    body = {"toState": to}
    if to == "INTERVIEW":
        body["interviewerIds"] = iv_ids
    must(*call("POST", f"/applications/{apps[app]['id']}/transition", token=token, body=body),
         f"{app} -> {to}")

# An (java): -> INTERVIEW -> (cham diem) -> OFFER PENDING
transition("Nguyễn Văn An", "SCREENING"); transition("Nguyễn Văn An", "INTERVIEW")
# Ngoc (java): dung o SCREENING
transition("Trần Bích Ngọc", "SCREENING")
# Tho (java): REJECT kem ly do
must(*call("POST", f"/applications/{apps['Phạm Hữu Thọ']['id']}/reject", token=recruiter,
           body={"reason": "Chưa đủ kinh nghiệm Java theo yêu cầu (fresher)"}), "reject Tho")
# Hong (ke toan): -> INTERVIEW (se HIRED)
transition("Lê Thị Hồng", "SCREENING"); transition("Lê Thị Hồng", "INTERVIEW")
# Long (ke toan): dung o NEW · Phuong (sale): SCREENING
transition("Hoàng Mai Phương", "SCREENING")
print("   + Pipeline: NEW/SCREENING/INTERVIEW/REJECTED da co du")

# ---------- 7) Dat lich phong van (panel 2 interviewer) ----------
# 15/08/2026: khong con pool khung + magic link SCHEDULE. Nhan su goi dien chot gio roi NHAP
# buoi vao he thong (POST /applications/{id}/interviews).
_offs = random.randint(0, 40)  # phút lệch theo run — tránh trùng giờ giữa các lần seed
future = time.strftime(f"%Y-%m-%dT09:{_offs:02d}:00", time.gmtime(time.time() + 3 * 86400))
# Buoi cua Hong: NGAY KHAC. Backend chan 2 buoi cach nhau < 1 tieng (cung interviewer hoac
# cung ung vien) -> dung lai `future` se an 409.
future3 = time.strftime(f"%Y-%m-%dT09:{_offs:02d}:00", time.gmtime(time.time() + 4 * 86400))
s, book = call("POST", f"/applications/{apps['Nguyễn Văn An']['id']}/interviews", token=recruiter,
               body={"interviewerIds": iv_ids, "startTime": future, "name": "Phỏng vấn chuyên môn"})
must(s, book, "dat lich phong van An")
sched_id = book["scheduleId"]
print(f"   + Da dat lich phong van cho An (schedule {sched_id}, panel 2 interviewer)")

# ---------- 8) 2 interviewer cham + nop phieu (mo blind, du guard G2) ----------
# Nop phieu BAT BUOC co `recommendation` (V031) va phai cham DU moi tieu chi — thieu mot
# trong hai la BE tra 400. `summary` la thu trưởng bộ phận doc dau tien o man Quyet dinh.
def submit_sheet(token_iv, schedule_id, base_score, recommendation, summary):
    s, sheet = call("GET", f"/interview-schedules/{schedule_id}/my-sheet", token=token_iv)
    must(s, sheet, "lay phieu cham")
    items = [{"criteriaId": c["criteriaId"],
              "score": min(c.get("maxScore") or 10, base_score + i % 3),
              "note": "Trả lời tốt, có dẫn chứng dự án cũ" if i == 0 else None}
             for i, c in enumerate(sheet["criteria"])]
    must(*call("PUT", f"/interview-schedules/{schedule_id}/my-sheet", token=token_iv,
               body={"items": items, "recommendation": recommendation, "summary": summary}), "luu nhap")
    must(*call("POST", f"/interview-schedules/{schedule_id}/my-sheet/submit", token=token_iv), "nop phieu")

submit_sheet(iv1, sched_id, 8, "HIRE",
             "Nền tảng Java/Spring Boot chắc, trả lời được câu hỏi tình huống. Nên tuyển.")
submit_sheet(iv2, sched_id, 7, "CONSIDER",
             "Kỹ thuật ổn nhưng phần thiết kế hệ thống còn chung chung — cần cân nhắc mức lương.")
print("   + 2 phieu cham DA NOP -> panel aggregate co du lieu, guard G2 dat")

# ---------- 9) Offer: An PENDING · Hong ACCEPT -> HIRED ----------
# POST /offer KHONG tu transition: OfferService bat hồ sơ phải ĐANG ở OFFER rồi mới cho tạo
# thư (nguoi quyet tuyen la DM/Recruiter, khac nguoi soan thu). Nen phai keo INTERVIEW->OFFER
# truoc — buoc nay qua guard G2 (>=1 phieu cham SUBMITTED, vua nop o buoc 8).
# V043: cua INTERVIEW->OFFER la cua GIAM DOC (transition() tu chon token). Duong day du
# "DM de xuat -> Giam doc duyet phieu HiringProposal" xem o seed_demo_full.py.
transition("Nguyễn Văn An", "OFFER")
s, offer = call("POST", f"/applications/{apps['Nguyễn Văn An']['id']}/offer", token=recruiter,
                body={"salaryAmount": 25000000, "note": "Offer Java Developer — chờ phản hồi", "expiresInDays": 7})
must(s, offer, "offer An")
print("   + Offer cho An: dang cho tra loi (thu moi xem duoc trong UI)")

# Hong: chot lich tay -> cham -> OFFER -> ACCEPT -> HIRED
s, manual = call("POST", f"/applications/{apps['Lê Thị Hồng']['id']}/manual-interview", token=recruiter,
                 body={"interviewerIds": [iv_ids[0]], "startTime": future3})
must(s, manual, "chot lich tay Hong")
submit_sheet(iv1, manual["scheduleId"], 9, "STRONG_HIRE",
             "Kinh nghiệm MISA/Excel đúng yêu cầu, cẩn thận và trả lời rành mạch. Đề nghị tuyển.")
transition("Lê Thị Hồng", "OFFER")
s, offer2 = call("POST", f"/applications/{apps['Lê Thị Hồng']['id']}/offer", token=recruiter,
                 body={"salaryAmount": 16000000, "note": "Offer Kế toán tổng hợp", "expiresInDays": 7})
must(s, offer2, "offer Hong")
# Ứng viên trả lời NGOÀI hệ thống (5.15): trang thư mời chỉ để ĐỌC, không có nút đồng ý/từ
# chối. Human Resource ghi nhận lại kết quả -> HIRED (accepted=false thì REJECTED).
must(*call("POST", f"/applications/{apps['Lê Thị Hồng']['id']}/offer/outcome", token=recruiter,
           body={"accepted": True, "note": "Ứng viên xác nhận nhận việc qua điện thoại"}),
     "ghi nhan Hong nhan viec")
print("   + Hong nhan viec (Human Resource ghi nhan) -> HIRED")

print(f"""
============================================================
SEED XONG! Cong ty: {slug}
Tai khoan demo (mat khau chung: {PASS}):
  Recruiter    : {users['Recruiter']['email']}
  Interviewer 1: {users['Interviewer']['email']}
  Interviewer 2: {users['Interviewer2']['email']}
  DM           : {users['DepartmentManager']['email']}
Xem ngay:
  - Kanban job Java: 1 OFFER(An) + 1 SCREENING(Ngoc) + 1 REJECTED(Tho)
  - Dashboard: co HIRED(Hong) + funnel + ly do loai + offer acceptance
  - Lich phong van job Java: pool panel 2 nguoi, 1 slot DA DAT
  - Interviewer 1/2 dang nhap -> lich su cham; DM -> tong hop panel
  - Yeu cau tuyen dung: 1 da convert + 1 cho duyet
============================================================""")
