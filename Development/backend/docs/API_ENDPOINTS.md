# SRIS Backend — API Endpoint Map (cho Frontend)

> ⚠️ **QUY TẮC CHO BACKEND:** thêm / sửa / xóa bất kỳ endpoint nào thì PHẢI cập nhật file này
> ngay trong cùng commit (thêm dòng vào đúng section, đánh dấu **MỚI dd/mm** hoặc **ĐỔI dd/mm**,
> sửa dòng "Cập nhật:" bên dưới). Đây là nguồn duy nhất FE dựa vào — file lệch code là FE gọi sai API.

> Cập nhật: 2026-07-17. Base URL mặc định dev: `http://localhost:5xxx` (xem `launchSettings.json`).
> Tất cả path đã có tiền tố `/api`. **KHÔNG** thêm `/api` lần hai ở FE (bug cũ trong `api.js`).
>
> **Auth:** gửi `Authorization: Bearer <accessToken>`. Token hết hạn → gọi `POST /api/Account/refresh-token`.
> **Multi-tenant:** tenant lấy từ JWT (claim `CompanyId`) — FE không cần gửi companyId ở body/query.
> **Response lỗi:** `{ errorCode, devMsg, userMsg, traceId, validationFailures }`.

Ký hiệu role: `Adm`=Admin · `Rec`=Recruiter · `Itv`=Interviewer · `DM`=DepartmentManager · `Anon`=không cần đăng nhập (magic link / public). Admin luôn bypass `[WithRole]`.

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
| GET | `/api/Account/me` | *auth | **MỚI 17/07** — hồ sơ người đang đăng nhập `{ userId, email, fullName, role, companyId }`. FE gọi sau login/refresh để route theo role |

## 2. Quản lý người dùng — `users` (Admin)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/users` | Adm | danh sách user trong công ty |
| GET | `/api/users/{userId}` | Adm | |
| POST | `/api/users` | Adm | tạo user (gán role) |
| PUT | `/api/users/{userId}` | Adm | cập nhật hồ sơ + role + status |
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

## 4. Tin tuyển dụng — `Jobs` (Rec/Adm)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/Jobs` | Rec | tạo job (JD) |
| GET | `/api/Jobs` | Rec/Adm | danh sách job |
| GET | `/api/Jobs/{jobId}` | Rec/Adm | chi tiết job |
| PUT | `/api/Jobs/{jobId}` | Rec | sửa job (đổi JD → xóa embedding, cần bóc lại tiêu chí) |
| DELETE | `/api/Jobs/{jobId}` | Rec | đóng job (soft, status=Closed) |

## 5. Tiêu chí đánh giá — `EvaluationCriteria` (Rec)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/jobs/{jobId}/criteria` | Rec | thêm tiêu chí thủ công |
| GET | `/api/jobs/{jobId}/criteria` | Rec | list tiêu chí của job |
| PUT | `/api/evaluation-criteria/{criteriaId}` | Rec | sửa 1 tiêu chí |
| DELETE | `/api/evaluation-criteria/{criteriaId}` | Rec | xóa (soft, active=0) |
| POST | `/api/jobs/{jobId}/criteria/extract` | Rec | AI bóc tiêu chí từ JD → DRAFT |
| POST | `/api/jobs/{jobId}/criteria/approve` | Rec | chốt DRAFT → APPROVED (sinh embedding SOFT) |
| GET | `/api/applications/{applicationId}/criteria-matches` | Rec | kết quả chấm CV theo từng tiêu chí (khớp/thiếu + bằng chứng) |
| POST | `/api/applications/{applicationId}/criteria-score` | Rec | chạy chấm CV theo tiêu chí (nền) |

## 6. Bộ mẫu tiêu chí — `criteria-templates` (Rec)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/criteria-templates` | Rec | tạo mẫu |
| GET | `/api/criteria-templates` | Rec | list |
| GET | `/api/criteria-templates/{templateId}` | Rec | |
| PUT | `/api/criteria-templates/{templateId}` | Rec | |
| DELETE | `/api/criteria-templates/{templateId}` | Rec | |
| POST | `/api/criteria-templates/{templateId}/apply/{jobId}` | Rec | áp mẫu vào job |

## 7. CV & chấm điểm — `cv-scoring` (Rec)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/cv-scoring/upload` | Rec | upload CV (PDF) — multipart. Chấm chạy nền, trả PENDING |
| GET | `/api/cv-scoring/jobs/{jobId}/ranking` | Rec | bảng xếp hạng CV theo điểm |
| GET | `/api/cv-scoring/cv/{cvId}/file-url` | Rec | presigned URL xem file CV |

## 8. Talent Pool (reverse matching) — `jobs/{jobId}/talent-pool`
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/jobs/{jobId}/talent-pool` | Rec | quét kho CV cũ cùng tenant khớp JD mới |

## 9. Hồ sơ ứng tuyển (đọc) — `ApplicationQuery` (Rec/DM)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/jobs/{jobId}/applications` | Rec/DM | board 4 pha (Hồ sơ mới/Sàng lọc/Phỏng vấn/Quyết định) |
| GET | `/api/applications/{applicationId}` | Rec/DM | chi tiết 1 hồ sơ |

## 10. Chuyển trạng thái — `ApplicationState` (Rec/DM)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/applications/{applicationId}/transition` | Rec/DM | forward-only; guard G2 ở INTERVIEW→OFFER |
| POST | `/api/applications/{applicationId}/reject` | Rec/DM | body cần `rejectReason` |

## 11. Lịch sử & ghi chú — (Rec/Itv/DM)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/applications/{applicationId}/history` | Rec/Itv/DM | nhật ký hoạt động |
| POST | `/api/applications/{applicationId}/notes` | Rec/Itv/DM | thêm ghi chú nội bộ |
| GET | `/api/applications/{applicationId}/notes` | Rec/Itv/DM | list ghi chú |

## 12. Đặt lịch phỏng vấn — POOL khung dùng chung (Rec)
> **ĐỔI MÔ HÌNH 07/2026:** không còn tạo lịch 1-1 per-ứng-viên. Recruiter mở 1 POOL khung cho job+vòng,
> mời DANH SÁCH ứng viên (mỗi người 1 magic link SCHEDULE), ai chốt trước lấy khung trước.
> Điều kiện mời: card đã ở pha Phỏng vấn (KÉO trước, MỜI sau).

| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/jobs/{jobId}/interview-pools` | Rec | mở pool. body `{ roundNumber?, slots: [{ interviewerId, startTime }] }` |
| GET | `/api/jobs/{jobId}/interview-pools` | Rec | mọi pool của job kèm khung + ứng viên đã mời + cờ vàng/đỏ báo bận (nhắc gọi điện) |
| POST | `/api/interview-pools/{poolId}/invitations` | Rec | mời ứng viên — body `{ applicationIds: [...] }`; BE tự phát magic link + gửi email |
| POST | `/api/interview-pools/{poolId}/cancel` | Rec | hủy pool — body `{ reason? }`; khóa khung, hủy invite chờ, email báo người đã chốt |
| POST | `/api/applications/{applicationId}/manual-interview` | Rec | chốt lịch TAY (nhánh gọi điện) — body `{ interviewerId, startTime, roundNumber? }` → trả `{ scheduleId }` |

## 13. Chấm phỏng vấn — `InterviewScoring`
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/me/interview-schedules` | Itv | lịch được phân công của tôi |
| GET | `/api/interview-schedules/{scheduleId}/my-sheet` | Itv | phiếu chấm của tôi (blind trước submit) |
| PUT | `/api/interview-schedules/{scheduleId}/my-sheet` | Itv | lưu nháp điểm |
| POST | `/api/interview-schedules/{scheduleId}/my-sheet/submit` | Itv | nộp phiếu (khóa, thỏa guard G2) |
| GET | `/api/interview-schedules/{scheduleId}/aggregate` | Rec/DM | tổng hợp điểm các interviewer |

## 14. Offer — `applications/{applicationId}/offer` (Rec/DM)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/applications/{applicationId}/offer` | Rec/DM | tạo offer (0..1 / application) |
| GET | `/api/applications/{applicationId}/offer` | Rec/DM | xem offer |

## 15. Magic link (Recruiter phát) — `applications/{applicationId}/magic-links`
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| POST | `/api/applications/{applicationId}/magic-links` | Rec | phát link cho candidate (SCHEDULE/STATUS/OFFER_RESPONSE) |

## 16. Mẫu email — `email-templates` (Rec)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/email-templates` | Rec | |
| GET | `/api/email-templates/{templateId}` | Rec | |
| POST | `/api/email-templates` | Rec | |
| PUT | `/api/email-templates/{templateId}` | Rec | |
| DELETE | `/api/email-templates/{templateId}` | Rec | |

## 17. Dashboard — `dashboard` (Rec/DM/Adm)
| Method | Path | Role | Ghi chú |
|---|---|---|---|
| GET | `/api/dashboard/overview` | Rec/DM/Adm | funnel, time-to-hire, offer acceptance, reject/source breakdown. `?jobId=` lọc theo 1 job |
| GET | `/api/dashboard/kanban` | Rec/DM/Adm | Kanban board pipeline. `?jobId=` lọc theo 1 job |

## 18. Candidate (magic link, không đăng nhập) — `Anon`
| Method | Path | Purpose | Ghi chú |
|---|---|---|---|
| GET | `/api/candidate/schedule?token=…` | SCHEDULE | xem slot phỏng vấn |
| POST | `/api/candidate/schedule/confirm` | SCHEDULE | chọn slot |
| POST | `/api/candidate/schedule/no-slot` | SCHEDULE | báo không slot nào phù hợp |
| GET | `/api/candidate/status?token=…` | STATUS | tra trạng thái hồ sơ |
| GET | `/api/candidate/offer?token=…` | OFFER_RESPONSE | xem offer |
| POST | `/api/candidate/offer/respond` | OFFER_RESPONSE | chấp nhận / từ chối |

## 19. Career Site công khai — `public/{slug}` (Anon)
| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/public/{slug}/brand` | thương hiệu công ty |
| GET | `/api/public/{slug}/jobs` | danh sách job đang mở |
| GET | `/api/public/{slug}/jobs/{jobId}` | chi tiết job |
| POST | `/api/public/{slug}/jobs/{jobId}/apply` | ứng tuyển (multipart CV) |

---

## Ghi chú cho FE
- **Luồng chính Recruiter:** tạo Job (§4) → bóc tiêu chí + chốt (§5) → upload CV (§7) → xem ranking (§7) → mở hồ sơ (§9) → xem chấm theo tiêu chí (§5 criteria-matches) → transition sang pha Phỏng vấn (§10) → mở pool + mời ứng viên (§12 — magic link SCHEDULE tự phát khi mời) → xem tổng hợp điểm (§13) → transition sang Quyết định → tạo offer (§14) → phát magic link OFFER_RESPONSE (§15).
- **Chọn người trong form:** gán interviewer vào khung / chọn DM cho job → `GET /api/users/options?role=…` (§2) — KHÔNG dùng `GET /api/users` (Admin-only).
- **Luồng Interviewer:** chỉ §13.
- **Luồng Admin:** §2 (users) + §3 (company) + §17 (dashboard).
- **Luồng Candidate:** chỉ §18/§19 qua magic link — không có tài khoản.
- **Trang Đăng ký (self-signup):** khách mua tự đăng ký — form 3 trường bắt buộc `{ companyName, adminEmail, adminPassword }` → `POST /api/Account/register` → nhận thẳng `{ accessToken, refreshToken, companyId }` (đã đăng nhập, khỏi gọi Login) → redirect vào Portal. Slug URL công khai BE tự sinh từ tên công ty (trùng thì tự thêm hậu tố); muốn tự chọn thì gửi thêm `slug`.
- Board hồ sơ (§9) trả **4 pha** hiển thị, không phơi 6 state nội bộ.
