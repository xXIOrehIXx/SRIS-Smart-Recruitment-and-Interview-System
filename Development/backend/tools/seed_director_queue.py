# -*- coding: utf-8 -*-
"""
Seed hàng đợi "Duyệt đề xuất tuyển" của GIÁM ĐỐC (V043 + V057).

Điều kiện để một phiếu hiện ở màn đó (/director/*, GET /api/hiring-proposals?status=PENDING):
  - Application đang ở state INTERVIEW
  - Có >= 1 phiếu chấm phỏng vấn status='SUBMITTED'   (cùng ngưỡng guard G2)
  - Trưởng bộ phận của job đã gửi HiringProposal kèm proposed_salary  -> status PENDING

Khác seed_decision.py: script kia dừng ở màn "Quyết định tuyển dụng" của DM (chấm xong là hết);
script này đi thêm một bước — DM bấm ĐỀ XUẤT TUYỂN — nên phiếu rơi sang bàn Giám đốc.

KHÔNG hardcode application_id: script tự dò các hồ sơ đang ở INTERVIEW đã có lịch CONFIRMED
(GET /api/jobs/{id}/interviews) rồi xử lý LIMIT hồ sơ đầu tiên. Hồ sơ nào đã có phiếu PENDING
thì bỏ qua, nên chạy lại KHÔNG tạo phiếu trùng — nhưng nó sẽ lấy tiếp LIMIT hồ sơ MỚI. Tức
"chạy lại = thêm LIMIT phiếu nữa", không phải "chạy lại = không đổi gì". Hết hồ sơ ở INTERVIEW
thì script dừng và báo, không tạo bừa.

Chạy: python tools/seed_director_queue.py [so_luong]      (mặc định 4)
Yêu cầu: backend :5082. KHÔNG cần MinIO (không upload CV), KHÔNG cần AI service.

Lưu ý: script KHÔNG tạo lịch phỏng vấn mới -> không có email .ics nào bay đi. Nó chỉ nộp phiếu
chấm và gửi phiếu đề xuất, hai việc không gửi mail cho ứng viên.
"""
import json, sys, urllib.request, urllib.error

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:5082/api"
PASS = "demo123456"
HR = "hr@sris.vn"
# Đề xuất tuyển là cửa của Trưởng bộ phận (V043): token nhân sự / Giám đốc đều 403 ở bước này.
MANAGER = "dm@sris.vn"

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 4


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = None
    if body is not None:
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


# ---------------------------------------------------------------- hồ sơ mẫu
# Mỗi profile = một "dáng" hội đồng khác nhau, để màn Giám đốc không phải toàn phiếu giống hệt:
#   ratio   = mức lương đề xuất nằm ở đâu trong khung lương của job (0 = sàn, 1 = trần)
#   sheets  = điểm + đề xuất của TỪNG người trong panel (cắt bớt nếu panel ít người hơn)
PROFILES = [
    dict(
        tag="mạnh - cả hội đồng đồng ý",
        ratio=0.80,
        sheets=[
            dict(scores=[9, 9, 8, 8, 9], rec="STRONG_HIRE",
                 summary="Nền tảng chuyên môn rất chắc, giải thích được vì sao chọn từng giải pháp "
                         "chứ không chỉ kể đã làm gì. Đề nghị chốt sớm, ứng viên đang có lời mời khác.",
                 notes={0: "Trả lời sâu, có ví dụ thật từ dự án cũ",
                        2: "Chủ động hỏi ngược về quy trình của đội"}),
            dict(scores=[9, 8, 9, 8, 8], rec="HIRE",
                 summary="Kỹ thuật tốt, tư duy hệ thống rõ ràng. Giao tiếp mạch lạc, hợp với cách "
                         "làm việc của nhóm hiện tại."),
        ],
        note=("Cả hai người phỏng vấn đều đánh giá cao. Ứng viên làm được việc ngay, không cần "
              "thời gian kèm. Bộ phận đang thiếu người cho dự án quý tới nên đề nghị duyệt sớm; "
              "ứng viên có cho biết đang cân nhắc một lời mời khác."),
    ),
    dict(
        tag="khá - đồng ý nhưng lương sát khung dưới",
        ratio=0.45,
        sheets=[
            dict(scores=[8, 7, 8, 7, 8], rec="HIRE",
                 summary="Đủ sức nhận việc ngay ở mức Middle. Một vài mảng còn mỏng nhưng học nhanh, "
                         "trong đội có người kèm được."),
            dict(scores=[7, 7, 8, 6, 7], rec="HIRE",
                 summary="Kiến thức nền ổn, thái độ cầu thị. Cần vài tuần đầu làm quen quy trình "
                         "rồi mới giao việc độc lập được.",
                 notes={3: "Phần này trả lời còn chung chung"}),
        ],
        note=("Hội đồng thống nhất nên nhận. Ứng viên chưa đạt mức tự chủ hoàn toàn nên tôi đề xuất "
              "mức lương ở khoảng giữa khung, xem lại sau 6 tháng thử việc."),
    ),
    dict(
        tag="tốt - một phiếu rất cao, một phiếu dè dặt",
        ratio=0.65,
        sheets=[
            dict(scores=[9, 8, 9, 7, 9], rec="STRONG_HIRE",
                 summary="Người phù hợp nhất trong số đã gặp cho vị trí này. Kinh nghiệm đúng thứ "
                         "đội đang cần, chủ động đề xuất cách làm ngay trong buổi phỏng vấn."),
            dict(scores=[7, 6, 7, 7, 6], rec="CONSIDER",
                 summary="Chuyên môn không bàn, nhưng tôi hơi băn khoăn phần phối hợp: ứng viên quen "
                         "làm một mình. Nên trao đổi thêm về cách làm việc nhóm trước khi chốt.",
                 notes={1: "Ít kinh nghiệm review chéo với đồng nghiệp"}),
        ],
        note=("Hai phiếu lệch nhau: một phiếu STRONG_HIRE, một phiếu CONSIDER vì băn khoăn khả năng "
              "phối hợp. Tôi đã trao đổi riêng với cả hai người phỏng vấn — điểm băn khoăn nằm ở "
              "thói quen làm việc chứ không phải năng lực, và vị trí này có người dẫn dắt trực tiếp "
              "nên tôi vẫn đề xuất tuyển."),
    ),
    dict(
        tag="vừa đủ - đề xuất kèm điều kiện",
        ratio=0.35,
        sheets=[
            dict(scores=[7, 7, 6, 6, 7], rec="HIRE",
                 summary="Đáp ứng được yêu cầu tối thiểu của vị trí. Không xuất sắc nhưng chắc chắn, "
                         "làm được việc hằng ngày mà đội đang tồn đọng."),
            dict(scores=[6, 7, 7, 6, 6], rec="CONSIDER",
                 summary="Nhận được, với điều kiện có người kèm trong 2 tháng đầu. Nếu tuyển được "
                         "người tốt hơn trong tháng này thì nên so sánh trước khi chốt."),
        ],
        note=("Ứng viên vừa đủ yêu cầu, không phải phương án lý tưởng nhưng vị trí đã mở hơn một "
              "tháng và khối lượng việc đang dồn. Tôi đề xuất mức lương sát khung dưới, bù lại "
              "bằng đợt xem xét tăng sau 6 tháng."),
    ),
]


def money(job, ratio):
    """Mức lương đề xuất = điểm trong khung lương của job, làm tròn tới 500k."""
    lo = job.get("salaryMin") or 0
    hi = job.get("salaryMax") or 0
    if not lo or not hi or hi < lo:
        return 15_000_000
    raw = lo + (hi - lo) * ratio
    return int(round(raw / 500_000.0) * 500_000)


def fill_sheet(iv_token, schedule_id, sheet):
    """Chấm ĐỦ mọi tiêu chí rồi nộp — thiếu 1 tiêu chí hoặc thiếu đề xuất là BE chặn."""
    s, my = call("GET", f"/interview-schedules/{schedule_id}/my-sheet", token=iv_token)
    must(s, my, f"lay phieu cham (schedule {schedule_id})")
    if str(my.get("myStatus")) == "SUBMITTED":
        return False
    scores = sheet["scores"]
    items = []
    for i, c in enumerate(my["criteria"]):
        items.append({
            "criteriaId": c["criteriaId"],
            "score": min(scores[i % len(scores)], c.get("maxScore") or 10),
            "note": sheet.get("notes", {}).get(i),
        })
    must(*call("PUT", f"/interview-schedules/{schedule_id}/my-sheet", token=iv_token,
               body={"items": items, "recommendation": sheet["rec"], "summary": sheet["summary"]}),
         "luu nhap phieu")
    must(*call("POST", f"/interview-schedules/{schedule_id}/my-sheet/submit", token=iv_token),
         "nop phieu")
    return True


# ---------------------------------------------------------------- chạy
print(">> Dang nhap ...")
hr = login(HR)
dm = login(MANAGER)

# Phiếu đang chờ Giám đốc -> để bỏ qua hồ sơ đã nằm sẵn trong hàng đợi.
s, pending = call("GET", "/hiring-proposals?status=PENDING", token=dm)
must(s, pending, "lay hang doi de xuat")
already = {p["applicationId"] for p in (pending or [])}
print(f">> Hang doi Giam doc hien co: {len(already)} phieu PENDING")

s, jobs = call("GET", "/jobs", token=hr)
must(s, jobs, "lay danh sach job")
if isinstance(jobs, dict):
    jobs = jobs.get("items") or jobs.get("data") or []

# Gom mọi buổi phỏng vấn đã chốt của hồ sơ còn ở INTERVIEW.
targets = []
job_by_id = {}
for j in jobs:
    jid = j.get("jobId") or j.get("id")
    s, scheds = call("GET", f"/jobs/{jid}/interviews", token=hr)
    if s != 200 or not scheds:
        continue
    s2, detail = call("GET", f"/jobs/{jid}", token=hr)
    job_by_id[jid] = detail if s2 == 200 else j
    for sc in scheds:
        if sc.get("applicationState") != "INTERVIEW" or sc.get("status") != "CONFIRMED":
            continue
        if sc["applicationId"] in already:
            continue
        targets.append((jid, sc))

targets.sort(key=lambda t: t[1]["applicationId"])
targets = targets[:LIMIT]

if not targets:
    raise SystemExit("Khong co ho so nao dang o INTERVIEW (da co lich) de de xuat. "
                     "Chay tools/seed_interview_pending.py de tao them.")

iv_tokens = {}
created = []

for idx, (jid, sc) in enumerate(targets):
    prof = PROFILES[idx % len(PROFILES)]
    app_id = sc["applicationId"]
    panel = sc["interviewers"]
    job = job_by_id[jid]

    # Từng người trong panel chấm + nộp phiếu (phiếu thứ n lấy theo profile, thừa thì cắt).
    n_sheets = 0
    for k, iv in enumerate(panel):
        if k >= len(prof["sheets"]):
            break
        email = iv["email"]
        if email not in iv_tokens:
            iv_tokens[email] = login(email)
        if fill_sheet(iv_tokens[email], sc["scheduleId"], prof["sheets"][k]):
            n_sheets += 1

    salary = money(job, prof["ratio"])
    s, prop = call("POST", f"/applications/{app_id}/hiring-proposal", token=dm,
                   body={"note": prof["note"], "proposedSalary": salary})
    must(s, prop, f"de xuat tuyen {sc['candidateName']}")

    created.append((prop["proposalId"], app_id, sc["candidateName"], job.get("title"), salary, prof["tag"]))
    print(f"   + {sc['candidateName']:20s} app {app_id:4d} | {n_sheets} phieu da nop | "
          f"de xuat {salary:,} VND | phieu #{prop['proposalId']}  ({prof['tag']})")

print(f"""
============================================================
SEED XONG — {len(created)} phieu dang CHO GIAM DOC DUYET
Dang nhap: dir@sris.vn / {PASS}   (Giam doc)
  -> man "Duyet de xuat tuyen": {', '.join(c[2] for c in created)}
Duyet = ho so sang buoc Quyet dinh (OFFER) kem muc luong Giam doc chot.
Khong duyet (phai ghi ly do) = ho so O LAI buoc Phong van, DM de xuat lai duoc.
============================================================""")
