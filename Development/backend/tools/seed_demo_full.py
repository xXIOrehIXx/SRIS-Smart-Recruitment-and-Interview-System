# -*- coding: utf-8 -*-
"""
============================================================
SRIS — Seed bộ dữ liệu DEMO ĐẦY ĐỦ qua API thật (đi đúng nghiệp vụ + RLS).

Khác `seed_demo.py` (bộ nhỏ, 3 job / 6 ứng viên, tên job có hậu tố ngẫu nhiên):
bộ này dựng nguyên một công ty như thật để demo trước hội đồng —
  - 6 phòng ban (Phòng Kỹ thuật gán DM -> job phòng này DM quyết tuyển)
  - 5 tài khoản nội bộ: HR / 3 Interviewer / DM  (mật khẩu chung: demo123456)
  - 8 tin tuyển dụng JD đầy đủ (mô tả + yêu cầu + phúc lợi + lương + số lượng),
    1 tin đã đóng, mỗi tin có bộ tiêu chí APPROVED = phiếu chấm phỏng vấn
  - 4 Yêu cầu tuyển dụng: 2 chờ duyệt · 1 đã duyệt & convert · 1 bị từ chối
  - ~37 ứng viên nộp CV PDF qua career site, phủ HẾT 6 state:
    NEW · SCREENING · INTERVIEW · OFFER · HIRED · REJECTED
  - Phỏng vấn: pool slot dùng chung (có slot đã đặt + slot còn trống + người được
    mời chưa chọn giờ = "chuẩn bị phỏng vấn"), phiếu chấm ĐÃ NỘP của panel 2 người
  - Offer: đang chờ trả lời · đã nhận việc (HIRED) · đã từ chối (REJECTED)
  - Ghi chú nội bộ trên vài hồ sơ

Chạy:
  python tools/seed_demo_full.py --admin <email> --pass <password>
                                 [--base http://localhost:5082/api]
                                 [--tag t2]      # hậu tố email user nội bộ khi chạy lại
                                 [--inbox mail@gmail.com]  # hộp thư nhận magic link thật

Yêu cầu: backend + MinIO đang chạy. KHÔNG cần AI service (tiêu chí seed gõ tay,
APPROVED ngay, không gọi /extract-criteria).

Chạy lại lần 2 trên cùng DB: nhớ đổi --tag, nếu không email user nội bộ sẽ trùng
(email UNIQUE toàn hệ thống từ V028) — script sẽ tự đăng nhập lại user cũ nếu trùng.
============================================================
"""
import json
import sys
import time
import uuid
import unicodedata
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# ------------------------------------------------------------------ tham số
def arg(name, default=None):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


BASE = arg("--base", "http://localhost:5082/api").rstrip("/")
ADMIN_EMAIL = arg("--admin", "admin@test.com")
ADMIN_PASS = arg("--pass", "123456")
TAG = arg("--tag", "")                       # "" -> email đẹp: hr@sris.vn
INBOX = arg("--inbox", "giakhanh27403@gmail.com")
PASS = "demo123456"
SUFFIX = f".{TAG}" if TAG else ""


def uemail(local):
    return f"{local}{SUFFIX}@sris.vn"


# Ứng viên "sao" — dùng plus-address của hộp thư thật để magic link / thư mời rơi vào
# inbox xem được khi demo. Các ứng viên còn lại dùng @example.com (RFC 2606, không bao
# giờ gửi tới ai thật) để không spam người lạ.
def cemail(name, live=False):
    slug = ascii_slug(name)
    if live:
        local, domain = INBOX.split("@")
        return f"{local}+{slug}{('.' + TAG) if TAG else ''}@{domain}"
    return f"{slug}{('.' + TAG) if TAG else ''}@example.com"


def ascii_slug(text):
    t = unicodedata.normalize("NFD", text)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").replace("đ", "d").replace("Đ", "D")
    return ".".join(p for p in "".join(c if c.isalnum() else " " for c in t.lower()).split())


# ------------------------------------------------------------------ HTTP
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
        with urllib.request.urlopen(req, data=data, timeout=300) as r:
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
        raise SystemExit(f"LỖI {what}: HTTP {status} {json.dumps(data, ensure_ascii=False)[:400]}")
    return data


def call_any(method, path, tokens, body=None, what=""):
    """Thử lần lượt nhiều token — job có DM thì DM mới được quyết, job không có thì HR.
    Tránh việc seed chết vì 403 khi quyền đổi."""
    last = None
    for tk in tokens:
        s, d = call(method, path, token=tk, body=body)
        if s in (200, 201, 204):
            return d
        last = (s, d)
    raise SystemExit(f"LỖI {what}: HTTP {last[0]} {json.dumps(last[1], ensure_ascii=False)[:400]}")


def login(email, password):
    s, d = call("POST", "/account/login", body={"email": email, "password": password})
    must(s, d, f"đăng nhập {email}")
    return d["accessToken"]


# ------------------------------------------------------------------ PDF CV
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
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
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
    parts += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
              f"filename=\"CV_{ascii_slug(name)}.pdf\"\r\n"
              f"Content-Type: application/pdf\r\n\r\n").encode() + pdf + b"\r\n"
    parts += f"--{boundary}--\r\n".encode()
    s, d = call("POST", f"/public/{slug}/jobs/{job_id}/apply", raw_body=parts,
                ctype=f"multipart/form-data; boundary={boundary}")
    must(s, d, f"nộp CV {name}")
    return d["applicationId"]


# ------------------------------------------------------------------ giờ phỏng vấn
# Backend chặn 2 buổi cách nhau < 1 tiếng (cùng interviewer hoặc cùng ứng viên).
# Bộ đếm toàn cục: mỗi buổi cách nhau ≥ 2 tiếng, tràn ngày thì nhảy sang ngày kế.
_HOURS = [2, 4, 7, 9]  # giờ UTC ~ 9h/11h/14h/16h giờ VN
_slot_n = 0


def next_time():
    global _slot_n
    day = 1 + _slot_n // len(_HOURS)
    hour = _HOURS[_slot_n % len(_HOURS)]
    _slot_n += 1
    return time.strftime(f"%Y-%m-%dT{hour:02d}:00:00Z", time.gmtime(time.time() + day * 86400))


# ==================================================================
print(f">> Backend {BASE} | đăng nhập admin {ADMIN_EMAIL}")
admin = login(ADMIN_EMAIL, ADMIN_PASS)
company = must(*call("GET", "/company", token=admin), "lấy thông tin công ty")
slug = company.get("slug") or company.get("Slug")
print(f">> Công ty: {company.get('name')} (slug={slug})")

# ---------- 1) Tài khoản nội bộ ----------
STAFF = [
    ("hr", "Recruiter", "Trần Thu Hà"),
    ("itv1", "Interviewer", "Lê Minh Đức"),
    ("itv2", "Interviewer", "Phạm Quang Huy"),
    ("itv3", "Interviewer", "Đỗ Thanh Tùng"),
    ("dm", "DepartmentManager", "Ngô Thị Lan"),
    ("dir", "Director", "Bùi Quang Hưng"),
]
users = {}
for key, role, fullname in STAFF:
    email = uemail(key)
    s, d = call("POST", "/users", token=admin,
                body={"email": email, "password": PASS, "fullName": fullname, "role": role})
    if s in (200, 201):
        users[key] = {"id": d.get("userId") or d.get("UserId"), "email": email, "name": fullname}
        print(f"   + {role:18s} {email}")
    elif s in (400, 409):   # đã tồn tại từ lần seed trước -> dùng lại
        lst = must(*call("GET", "/users", token=admin), "danh sách user")
        rows = lst if isinstance(lst, list) else (lst.get("items") or lst.get("data") or [])
        hit = next((u for u in rows if (u.get("email") or "").lower() == email), None)
        if not hit:
            raise SystemExit(f"LỖI tạo user {email}: HTTP {s} {json.dumps(d, ensure_ascii=False)[:300]}")
        users[key] = {"id": hit.get("userId"), "email": email, "name": fullname}
        print(f"   = {role:18s} {email} (đã có)")
    else:
        raise SystemExit(f"LỖI tạo user {email}: HTTP {s} {json.dumps(d, ensure_ascii=False)[:300]}")

hr = login(users["hr"]["email"], PASS)
dm = login(users["dm"]["email"], PASS)
director = login(users["dir"]["email"], PASS)
itv = {k: login(users[k]["email"], PASS) for k in ("itv1", "itv2", "itv3")}

# ---------- 2) Phòng ban ----------
# MỌI phòng ban đều gán DM (V023 tự lấy manager của phòng làm người quyết của job).
# Bắt buộc từ 15/08/2026: tin đăng phải có người phụ trách, vì DM là cửa duyệt ứng viên
# vào vòng phỏng vấn. Phòng không có DM = hồ sơ kẹt vĩnh viễn ở Sàng lọc.
DEPTS = [
    ("Phòng Kỹ thuật", users["dm"]["id"]),
    ("Phòng Kinh doanh", users["dm"]["id"]),
    ("Phòng Tài chính - Kế toán", users["dm"]["id"]),
    ("Phòng Nhân sự", users["dm"]["id"]),
    ("Phòng Marketing", users["dm"]["id"]),
    ("Phòng Chăm sóc Khách hàng", users["dm"]["id"]),
]
for name, mgr in DEPTS:
    s, _ = call("POST", "/departments", token=admin, body={"name": name, "managerUserId": mgr})
    print(f"   {'+' if s in (200, 201) else '='} Phòng ban: {name}")

# ---------- 3) Tin tuyển dụng ----------
BEN_TECH = ["Lương tháng 13 + thưởng theo hiệu quả dự án", "Bảo hiểm sức khỏe PVI cho nhân viên",
            "12 ngày phép/năm, 2 ngày remote/tuần", "Laptop cấu hình cao, màn hình phụ",
            "Team building 2 lần/năm, du lịch hè"]
BEN_OFFICE = ["Lương tháng 13, review lương 1 lần/năm", "Đóng BHXH full lương",
              "12 ngày phép/năm", "Ăn trưa tại văn phòng", "Team building, sinh nhật hàng tháng"]

JOBS_DEF = [
    dict(key="be", title="Lập trình viên Backend (.NET)", department="Phòng Kỹ thuật",
         location="Hà Nội", employmentType="Toàn thời gian", workMode="Hybrid",
         experienceLevel="2+ năm", salaryMin=18000000, salaryMax=30000000, quantity=2,
         skills=["C#", ".NET Core", "SQL Server", "Docker", "REST API"],
         jdText=("Chúng tôi tìm Lập trình viên Backend .NET tham gia phát triển hệ thống quản trị "
                 "nội bộ cho khách hàng doanh nghiệp. Bạn sẽ trực tiếp thiết kế API, tối ưu truy vấn "
                 "và làm việc cùng đội Frontend theo mô hình Scrum 2 tuần/sprint.\n\n"
                 "MÔ TẢ CÔNG VIỆC\n"
                 "- Phát triển và bảo trì các dịch vụ backend bằng ASP.NET Core.\n"
                 "- Thiết kế cơ sở dữ liệu SQL Server, viết stored procedure và tối ưu truy vấn chậm.\n"
                 "- Viết unit test, tham gia review code cho thành viên trong nhóm.\n"
                 "- Phối hợp với QA xử lý lỗi và triển khai bản phát hành hàng tháng.\n"
                 "- Tham gia ước lượng công việc và trình bày giải pháp kỹ thuật với trưởng nhóm."),
         requirements=["Tối thiểu 2 năm kinh nghiệm lập trình C# / ASP.NET Core",
                       "Thành thạo SQL Server, hiểu index và tối ưu truy vấn",
                       "Nắm vững REST API, xác thực JWT",
                       "Ưu tiên biết Docker, CI/CD (GitHub Actions, Azure DevOps)",
                       "Giao tiếp tốt, chủ động trong công việc nhóm"],
         benefits=BEN_TECH),
    dict(key="fe", title="Lập trình viên Frontend (ReactJS)", department="Phòng Kỹ thuật",
         location="Hà Nội", employmentType="Toàn thời gian", workMode="Hybrid",
         experienceLevel="1+ năm", salaryMin=15000000, salaryMax=25000000, quantity=2,
         skills=["ReactJS", "TypeScript", "TailwindCSS", "REST API"],
         jdText=("Vị trí Frontend Developer làm việc trong đội sản phẩm 6 người, xây dựng giao diện "
                 "quản trị cho hệ thống tuyển dụng và các ứng dụng nội bộ.\n\n"
                 "MÔ TẢ CÔNG VIỆC\n"
                 "- Xây dựng giao diện web bằng ReactJS + TypeScript theo thiết kế Figma.\n"
                 "- Kết nối API, xử lý trạng thái ứng dụng, tối ưu hiệu năng render.\n"
                 "- Bảo đảm giao diện chạy tốt trên trình duyệt phổ biến và thiết bị di động.\n"
                 "- Phối hợp cùng Backend chốt hợp đồng API trước mỗi sprint."),
         requirements=["Tối thiểu 1 năm kinh nghiệm ReactJS",
                       "Biết TypeScript, hiểu component-based design",
                       "Đọc hiểu tài liệu tiếng Anh",
                       "Ưu tiên từng dùng TailwindCSS hoặc Ant Design"],
         benefits=BEN_TECH),
    dict(key="acc", title="Kế toán tổng hợp", department="Phòng Tài chính - Kế toán",
         location="Hà Nội", employmentType="Toàn thời gian", workMode="Onsite",
         experienceLevel="3+ năm", salaryMin=12000000, salaryMax=18000000, quantity=1,
         skills=["MISA", "Excel", "Thuế", "Báo cáo tài chính"],
         jdText=("Kế toán tổng hợp phụ trách toàn bộ sổ sách của công ty, làm việc trực tiếp với "
                 "Kế toán trưởng và đơn vị kiểm toán.\n\n"
                 "MÔ TẢ CÔNG VIỆC\n"
                 "- Hạch toán chứng từ phát sinh hàng ngày trên phần mềm MISA.\n"
                 "- Lập báo cáo thuế GTGT, TNCN, TNDN theo tháng/quý/năm.\n"
                 "- Theo dõi công nợ phải thu, phải trả và đối chiếu với bộ phận kinh doanh.\n"
                 "- Lập báo cáo tài chính, giải trình số liệu khi kiểm toán."),
         requirements=["Tối thiểu 3 năm kinh nghiệm kế toán tổng hợp",
                       "Thành thạo MISA và Excel (pivot, hàm dò tìm)",
                       "Nắm vững quy định thuế hiện hành",
                       "Ưu tiên có chứng chỉ kế toán trưởng",
                       "Cẩn thận, trung thực, chịu được áp lực mùa quyết toán"],
         benefits=BEN_OFFICE),
    dict(key="sale", title="Nhân viên Kinh doanh B2B", department="Phòng Kinh doanh",
         location="Hà Nội", employmentType="Toàn thời gian", workMode="Onsite",
         experienceLevel="1+ năm", salaryMin=10000000, salaryMax=15000000, quantity=3,
         skills=["Bán hàng B2B", "Đàm phán", "CRM"],
         jdText=("Nhân viên Kinh doanh B2B phát triển tệp khách hàng doanh nghiệp cho nhóm sản phẩm "
                 "phần mềm quản trị, thu nhập gồm lương cứng và hoa hồng theo doanh số.\n\n"
                 "MÔ TẢ CÔNG VIỆC\n"
                 "- Tìm kiếm và tiếp cận khách hàng doanh nghiệp qua nhiều kênh.\n"
                 "- Tư vấn giải pháp, demo sản phẩm, xây dựng báo giá và đàm phán hợp đồng.\n"
                 "- Chăm sóc khách hàng cũ, khai thác nhu cầu mở rộng.\n"
                 "- Cập nhật thông tin cơ hội bán hàng lên hệ thống CRM và báo cáo tuần."),
         requirements=["Tối thiểu 1 năm kinh nghiệm bán hàng hoặc chăm sóc khách hàng",
                       "Giao tiếp và thuyết trình tốt",
                       "Chịu được áp lực doanh số",
                       "Ưu tiên có tiếng Anh giao tiếp"],
         benefits=["Lương cứng + hoa hồng không giới hạn", "Thưởng nóng theo hợp đồng ký mới",
                   "Đóng BHXH full lương", "Đào tạo kỹ năng bán hàng 1 tháng đầu"]),
    dict(key="hrcb", title="Chuyên viên Nhân sự (C&B)", department="Phòng Nhân sự",
         location="Hà Nội", employmentType="Toàn thời gian", workMode="Onsite",
         experienceLevel="2+ năm", salaryMin=12000000, salaryMax=18000000, quantity=1,
         skills=["C&B", "Bảo hiểm xã hội", "Excel", "Luật lao động"],
         jdText=("Chuyên viên C&B phụ trách tiền lương, bảo hiểm và chế độ phúc lợi cho gần 150 "
                 "nhân sự toàn công ty.\n\n"
                 "MÔ TẢ CÔNG VIỆC\n"
                 "- Chấm công, tính lương và các khoản khấu trừ hàng tháng.\n"
                 "- Thực hiện thủ tục BHXH, BHYT, BHTN cho người lao động.\n"
                 "- Quản lý hồ sơ nhân sự, hợp đồng lao động, phụ lục hợp đồng.\n"
                 "- Tham mưu xây dựng thang bảng lương và chính sách phúc lợi."),
         requirements=["Tối thiểu 2 năm kinh nghiệm mảng C&B",
                       "Nắm vững Luật Lao động và quy định BHXH",
                       "Thành thạo Excel",
                       "Cẩn thận, bảo mật thông tin"],
         benefits=BEN_OFFICE),
    dict(key="cs", title="Nhân viên Chăm sóc Khách hàng", department="Phòng Chăm sóc Khách hàng",
         location="Hà Nội", employmentType="Toàn thời gian", workMode="Onsite",
         experienceLevel="Không yêu cầu", salaryMin=8000000, salaryMax=12000000, quantity=2,
         skills=["Chăm sóc khách hàng", "Giao tiếp", "Xử lý khiếu nại"],
         jdText=("Nhân viên Chăm sóc Khách hàng tiếp nhận và xử lý yêu cầu của khách hàng đang sử "
                 "dụng sản phẩm, làm việc giờ hành chính từ thứ 2 đến thứ 6.\n\n"
                 "MÔ TẢ CÔNG VIỆC\n"
                 "- Tiếp nhận yêu cầu qua tổng đài, email và kênh chat.\n"
                 "- Hướng dẫn khách sử dụng sản phẩm, ghi nhận lỗi chuyển bộ phận kỹ thuật.\n"
                 "- Theo dõi tiến độ xử lý và phản hồi lại khách hàng.\n"
                 "- Thu thập ý kiến khách hàng phục vụ cải tiến sản phẩm."),
         requirements=["Tốt nghiệp Cao đẳng trở lên", "Giọng nói dễ nghe, giao tiếp tốt",
                       "Kiên nhẫn, bình tĩnh khi xử lý khiếu nại", "Sử dụng máy tính văn phòng thành thạo"],
         benefits=BEN_OFFICE),
    dict(key="mkt", title="Thực tập sinh Marketing", department="Phòng Marketing",
         location="Hà Nội", employmentType="Thực tập", workMode="Onsite",
         experienceLevel="Không yêu cầu", salaryMin=3000000, salaryMax=5000000, quantity=2,
         skills=["Content", "Facebook Ads", "Canva"],
         jdText=("Thực tập sinh Marketing hỗ trợ đội Marketing triển khai nội dung và chiến dịch "
                 "truyền thông, có cơ hội trở thành nhân viên chính thức sau 3 tháng.\n\n"
                 "MÔ TẢ CÔNG VIỆC\n"
                 "- Viết bài và thiết kế hình ảnh cho fanpage, website.\n"
                 "- Hỗ trợ chạy chiến dịch quảng cáo Facebook, Google.\n"
                 "- Tổng hợp số liệu hiệu quả chiến dịch theo tuần.\n"
                 "- Hỗ trợ tổ chức sự kiện, hội thảo của công ty."),
         requirements=["Sinh viên năm 3, năm 4 hoặc mới tốt nghiệp",
                       "Viết lách tốt, biết dùng Canva",
                       "Đi làm tối thiểu 4 buổi/tuần"],
         benefits=["Trợ cấp thực tập 3-5 triệu/tháng", "Được đào tạo trực tiếp bởi Trưởng phòng",
                   "Xác nhận thực tập, cơ hội lên chính thức"]),
    dict(key="lead", title="Trưởng nhóm Kinh doanh", department="Phòng Kinh doanh",
         location="Hà Nội", employmentType="Toàn thời gian", workMode="Onsite",
         experienceLevel="3+ năm", salaryMin=20000000, salaryMax=30000000, quantity=1,
         skills=["Quản lý đội nhóm", "Bán hàng B2B", "Lập kế hoạch"],
         jdText=("Trưởng nhóm Kinh doanh dẫn dắt nhóm 5 nhân viên, chịu trách nhiệm doanh số khu vực "
                 "miền Bắc.\n\n"
                 "MÔ TẢ CÔNG VIỆC\n"
                 "- Lập kế hoạch doanh số quý và phân bổ chỉ tiêu cho nhóm.\n"
                 "- Trực tiếp đàm phán các hợp đồng giá trị lớn.\n"
                 "- Đào tạo, kèm cặp nhân viên mới.\n"
                 "- Báo cáo kết quả kinh doanh cho Ban Giám đốc hàng tháng."),
         requirements=["Tối thiểu 3 năm kinh nghiệm bán hàng B2B, 1 năm quản lý nhóm",
                       "Kỹ năng đàm phán và xây dựng đội nhóm",
                       "Chấp nhận đi công tác tỉnh"],
         benefits=["Lương cứng + hoa hồng nhóm", "Thưởng quý theo doanh số vùng",
                   "Xe công ty khi đi công tác"]),
]

jobs = {}
for j in JOBS_DEF:
    body = {k: v for k, v in j.items() if k != "key"}
    body["deadline"] = time.strftime("%Y-%m-%dT23:59:59", time.gmtime(time.time() + 30 * 86400))
    body["currency"] = "VND"
    d = must(*call("POST", "/jobs", token=hr, body=body), f"tạo job {j['title']}")
    jobs[j["key"]] = d["jobId"]
    print(f"   + Job {d['jobId']}: {j['title']}")

# ---------- 4) Bộ tiêu chí (APPROVED ngay — chính là phiếu chấm phỏng vấn) ----------
# Chỉ bóc thứ PHẢI HỎI MỚI BIẾT: bằng cấp/chứng chỉ không lên phiếu chấm (docs 5.18).
CRITERIA = {
    "be": [("Kinh nghiệm C# / ASP.NET Core", 3), ("Thiết kế và tối ưu SQL Server", 3),
           ("Hiểu biết REST API và bảo mật", 2), ("Kinh nghiệm Docker / CI-CD", 1),
           ("Tư duy giải quyết vấn đề", 2), ("Giao tiếp, phối hợp nhóm", 1)],
    "fe": [("Kinh nghiệm ReactJS", 3), ("Thành thạo TypeScript", 2),
           ("Tư duy UI/UX, xử lý responsive", 2), ("Khả năng tự học công nghệ mới", 1),
           ("Giao tiếp, phối hợp nhóm", 1)],
    "acc": [("Kinh nghiệm kế toán tổng hợp", 3), ("Thành thạo MISA", 3),
            ("Nghiệp vụ thuế và báo cáo tài chính", 3), ("Thành thạo Excel", 2),
            ("Tính cẩn thận, trung thực", 2)],
    "sale": [("Kinh nghiệm bán hàng B2B", 3), ("Kỹ năng đàm phán, thuyết phục", 3),
             ("Khả năng chịu áp lực doanh số", 2), ("Tiếng Anh giao tiếp", 1),
             ("Thái độ chủ động", 2)],
    "hrcb": [("Kinh nghiệm tính lương và BHXH", 3), ("Nắm vững Luật Lao động", 3),
             ("Thành thạo Excel", 2), ("Tính bảo mật, cẩn thận", 2)],
    "cs": [("Kỹ năng giao tiếp qua điện thoại", 3), ("Xử lý tình huống khiếu nại", 3),
           ("Thái độ kiên nhẫn, cầu thị", 2), ("Sử dụng công cụ văn phòng", 1)],
    "mkt": [("Khả năng viết nội dung", 3), ("Tư duy hình ảnh, biết Canva", 2),
            ("Hiểu biết quảng cáo Facebook", 2), ("Thời gian đi làm ổn định", 1)],
    "lead": [("Kinh nghiệm quản lý đội nhóm", 3), ("Năng lực đàm phán hợp đồng lớn", 3),
             ("Khả năng lập kế hoạch doanh số", 2), ("Kỹ năng đào tạo nhân viên", 2)],
}
for key, items in CRITERIA.items():
    for name, w in items:
        must(*call("POST", f"/jobs/{jobs[key]}/criteria", token=hr,
                   body={"name": name, "weight": w, "maxScore": 10}), f"tiêu chí {name}")
print(f"   + {sum(len(v) for v in CRITERIA.values())} tiêu chí APPROVED cho {len(CRITERIA)} job")

# ---------- 5) Yêu cầu tuyển dụng (DM ra đề -> HR duyệt) ----------
req_be = must(*call("POST", "/recruitment-requests", token=dm, body={
    "title": "Bổ sung 2 Lập trình viên Backend cho dự án ERP",
    "department": "Phòng Kỹ thuật", "quantity": 2, "employmentType": "Toàn thời gian",
    "experienceYearsMin": 2,
    "description": "Dự án ERP mở rộng phạm vi, đội backend hiện tại quá tải từ tháng 6.",
    "requirements": "2 năm kinh nghiệm .NET Core\nThành thạo SQL Server\nƯu tiên biết Docker",
    "benefits": "Lương tháng 13, bảo hiểm PVI, 2 ngày remote/tuần",
    "salaryMin": 18000000, "salaryMax": 30000000}), "yêu cầu tuyển dụng Backend")["requestId"]
must(*call("POST", f"/recruitment-requests/{req_be}/review", token=hr,
           body={"approve": True, "note": "Đã duyệt, đăng tin trong tuần này."}), "duyệt yêu cầu")
must(*call("POST", f"/recruitment-requests/{req_be}/convert", token=hr,
           body={"jobId": jobs["be"]}), "convert yêu cầu -> job")

for body in [
    {"title": "Tuyển 3 Nhân viên Kinh doanh khu vực miền Bắc", "department": "Phòng Kinh doanh",
     "quantity": 3, "employmentType": "Toàn thời gian", "experienceYearsMin": 1,
     "description": "Mở rộng thị trường Hà Nội và các tỉnh lân cận trong quý tới.",
     "requirements": "1 năm kinh nghiệm bán hàng\nGiao tiếp tốt",
     "salaryMin": 10000000, "salaryMax": 15000000},
    {"title": "Tuyển 1 Chuyên viên Đào tạo nội bộ", "department": "Phòng Nhân sự",
     "quantity": 1, "employmentType": "Toàn thời gian", "experienceYearsMin": 2,
     "description": "Xây dựng chương trình đào tạo hội nhập cho nhân sự mới.",
     "requirements": "2 năm kinh nghiệm đào tạo\nKỹ năng thuyết trình",
     "salaryMin": 13000000, "salaryMax": 18000000},
]:
    must(*call("POST", "/recruitment-requests", token=dm, body=body), "yêu cầu PENDING")

req_no = must(*call("POST", "/recruitment-requests", token=dm, body={
    "title": "Tuyển thêm 2 Thực tập sinh Thiết kế", "department": "Phòng Marketing",
    "quantity": 2, "employmentType": "Thực tập",
    "description": "Hỗ trợ thiết kế ấn phẩm cho chiến dịch cuối năm."}), "yêu cầu bị từ chối")["requestId"]
must(*call("POST", f"/recruitment-requests/{req_no}/review", token=hr,
           body={"approve": False, "note": "Chưa có ngân sách quý này, xem lại vào quý sau."}),
     "từ chối yêu cầu")
print("   + Yêu cầu tuyển dụng: 1 đã convert · 2 chờ duyệt · 1 bị từ chối")

# ---------- 6) Ứng viên nộp CV qua career site ----------
# plan: new | screening | reject_new | reject_screen | invited | booked | scored
#       | offer | hired | offer_declined
CANDS = [
    # ---- Backend .NET ----
    ("be", "Nguyễn Văn An", "hired", True,
     ["NGUYEN VAN AN - Backend Developer", "5 nam kinh nghiem C# / ASP.NET Core.",
      "Xay dung he thong thanh toan xu ly 2 trieu giao dich/ngay.",
      "Toi uu truy van SQL Server, giam 60% thoi gian phan hoi.",
      "Su dung Docker, CI/CD GitHub Actions. Truong nhom 4 nguoi."]),
    ("be", "Trần Bích Ngọc", "offer", True,
     ["TRAN BICH NGOC - Backend Developer", "3 nam kinh nghiem .NET Core tai cong ty fintech.",
      "Thiet ke REST API, xac thuc JWT, phan quyen theo vai tro.",
      "Lam viec voi SQL Server va Redis. Biet Docker co ban."]),
    ("be", "Lê Quốc Bảo", "scored", False,
     ["LE QUOC BAO - Software Engineer", "2 nam kinh nghiem C#, WinForms va ASP.NET MVC.",
      "Dang chuyen sang .NET Core. Biet viet unit test.",
      "Kinh nghiem lam viec voi SQL Server, stored procedure."]),
    ("be", "Phạm Minh Khang", "booked", False,
     ["PHAM MINH KHANG - Backend Developer", "2 nam kinh nghiem .NET Core va MySQL.",
      "Tham gia du an quan ly kho cho chuoi ban le.",
      "Biet Docker, dang hoc Kubernetes."]),
    ("be", "Vũ Hoàng Nam", "invited", False,
     ["VU HOANG NAM - Developer", "3 nam kinh nghiem Java, dang chuyen sang C#.",
      "Kinh nghiem microservice va message queue.",
      "Tieng Anh doc hieu tot."]),
    ("be", "Đặng Thu Trang", "screening", False,
     ["DANG THU TRANG - Backend Developer", "2 nam kinh nghiem NodeJS, 1 nam .NET Core.",
      "Lam viec voi PostgreSQL va SQL Server."]),
    ("be", "Hoàng Anh Tuấn", "new", False,
     ["HOANG ANH TUAN - Fresher Developer", "Moi tot nghiep Dai hoc Cong nghiep Ha Noi.",
      "Do an tot nghiep dung ASP.NET Core va SQL Server."]),
    ("be", "Bùi Thanh Sơn", "new", False,
     ["BUI THANH SON - Backend Developer", "4 nam kinh nghiem PHP Laravel.",
      "Chua co kinh nghiem .NET nhung muon chuyen huong."]),
    ("be", "Ngô Đức Hiếu", "reject_screen", False,
     ["NGO DUC HIEU - Sinh vien nam 3", "Chua co kinh nghiem lam viec.",
      "Biet C# co ban qua mon hoc tren truong."]),

    # ---- Frontend React ----
    ("fe", "Trịnh Khánh Linh", "offer", False,
     ["TRINH KHANH LINH - Frontend Developer", "3 nam kinh nghiem ReactJS va TypeScript.",
      "Xay dung dashboard quan tri cho san thuong mai dien tu.",
      "Thanh thao TailwindCSS, toi uu hieu nang render."]),
    ("fe", "Lý Gia Bảo", "booked", False,
     ["LY GIA BAO - Frontend Developer", "2 nam kinh nghiem ReactJS.",
      "Tung lam giao dien ung dung dat lich kham benh.",
      "Biet Ant Design, doc hieu tai lieu tieng Anh."]),
    ("fe", "Nguyễn Thảo My", "screening", False,
     ["NGUYEN THAO MY - Frontend Developer", "1 nam kinh nghiem ReactJS, HTML/CSS tot.",
      "Tung lam website gioi thieu cong ty va landing page."]),
    ("fe", "Phan Đình Duy", "new", False,
     ["PHAN DINH DUY - Web Developer", "2 nam kinh nghiem VueJS, muon chuyen sang React.",
      "Biet TypeScript co ban."]),
    ("fe", "Chu Hải Yến", "new", False,
     ["CHU HAI YEN - Fresher Frontend", "Moi tot nghiep, hoc ReactJS qua khoa hoc online.",
      "Co 3 san pham ca nhan tren GitHub."]),
    ("fe", "Tạ Quang Vinh", "reject_screen", False,
     ["TA QUANG VINH - Designer", "5 nam kinh nghiem thiet ke do hoa.",
      "Chua lap trinh web bao gio."]),

    # ---- Kế toán tổng hợp ----
    ("acc", "Lê Thị Hồng", "hired", True,
     ["LE THI HONG - Ke toan tong hop", "6 nam kinh nghiem ke toan tong hop cong ty san xuat.",
      "Thanh thao MISA, lap bao cao thue va bao cao tai chinh.",
      "Co chung chi ke toan truong. Tung lam viec voi kiem toan Big4."]),
    ("acc", "Đỗ Mai Anh", "scored", False,
     ["DO MAI ANH - Ke toan tong hop", "4 nam kinh nghiem ke toan tai cong ty thuong mai.",
      "Su dung MISA va Fast Accounting. Excel nang cao."]),
    ("acc", "Nguyễn Thị Vân", "screening", False,
     ["NGUYEN THI VAN - Ke toan thue", "3 nam kinh nghiem ke toan thue.",
      "Thanh thao ke khai thue GTGT, TNCN."]),
    ("acc", "Trương Văn Hải", "new", False,
     ["TRUONG VAN HAI - Ke toan kho", "3 nam theo doi kho va cong no.",
      "Biet MISA co ban, Excel kha."]),
    ("acc", "Vũ Đình Long", "reject_screen", False,
     ["VU DINH LONG - Nhan vien kho", "3 nam lam thu kho, kiem ke hang hoa.",
      "Biet Excel co ban, chua dung phan mem ke toan."]),

    # ---- Kinh doanh B2B ----
    ("sale", "Hoàng Mai Phương", "scored", False,
     ["HOANG MAI PHUONG - Nhan vien kinh doanh", "3 nam kinh nghiem ban hang B2B phan mem.",
      "Dat 130% doanh so nam 2025, ky 18 hop dong doanh nghiep.",
      "Tieng Anh giao tiep tot, tung lam viec voi khach Singapore."]),
    ("sale", "Nguyễn Tiến Dũng", "booked", False,
     ["NGUYEN TIEN DUNG - Sales Executive", "2 nam ban giai phap CNTT cho doanh nghiep.",
      "Quen dung CRM HubSpot, ky nang dam phan tot."]),
    ("sale", "Lâm Thùy Dương", "screening", False,
     ["LAM THUY DUONG - Nhan vien kinh doanh", "1 nam ban hang bat dong san.",
      "Giao tiep tot, chiu duoc ap luc."]),
    ("sale", "Cao Việt Hùng", "screening", False,
     ["CAO VIET HUNG - Sales", "2 nam ban thiet bi van phong cho doanh nghiep.",
      "Co tep khach hang san."]),
    ("sale", "Đinh Thị Nhung", "new", False,
     ["DINH THI NHUNG - Telesale", "1 nam telesale nganh bao hiem.",
      "Giong noi de nghe, kien nhan."]),
    ("sale", "Mai Xuân Trường", "new", False,
     ["MAI XUAN TRUONG - Nhan vien kinh doanh", "6 thang thuc tap kinh doanh.",
      "Nhiet tinh, muon phat trien lau dai."]),
    ("sale", "Kiều Văn Đạt", "reject_new", False,
     ["KIEU VAN DAT - Lai xe", "5 nam lai xe tai.",
      "Nop nham vi tri."]),

    # ---- Nhân sự C&B ----
    ("hrcb", "Phùng Ngọc Ánh", "offer_declined", False,
     ["PHUNG NGOC ANH - Chuyen vien C&B", "4 nam kinh nghiem tinh luong cho cong ty 200 nhan su.",
      "Thanh thao nghiep vu BHXH, quyet toan TNCN.",
      "Nam vung Luat Lao dong, tung xay dung thang bang luong."]),
    ("hrcb", "Nguyễn Hà Chi", "screening", False,
     ["NGUYEN HA CHI - Nhan su tong hop", "2 nam lam nhan su tong hop.",
      "Kinh nghiem cham cong, tinh luong co ban."]),
    ("hrcb", "Trần Đức Thắng", "new", False,
     ["TRAN DUC THANG - Nhan su tuyen dung", "3 nam lam tuyen dung IT.",
      "Muon chuyen sang mang C&B."]),

    # ---- Chăm sóc khách hàng ----
    ("cs", "Lưu Thị Hạnh", "hired", False,
     ["LUU THI HANH - Cham soc khach hang", "3 nam truc tong dai ngan hang.",
      "Xu ly khieu nai tot, duoc khen thuong quy 2 nam lien.",
      "Giao tiep ro rang, kien nhan."]),
    ("cs", "Đoàn Minh Quân", "booked", False,
     ["DOAN MINH QUAN - CSKH", "2 nam cham soc khach hang nganh vien thong.",
      "Quen dung phan mem ticket."]),
    ("cs", "Hồ Thị Kim Ngân", "screening", False,
     ["HO THI KIM NGAN - CSKH", "1 nam truc chat cho san thuong mai dien tu."]),
    ("cs", "Nguyễn Bá Lộc", "new", False,
     ["NGUYEN BA LOC - Nhan vien ban hang", "2 nam ban hang tai cua hang.",
      "Muon chuyen sang cham soc khach hang."]),

    # ---- Thực tập Marketing ----
    ("mkt", "Vương Thùy Chi", "booked", False,
     ["VUONG THUY CHI - Sinh vien nam 4", "Thuc tap content 3 thang tai agency.",
      "Viet bai fanpage, biet Canva va CapCut."]),
    ("mkt", "Trần Nhật Minh", "new", False,
     ["TRAN NHAT MINH - Sinh vien nam 3", "Tung lam cong tac vien truyen thong CLB.",
      "Biet chay quang cao Facebook co ban."]),
    ("mkt", "Lê Phương Uyên", "new", False,
     ["LE PHUONG UYEN - Sinh vien nam 4", "Viet blog ca nhan ve du lich.",
      "Di lam duoc 4 buoi/tuan."]),

    # ---- Trưởng nhóm Kinh doanh (tin đã đóng vì tuyển đủ) ----
    ("lead", "Đặng Quốc Toản", "hired", False,
     ["DANG QUOC TOAN - Truong nhom kinh doanh", "6 nam ban hang B2B, 2 nam quan ly nhom 5 nguoi.",
      "Dan dat nhom dat 115% chi tieu nam 2025.",
      "Kinh nghiem dam phan hop dong tren 1 ty."]),
    ("lead", "Nguyễn Hữu Phước", "reject_screen", False,
     ["NGUYEN HUU PHUOC - Nhan vien kinh doanh", "3 nam ban hang le.",
      "Chua co kinh nghiem quan ly doi nhom."]),
]

apps = {}
for jobkey, name, plan, live, cv in CANDS:
    email = cemail(name, live)
    aid = apply_cv(slug, jobs[jobkey], name, email, "09" + str(10000000 + abs(hash(name)) % 89999999),
                   cv)
    apps[name] = {"id": aid, "job": jobkey, "plan": plan, "email": email}
print(f"   + {len(CANDS)} ứng viên đã nộp CV PDF qua career site")

# ---------- 7) Kéo pipeline ----------
# Ai bấm được bước nào (chốt 15/08/2026): nhân sự sàng lọc, DM duyệt vào vòng phỏng vấn,
# GIÁM ĐỐC quyết tuyển. call_any thử lần lượt nên cứ đưa cả ba; admin đứng cuối làm lưới
# an toàn nếu quyền có đổi.


def deciders(jobkey):
    return [dm, director, hr, admin]


# Ai phỏng vấn ai — Trưởng bộ phận chỉ định NGAY khi duyệt vào vòng phỏng vấn (V045).
# Không chỉ định thì BE từ chối mọi lệnh đặt lịch sau đó, seed sẽ đứng ở mục 8.
PANEL = {
    "be": [users["itv1"]["id"], users["itv2"]["id"]],
    "fe": [users["itv1"]["id"], users["itv3"]["id"]],
    "acc": [users["itv2"]["id"]],
    "sale": [users["itv3"]["id"], users["itv2"]["id"]],
    "hrcb": [users["itv2"]["id"]],
    "cs": [users["itv3"]["id"]],
    "mkt": [users["itv3"]["id"]],
    "lead": [users["itv1"]["id"], users["itv3"]["id"]],
}


def transition(name, to):
    a = apps[name]
    body = {"toState": to}
    if to == "INTERVIEW":
        body["interviewerIds"] = PANEL[a["job"]]
    call_any("POST", f"/applications/{a['id']}/transition", deciders(a["job"]),
             body=body, what=f"{name} -> {to}")


REJECT_REASONS = {
    "Ngô Đức Hiếu": "Chưa có kinh nghiệm thực tế với .NET Core, chưa phù hợp vị trí Middle.",
    "Tạ Quang Vinh": "Hồ sơ thiên về thiết kế đồ họa, không có kinh nghiệm lập trình web.",
    "Vũ Đình Long": "Chưa từng sử dụng phần mềm kế toán, không đáp ứng yêu cầu tối thiểu.",
    "Kiều Văn Đạt": "Hồ sơ không đúng vị trí ứng tuyển.",
    "Nguyễn Hữu Phước": "Chưa có kinh nghiệm quản lý đội nhóm theo yêu cầu vị trí.",
}

for name, a in apps.items():
    plan = a["plan"]
    if plan == "new":
        continue
    if plan == "reject_new":
        call_any("POST", f"/applications/{a['id']}/reject", deciders(a["job"]),
                 body={"reason": REJECT_REASONS.get(name)}, what=f"loại {name}")
        continue
    transition(name, "SCREENING")
    if plan == "reject_screen":
        call_any("POST", f"/applications/{a['id']}/reject", deciders(a["job"]),
                 body={"reason": REJECT_REASONS.get(name)}, what=f"loại {name}")
        continue
    if plan == "screening":
        continue
    transition(name, "INTERVIEW")
print("   + Pipeline: đã kéo NEW / SCREENING / INTERVIEW / REJECTED")

# ---------- 8) Phỏng vấn ----------
PANEL_TOKEN = {
    "be": [itv["itv1"], itv["itv2"]], "fe": [itv["itv1"], itv["itv3"]],
    "acc": [itv["itv2"]], "sale": [itv["itv3"], itv["itv2"]], "hrcb": [itv["itv2"]],
    "cs": [itv["itv3"]], "mkt": [itv["itv3"]], "lead": [itv["itv1"], itv["itv3"]],
}

# 8a) Ứng viên đã được duyệt vào vòng phỏng vấn nhưng CHƯA tới buổi: nhân sự đặt lịch trực
# tiếp (pool khung + magic link SCHEDULE đã bỏ 15/08/2026 — nhân sự gọi điện chốt giờ).
scheduled_people = {}
for name, a in apps.items():
    if a["plan"] in ("invited", "booked"):
        scheduled_people.setdefault(a["job"], []).append(name)

for jobkey, names in scheduled_people.items():
    for n in names:
        book = must(*call("POST", f"/applications/{apps[n]['id']}/interviews", token=hr,
                          body={"interviewerIds": PANEL[jobkey], "startTime": next_time()}),
                    f"đặt lịch {n}")
        apps[n]["scheduleId"] = book["scheduleId"]
    print(f"   + {jobkey}: đã đặt lịch phỏng vấn cho {len(names)} ứng viên")

# 8b) Người đã phỏng vấn xong (scored/offer/hired/offer_declined): chốt lịch tay + nộp phiếu chấm
SUMMARIES = {
    "STRONG_HIRE": "Nền tảng chuyên môn vững, trả lời có dẫn chứng dự án thật. Đề nghị tuyển.",
    "HIRE": "Đáp ứng tốt yêu cầu vị trí, thái độ cầu thị. Nên tuyển.",
    "CONSIDER": "Chuyên môn ở mức ổn nhưng còn thiếu chiều sâu ở phần thiết kế. Cần cân nhắc mức lương.",
}


def submit_sheet(token_iv, schedule_id, base_score, recommendation, name):
    sheet = must(*call("GET", f"/interview-schedules/{schedule_id}/my-sheet", token=token_iv),
                 f"lấy phiếu chấm {name}")
    items = [{"criteriaId": c["criteriaId"],
              "score": min(c.get("maxScore") or 10, base_score + (i % 3)),
              "note": ("Trả lời tốt, nêu được ví dụ từ dự án cũ." if i == 0 else
                       ("Cần bổ sung thêm kinh nghiệm thực tế." if i == 2 else None))}
             for i, c in enumerate(sheet["criteria"])]
    must(*call("PUT", f"/interview-schedules/{schedule_id}/my-sheet", token=token_iv,
               body={"items": items, "recommendation": recommendation,
                     "summary": SUMMARIES[recommendation]}), f"lưu nháp phiếu {name}")
    must(*call("POST", f"/interview-schedules/{schedule_id}/my-sheet/submit", token=token_iv),
         f"nộp phiếu {name}")


SCORE_PLAN = {   # điểm nền + đề xuất của từng interviewer trong panel
    "hired": [(9, "STRONG_HIRE"), (8, "HIRE")],
    "offer": [(8, "HIRE"), (7, "CONSIDER")],
    "offer_declined": [(8, "HIRE"), (8, "HIRE")],
    "scored": [(7, "CONSIDER"), (7, "HIRE")],
}
for name, a in apps.items():
    if a["plan"] not in SCORE_PLAN:
        continue
    jobkey = a["job"]
    man = must(*call("POST", f"/applications/{a['id']}/interviews", token=hr,
                     body={"interviewerIds": PANEL[jobkey], "startTime": next_time()}),
               f"đặt lịch {name}")
    a["scheduleId"] = man["scheduleId"]
    for tk, (score, rec) in zip(PANEL_TOKEN[jobkey], SCORE_PLAN[a["plan"]]):
        submit_sheet(tk, man["scheduleId"], score, rec, name)
print("   + Phiếu chấm đã nộp cho các hồ sơ đã phỏng vấn (mở blind, qua guard G2)")

# ---------- 9) Offer ----------
OFFERS = {
    "Nguyễn Văn An": dict(salaryAmount=28000000, bonus="Thưởng tháng 13 + thưởng dự án",
                          note="Rất mong bạn đồng hành cùng đội Backend."),
    "Trần Bích Ngọc": dict(salaryAmount=24000000, bonus="Thưởng tháng 13",
                           note="Mức lương đã trao đổi qua điện thoại ngày phỏng vấn."),
    "Trịnh Khánh Linh": dict(salaryAmount=22000000, bonus="Thưởng tháng 13",
                             note="Vị trí Frontend, làm việc hybrid 2 ngày/tuần."),
    "Lê Thị Hồng": dict(salaryAmount=16500000, bonus="Thưởng tháng 13",
                        note="Vị trí Kế toán tổng hợp, nhận việc đầu tháng sau."),
    "Lưu Thị Hạnh": dict(salaryAmount=10500000, bonus="Thưởng theo đánh giá quý",
                         note="Vị trí CSKH, làm giờ hành chính T2-T6."),
    "Đặng Quốc Toản": dict(salaryAmount=27000000, bonus="Hoa hồng nhóm theo quý",
                           note="Vị trí Trưởng nhóm Kinh doanh miền Bắc."),
    "Phùng Ngọc Ánh": dict(salaryAmount=15000000, bonus="Thưởng tháng 13",
                           note="Vị trí Chuyên viên C&B."),
}
start_date = time.strftime("%Y-%m-%dT00:00:00", time.gmtime(time.time() + 20 * 86400))
for name, extra in OFFERS.items():
    a = apps[name]
    # V043: DM chỉ ĐỀ XUẤT, Giám đốc duyệt — chính hành động duyệt đẩy hồ sơ sang OFFER.
    prop = must(*call("POST", f"/applications/{a['id']}/hiring-proposal", token=dm,
                      body={"note": "Panel đánh giá tốt, đề nghị tuyển.",
                            "proposedSalary": extra["salaryAmount"]}),
                f"đề xuất tuyển {name}")
    must(*call("POST", f"/hiring-proposals/{prop['proposalId']}/decision", token=director,
               body={"approve": True, "note": "Đồng ý tuyển.",
                     "approvedSalary": extra["salaryAmount"]}),
         f"giám đốc duyệt {name}")
    body = dict(currency="VND", salaryPeriod="THANG", startDate=start_date, expiresInDays=7,
                benefits="Bảo hiểm sức khỏe, 12 ngày phép/năm, lương tháng 13",
                hrContactName=users["hr"]["name"], hrContactEmail=users["hr"]["email"],
                signerName=users["dm"]["name"], signerTitle="Trưởng phòng", **extra)
    call_any("POST", f"/applications/{a['id']}/offer", deciders(a["job"]), body=body,
             what=f"thư mời {name}")

for name, accepted, note in [
    ("Nguyễn Văn An", True, "Ứng viên xác nhận nhận việc qua điện thoại, bắt đầu đầu tháng sau."),
    ("Lê Thị Hồng", True, "Ứng viên đã ký thư mời và gửi lại bản scan."),
    ("Lưu Thị Hạnh", True, "Ứng viên đồng ý, sẽ nhận việc sau khi bàn giao chỗ cũ."),
    ("Đặng Quốc Toản", True, "Đã nhận việc, tin tuyển dụng đóng lại."),
    ("Phùng Ngọc Ánh", False, "Ứng viên từ chối vì nhận được offer cao hơn ở công ty khác."),
]:
    a = apps[name]
    call_any("POST", f"/applications/{a['id']}/offer/outcome", deciders(a["job"]),
             body={"accepted": accepted, "note": note}, what=f"ghi nhận kết quả offer {name}")
print("   + Offer: 2 đang chờ trả lời · 4 nhận việc (HIRED) · 1 từ chối (REJECTED)")

# ---------- 10) Ghi chú nội bộ ----------
NOTES = {
    "Trần Bích Ngọc": "Ứng viên đề nghị mức 25 triệu, đã trao đổi lại còn 24 triệu + thưởng dự án.",
    "Lê Quốc Bảo": "Kinh nghiệm .NET Core còn mỏng nhưng nền tảng C# tốt, cân nhắc cho vòng 2.",
    "Phạm Minh Khang": "Đã xác nhận lịch phỏng vấn, nhớ chuẩn bị bài test thiết kế API.",
    "Hoàng Mai Phương": "Có tệp khách hàng sẵn trong ngành phần mềm, điểm cộng lớn.",
    "Vương Thùy Chi": "Chỉ đi làm được 4 buổi/tuần, đã thống nhất lịch với Phòng Marketing.",
}
for name, content in NOTES.items():
    call_any("POST", f"/applications/{apps[name]['id']}/notes", [hr, dm, admin],
             body={"content": content}, what=f"ghi chú {name}")
print(f"   + {len(NOTES)} ghi chú nội bộ")

# ---------- 11) Đóng tin đã tuyển đủ ----------
# JobService.UpdateAsync gán thẳng từng field -> field nào không gửi sẽ bị ghi NULL.
# Vì vậy đọc job hiện tại rồi gửi lại nguyên vẹn, chỉ đổi status.
job_lead = must(*call("GET", f"/jobs/{jobs['lead']}", token=hr), "lấy job lead")
put_body = {k: job_lead.get(k) for k in
            ("title", "jdText", "departmentManagerId", "department", "location", "employmentType",
             "workMode", "experienceLevel", "salaryMin", "salaryMax", "currency", "deadline",
             "quantity", "requirements", "benefits", "skills")}
put_body["status"] = "Closed"
must(*call("PUT", f"/jobs/{jobs['lead']}", token=hr, body=put_body),
     "đóng tin Trưởng nhóm Kinh doanh")
print("   + Đã đóng tin 'Trưởng nhóm Kinh doanh' (tuyển đủ)")

state_count = {}
for a in apps.values():
    st = {"new": "NEW", "screening": "SCREENING", "invited": "INTERVIEW", "booked": "INTERVIEW",
          "scored": "INTERVIEW", "offer": "OFFER", "hired": "HIRED",
          "offer_declined": "REJECTED", "reject_new": "REJECTED", "reject_screen": "REJECTED"}[a["plan"]]
    state_count[st] = state_count.get(st, 0) + 1

print(f"""
============================================================
SEED XONG — công ty: {company.get('name')} (slug={slug})
Tài khoản (mật khẩu chung: {PASS})
  Human Resource : {users['hr']['email']}
  Interviewer    : {users['itv1']['email']} · {users['itv2']['email']} · {users['itv3']['email']}
  DM             : {users['dm']['email']}
  Giám đốc       : {users['dir']['email']}
Dữ liệu: {len(JOBS_DEF)} tin tuyển dụng · {len(CANDS)} ứng viên
  {' · '.join(f'{k}: {v}' for k, v in sorted(state_count.items()))}
Điểm demo:
  - Kanban job Backend: đủ NEW / SCREENING / INTERVIEW / OFFER / HIRED / REJECTED
  - Lịch phỏng vấn: nhân sự đặt buổi trực tiếp (ứng viên + panel + giờ), có buổi đã chấm xong
  - Interviewer -> phiếu chấm; DM -> Đề xuất tuyển; Giám đốc -> Duyệt đề xuất (chốt lương)
  - Offer: 2 chờ trả lời · 4 đã nhận việc · 1 từ chối
  - Yêu cầu tuyển dụng: 2 chờ duyệt · 1 đã convert · 1 bị từ chối
============================================================""")
