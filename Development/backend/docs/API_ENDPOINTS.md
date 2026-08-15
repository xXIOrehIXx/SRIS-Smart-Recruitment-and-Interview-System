# SRIS Backend — API Endpoint Map (cho Frontend)

> ⚠️ **QUY TẮC CHO BACKEND:** thêm / sửa / xóa bất kỳ endpoint nào thì PHẢI cập nhật file này
> ngay trong cùng commit (thêm dòng vào đúng section, đánh dấu **MỚI dd/mm** hoặc **ĐỔI dd/mm**,
> sửa dòng "Cập nhật:" bên dưới). Đây là nguồn duy nhất FE dựa vào — file lệch code là FE gọi sai API.

> Cập nhật: 2026-08-14. Base URL mặc định dev: `http://localhost:5xxx` (xem `launchSettings.json`).
> Tất cả path đã có tiền tố `/api`. **KHÔNG** thêm `/api` lần hai ở FE (bug cũ trong `api.js`).
>
> **Auth:** gửi `Authorization: Bearer <accessToken>`. Token hết hạn → gọi `POST /api/Account/refresh-token`.
> **Multi-tenant:** tenant lấy từ JWT (claim `CompanyId`) — FE không cần gửi companyId ở body/query.
> **Response lỗi:** `{ errorCode, devMsg, userMsg, traceId, validationFailures }`.

Ký hiệu role: `Adm`=Admin · `Rec`=Human Resource · `Itv`=Interviewer · `DM`=DepartmentManager · `Anon`=không cần đăng nhập (magic link / public). Admin luôn bypass `[WithRole]`.

---

## 1. Auth & tài khoản — `Account`
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/Account/Login` | Anon | body `{ email, password }` → `{ companyId, accessToken, refreshToken }` |
| POST | `/api/Account/register` | Anon | Đăng ký công ty + Admin đầu tiên → tự đăng nhập. body `{ companyName, slug?, adminEmail, adminPassword, adminFullName? }` |
| POST | `/api/Account/forgot-password` | Anon | body `{ email }` → luôn 200 (chống dò email) |
| POST | `/api/Account/reset-password` | Anon | body `{ token, newPassword }` |
| POST | `/api/Account/refresh-token` | Anon | body `{ refreshToken }` → cặp token mới (xoay vòng) |
| POST | `/api/Account/logout` | *auth | JWT stateless — FE tự xóa token; endpoint chỉ để thống nhất |
| POST | `/api/Account/change-password` | *auth | tự đổi mật khẩu, body `{ oldPassword, newPassword }` — thu hồi các phiên khác |
| GET | `/api/Account/me` | *auth | **MỚI 17/07** — hồ sơ người đang đăng nhập `{ userId, email, fullName, phone, role, companyId }`. FE gọi sau login/refresh để route theo role. `fullName`/`phone` đọc từ DB (token chỉ đổi khi đăng nhập lại) |
| PUT | `/api/Account/me` | *auth | **MỚI 01/08** — tự sửa hồ sơ mình, body `{ fullName, phone? }`. Giữ nguyên role/status (không leo quyền, không tự mở khóa). Màn Settings dùng cái này, KHÔNG dùng `PUT /api/users/{id}` (Admin-only) |
| POST | `/api/Account/me/avatar` | *auth | **MỚI 09/08** — đổi ảnh đại diện của chính mình (multipart, field `file`) → `{ avatarUrl }` |
| DELETE | `/api/Account/me/avatar` | *auth | **MỚI 09/08** — gỡ ảnh đại diện → `{ avatarUrl: null }` |

## 2. Quản lý người dùng — `users` (Admin)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/users` | Adm | danh sách user trong công ty |
| GET | `/api/users/{userId}` | Adm | |
| POST | `/api/users` | Adm | tạo user (gán role) |
| PUT | `/api/users/{userId}` | Adm | cập nhật hồ sơ + role + status. body BẮT BUỘC `role`, và thiếu `status` sẽ mặc định `Active` → chỉ dùng cho màn quản trị user; tự sửa hồ sơ mình dùng `PUT /api/Account/me` (§1) |
| POST | `/api/users/{userId}/reset-password` | Adm | admin đặt lại mật khẩu user |
| DELETE | `/api/users/{userId}` | Adm | vô hiệu hóa (soft, status=Disabled) |
| GET | `/api/users/options?role=…` | Rec/DM | **MỚI 17/07** — dropdown chọn người (list rút gọn user Active). `?role=Interviewer` khi gán người chấm vào khung PV; `?role=DepartmentManager` khi chọn DM cho job; bỏ trống = tất cả. **Kết quả LUÔN kèm user Admin** kể cả khi lọc role (Admin làm được mọi việc — công ty 1 người tự gán mình được), FE cứ render thẳng list, không cần lọc lại |

## 3. Công ty / thương hiệu — `Company`
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/Company` | *auth | thông tin công ty hiện tại |
| PUT | `/api/Company` | Adm | cập nhật chung |
| PUT | `/api/Company/brand` | Adm | logo/màu/brand cho Career Site |
| GET | `/api/Company/smtp` | Adm | cấu hình SMTP riêng của công ty (mật khẩu bị che) |
| PUT | `/api/Company/smtp` | Adm | cập nhật SMTP (email đi từ tên miền công ty) |
| POST | `/api/Company/smtp/test` | Adm | gửi email thử — body `{ toEmail }` |

## 3b. Danh mục phòng ban — `departments` — **MỚI 09/08**
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/departments` | *auth | danh mục phòng ban của công ty — form Job / Yêu cầu tuyển dụng dùng làm dropdown (thay ô text tự do) |
| GET | `/api/departments/{departmentId}` | *auth | |
| POST | `/api/departments` | Adm | thêm phòng ban |
| PUT | `/api/departments/{departmentId}` | Adm | đổi tên → service tự đồng bộ tên đã lưu trong Job / Yêu cầu tuyển dụng |
| DELETE | `/api/departments/{departmentId}` | Adm | |

## 3c. Danh mục loại hình làm việc — `employment-types` — **MỚI 09/08**
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/employment-types` | *auth | dropdown cho form Job / Yêu cầu tuyển dụng / thư mời |
| GET | `/api/employment-types/{employmentTypeId}` | *auth | |
| POST | `/api/employment-types` | Adm | |
| PUT | `/api/employment-types/{employmentTypeId}` | Adm | |
| DELETE | `/api/employment-types/{employmentTypeId}` | Adm | |

## 4. Tin tuyển dụng — `Jobs` (Rec/Adm)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/Jobs` | Rec | tạo job (JD) |
| GET | `/api/Jobs` | Rec/Adm | danh sách job |
| GET | `/api/Jobs/{jobId}` | Rec/Adm | chi tiết job |
| PUT | `/api/Jobs/{jobId}` | Rec | sửa job (đổi JD → nên bóc lại tiêu chí) |
| DELETE | `/api/Jobs/{jobId}` | Rec | đóng job (soft, status=Closed) |

## 4b. Yêu cầu tuyển dụng — `recruitment-requests` — **MỚI 09/08**
> DM "ra đề" → Human Resource duyệt → tạo Job từ yêu cầu (docs 5.17). **TÙY CHỌN**: công ty nhỏ bỏ qua,
> tạo Job thẳng ở §4. Trạng thái: `PENDING → APPROVED → CONVERTED` / `REJECTED`, DM tự hủy khi
> còn PENDING → `CANCELLED`.

| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/recruitment-requests` | DM | tạo yêu cầu (PENDING) — vị trí, số lượng, tiêu chí cần thiết, mức lương, ngày cần người |
| GET | `/api/recruitment-requests` | DM/Rec | danh sách, `?status=PENDING/APPROVED/...` để lọc |
| GET | `/api/recruitment-requests/{requestId}` | DM/Rec | chi tiết |
| PUT | `/api/recruitment-requests/{requestId}` | DM | sửa — **chỉ khi còn PENDING** (giữ audit đề bài sau khi đã duyệt) |
| DELETE | `/api/recruitment-requests/{requestId}` | DM | hủy (soft → CANCELLED) — chỉ khi còn PENDING |
| POST | `/api/recruitment-requests/{requestId}/review` | Rec | duyệt — body `{ approve, note? }` → APPROVED / REJECTED |
| POST | `/api/recruitment-requests/{requestId}/convert` | Rec | gắn Job đã tạo từ yêu cầu — body `{ jobId }` → CONVERTED (truy vết đề bài → job) |

## 5. Tiêu chí đánh giá — `EvaluationCriteria` (Rec)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/jobs/{jobId}/criteria` | Rec | thêm tiêu chí thủ công |
| GET | `/api/jobs/{jobId}/criteria` | Rec | list tiêu chí của job |
| PUT | `/api/evaluation-criteria/{criteriaId}` | Rec | sửa 1 tiêu chí |
| DELETE | `/api/evaluation-criteria/{criteriaId}` | Rec | xóa (soft, active=0) |
| POST | `/api/jobs/{jobId}/criteria/extract` | Rec | **xếp hàng** lượt AI bóc tiêu chí → trả `202` ngay, không đợi AI |
| GET | `/api/jobs/{jobId}/criteria/extract-status` | Rec | hỏi trạng thái lượt bóc; poll tới khi `running=false`, rồi `DONE` → nạp lại tiêu chí / `FAILED` → hiện `errorMessage` |
| POST | `/api/jobs/{jobId}/criteria/approve` | Rec | chốt DRAFT → APPROVED; bộ tiêu chí này là phiếu chấm phỏng vấn |

## 6. Bộ mẫu tiêu chí — `criteria-templates` (Rec)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/criteria-templates` | Rec | tạo mẫu |
| GET | `/api/criteria-templates` | Rec | list |
| GET | `/api/criteria-templates/{templateId}` | Rec | |
| PUT | `/api/criteria-templates/{templateId}` | Rec | |
| DELETE | `/api/criteria-templates/{templateId}` | Rec | |
| POST | `/api/criteria-templates/{templateId}/apply/{jobId}` | Rec | áp mẫu vào job |

## 7. Nhận hồ sơ / CV — `cvs` (Rec)
> 08/08/2026: bỏ chấm điểm + xếp hạng CV. Upload chỉ NHẬN hồ sơ (trả `RECEIVED`).

| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/cvs/upload` | Rec | upload CV (PDF) — multipart; tạo Application ở NEW |
| GET | `/api/cvs/{cvId}/file-url` | Rec/DM | presigned URL xem file CV |

## 8. Hồ sơ ứng tuyển (đọc) — `ApplicationQuery` (Rec/DM)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/jobs/{jobId}/applications` | Rec/DM | board 4 pha (Hồ sơ mới/Sàng lọc/Phỏng vấn/Quyết định) |
| GET | `/api/applications/{applicationId}` | Rec/DM | chi tiết 1 hồ sơ |

## 9. Chuyển trạng thái — `ApplicationState` (Rec/DM)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/applications/{applicationId}/transition` | Rec/DM/Dir | forward-only; guard G2 ở INTERVIEW→OFFER. **2 cửa có người gác (403 nếu sai vai): `SCREENING→INTERVIEW` chỉ DM của vị trí (job chưa gán DM cũng 403); `INTERVIEW→OFFER` và rời OFFER chỉ GIÁM ĐỐC — đường bình thường là Giám đốc duyệt phiếu Đề xuất tuyển (§11b). Admin bypass.** |
| POST | `/api/applications/{applicationId}/reject` | Rec/DM | `rejectReason` **TÙY CHỌN** (ép nhập chỉ đẻ lý do rác) — FE cho chip chọn nhanh, bỏ trống vẫn reject được |

## 10. Lịch sử & ghi chú — (Rec/Itv/DM)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/applications/{applicationId}/history` | Rec/Itv/DM | nhật ký hoạt động |
| POST | `/api/applications/{applicationId}/notes` | Rec/Itv/DM | thêm ghi chú nội bộ |
| GET | `/api/applications/{applicationId}/notes` | Rec/Itv/DM | list ghi chú |

## 11. Đặt lịch phỏng vấn (Rec)
> **VIẾT LẠI 15/08/2026 — bỏ pool khung + magic link SCHEDULE.** Bộ phận nhân sự gọi cho người
> phỏng vấn hỏi lịch rảnh, gọi ứng viên chốt giờ, rồi NHẬP buổi. Hệ thống chống trùng giờ
> (ứng viên + cả panel, cách nhau ≥1 tiếng), gửi email xác nhận + .ics, tạo phiếu chấm.
> Điều kiện: hồ sơ đã được **Trưởng bộ phận duyệt** vào pha Phỏng vấn — chưa duyệt thì trả 409.

| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/applications/{applicationId}/interviews` | Rec | đặt buổi — body `{ interviewerIds: [1..5], startTime, roundNumber?, name? }` → `{ scheduleId }`. `startTime` là giờ ĐỊA PHƯƠNG (không 'Z') |
| GET | `/api/jobs/{jobId}/interviews` | Rec/DM/Dir | mọi buổi của vị trí kèm ứng viên + panel + giờ + trạng thái |
| POST | `/api/interview-schedules/{scheduleId}/cancel` | Rec | hủy buổi — body `{ reason? }`; khóa khung + email báo ứng viên. Đổi giờ = hủy rồi đặt lại |
| GET | `/api/interviews/interviewers` | Rec | dropdown người phỏng vấn (role Interviewer, Active) |

## 11b. Đề xuất tuyển — `HiringProposal` (DM đề xuất → Giám đốc quyết)
> **MỚI 15/08/2026 (V043).** Trưởng bộ phận KHÔNG đủ thẩm quyền tuyển: họ gửi đề xuất, **Giám đốc**
> duyệt. Duyệt đề xuất = hồ sơ sang OFFER kèm mức lương + ngày vào làm đã chốt (thư mời lấy đúng
> hai con số đó). Không duyệt ≠ loại ứng viên: hồ sơ ở lại INTERVIEW, DM đề xuất lại được.

| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/applications/{applicationId}/hiring-proposal` | DM | đề xuất — body `{ note?, proposedSalary?, proposedStartDate? }`. Đòi hồ sơ ở INTERVIEW + ≥1 phiếu chấm đã nộp + đúng DM của vị trí |
| GET | `/api/applications/{applicationId}/hiring-proposals` | DM/Dir/Rec | lịch sử đề xuất của 1 hồ sơ (gồm lần bị từ chối) |
| GET | `/api/hiring-proposals` | Dir/DM/Rec | hàng đợi — `?status=PENDING\|APPROVED\|REJECTED` |
| POST | `/api/hiring-proposals/{proposalId}/decision` | **Dir** | quyết — body `{ approve, note?, approvedSalary?, approvedStartDate? }`. Duyệt → transition INTERVIEW→OFFER |

## 12. Chấm phỏng vấn — `InterviewScoring`
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/me/interview-schedules` | Itv | lịch được phân công của tôi |
| GET | `/api/interview-schedules/{scheduleId}/my-sheet` | Itv | phiếu chấm của tôi (blind trước submit) |
| PUT | `/api/interview-schedules/{scheduleId}/my-sheet` | Itv | lưu nháp điểm |
| POST | `/api/interview-schedules/{scheduleId}/my-sheet/submit` | Itv | nộp phiếu → thỏa guard G2 + **mở blind** cho người khác đọc. **BẮT BUỘC có `recommendation`** (`STRONG_HIRE`/`HIRE`/`CONSIDER`/`NO_HIRE`) kèm nhận xét. Nộp rồi VẪN sửa được — phiếu chỉ khóa cứng khi hồ sơ sang OFFER/HIRED/REJECTED (FE theo cờ `isLocked`) |
| GET | `/api/interview-schedules/{scheduleId}/aggregate` | Rec/DM | tổng hợp điểm các interviewer của 1 buổi |
| GET | `/api/applications/{applicationId}/interview-aggregate` | Rec/DM | **MỚI 09/08** — tổng hợp điểm gộp mọi buổi/vòng của 1 hồ sơ |
| GET | `/api/applications/{applicationId}/decision-brief` | Rec/DM | **MỚI 09/08** — bản tóm cho người quyết: đề xuất của từng interviewer + note theo tiêu chí + ghi chú nội bộ, **KHÔNG có điểm số**; ý kiến trái chiều xếp trước. Màn "Quyết định tuyển dụng" dùng cái này, không dùng `aggregate` |

## 13. Thư mời nhận việc — `applications/{applicationId}/offer` (Rec/DM)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/applications/{applicationId}/offer/defaults` | Rec/DM | giá trị điền sẵn form soạn thư (từ Job + Company) |
| POST | `/api/applications/{applicationId}/offer` | Rec/DM | soạn + gửi thư mời (0..1 / application); tự phát link OFFER_RESPONSE |
| GET | `/api/applications/{applicationId}/offer` | Rec/DM | xem offer |
| GET | `/api/applications/{applicationId}/offer/letter` | Rec/DM | file PDF thư mời đã gửi (`application/pdf`) |
| POST | `/api/applications/{applicationId}/offer/outcome` | Rec/DM | ghi nhận ứng viên trả lời: `{accepted, note}` → HIRED / REJECTED |

## 14. Magic link (Human Resource phát) — `applications/{applicationId}/magic-links`
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/applications/{applicationId}/magic-links` | Rec | phát link cho candidate (STATUS/OFFER_RESPONSE — purpose SCHEDULE đã bỏ 15/08/2026) |

## 15. Mẫu email — `email-templates` (Rec)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/email-templates` | Rec | |
| GET | `/api/email-templates/{templateId}` | Rec | |
| POST | `/api/email-templates` | Rec | |
| PUT | `/api/email-templates/{templateId}` | Rec | |
| DELETE | `/api/email-templates/{templateId}` | Rec | |
| POST | `/api/email-assets` | Rec | **MỚI 09/08** — tải ảnh lên để chèn vào email (multipart, field `file`) → `{ url }`. Dùng cái này thay vì dán base64 vào nội dung |
| GET | `/api/public/email-assets/{companyId}/{fileName}` | Anon | **MỚI 09/08** — ảnh trong email (hộp thư của ứng viên phải tải được nên không chặn đăng nhập) |

> Thư mời nhận việc cũng là một email template (loại `OFFER_RESPONSE`): code dựng các khối dữ liệu
> (`{{positionBlock}}`, `{{compensationBlock}}`, `{{termsBlock}}`, `{{signature}}`, `{{letterhead}}`),
> template giữ phần lời văn + ảnh. Sửa câu chữ thư mời = sửa template này.

## 16. Dashboard — `dashboard` (Rec/DM/Adm)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/dashboard/overview` | Rec/DM/Adm | funnel, time-to-hire, offer acceptance, reject/source breakdown. `?jobId=` lọc theo 1 job |
| GET | `/api/dashboard/kanban` | Rec/DM/Adm | Kanban board pipeline. `?jobId=` lọc theo 1 job |

## 17. Candidate (magic link, không đăng nhập) — `Anon`
> Trang ứng viên tự chọn khung phỏng vấn đã bỏ 15/08/2026 — nhân sự gọi điện chốt giờ rồi nhập buổi.
| Method | Path | Purpose | Ghi chú |
|---|---|---|---|
| GET | `/api/candidate/status?token=…` | STATUS | tra trạng thái hồ sơ |
| GET | `/api/candidate/offer?token=…` | OFFER_RESPONSE | tóm tắt thư mời nhận việc |
| GET | `/api/candidate/offer/letter?token=…` | OFFER_RESPONSE | file PDF thư mời (`application/pdf`) — link trong email trỏ về trang này |

## 18. Career Site công khai — `public/{slug}` (Anon)
| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/public/{slug}/brand` | thương hiệu công ty |
| GET | `/api/public/{slug}/jobs` | danh sách job đang mở |
| GET | `/api/public/{slug}/jobs/{jobId}` | chi tiết job |
| POST | `/api/public/{slug}/jobs/{jobId}/apply` | ứng tuyển (multipart CV) |

---

## Ghi chú cho FE
- **Luồng chính Human Resource:** [tùy chọn] duyệt Yêu cầu tuyển dụng của DM (§4b) → tạo Job (§4) → bóc tiêu chí + chốt (§5) → [nếu đã duyệt yêu cầu] gắn job về yêu cầu bằng `convert` (§4b) → nhận CV (§7) → tự đọc/sàng lọc hồ sơ (§9) → transition sang pha Sàng lọc (§10) → **chờ DM duyệt vào pha Phỏng vấn** → gọi chốt giờ rồi đặt buổi (§11) → **chờ Giám đốc duyệt đề xuất của DM** → soạn + gửi thư mời nhận việc theo lương/ngày vào làm Giám đốc chốt (§14) → ứng viên trả lời NGOÀI hệ thống → ghi nhận kết quả `offer/outcome` (§14) → HIRED/REJECTED.
- **Luồng DM:** tạo Yêu cầu tuyển dụng (§4b) → **duyệt ứng viên ở pha Sàng lọc vào pha Phỏng vấn** (đọc hồ sơ + CV, rồi transition `INTERVIEW` / reject — §10) → phỏng vấn xong đọc `decision-brief` (§13) rồi **gửi Đề xuất tuyển** (§11b). DM KHÔNG tự chuyển hồ sơ sang bước Quyết định được nữa.
- **Luồng Giám đốc:** mở hàng đợi `GET /api/hiring-proposals?status=PENDING` (§11b) → đọc đề xuất + `decision-brief` (§13) → `decision` duyệt kèm lương/ngày vào làm, hoặc không duyệt. Duyệt là hành động đẩy hồ sơ sang bước Quyết định.
- **Chọn người trong form:** gán interviewer vào khung / chọn DM cho job → `GET /api/users/options?role=…` (§2) — KHÔNG dùng `GET /api/users` (Admin-only).
- **Luồng Interviewer:** chỉ §13.
- **Luồng Admin:** §2 (users) + §3 (company) + §17 (dashboard).
- **Luồng Candidate:** chỉ §18/§19 qua magic link — không có tài khoản.
- **Trang Đăng ký (self-signup):** khách mua tự đăng ký — form 3 trường bắt buộc `{ companyName, adminEmail, adminPassword }` → `POST /api/Account/register` → nhận thẳng `{ accessToken, refreshToken, companyId }` (đã đăng nhập, khỏi gọi Login) → redirect vào Portal. Slug URL công khai BE tự sinh từ tên công ty (trùng thì tự thêm hậu tố); muốn tự chọn thì gửi thêm `slug`.
- Board hồ sơ (§9) trả **4 pha** hiển thị, không phơi 6 state nội bộ.
