# SRIS — Frontend

Giao diện người dùng của **Smart Recruitment and Interview System**, xây dựng bằng
**React 18 + Vite**. Ứng dụng gồm hai phần chạy chung một bundle:

- **Employer Portal** (cần đăng nhập) — Admin · Recruiter · Interviewer · Department Manager
- **Candidate Portal** (ẩn danh) — Career Site công khai và các trang mở bằng magic link

> Tổng quan hệ thống, kiến trúc và hướng dẫn chạy toàn bộ dịch vụ: xem
> [`README.md`](../../README.md) ở thư mục gốc.

## Yêu cầu

- Node.js 20+
- Backend đang chạy tại `http://localhost:5082` (xem `Development/backend`)

## Chạy dự án

```bash
npm install
npm run dev          # http://localhost:3000
```

Vite proxy mọi request `/api/*` sang backend, nên **không cần cấu hình CORS** khi phát triển.
Muốn trỏ sang backend khác:

```bash
VITE_API_TARGET=http://localhost:5083 npm run dev
```

## Các lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev server tại cổng 3000 (kèm proxy `/api`) |
| `npm run build` | Build production vào thư mục `build/` |
| `npm run preview` | Xem thử bản build |
| `npm test` | Chạy test (Vitest) |
| `npm run test:watch` | Chạy test ở chế độ theo dõi |
| `npm run storybook` | Storybook tại cổng 6006 |

## Công nghệ

| Hạng mục | Thư viện |
|---|---|
| Framework | React 18 · React Router 6 |
| Build | Vite 8 |
| Giao diện | Ant Design 5 · TailwindCSS 4 |
| Biểu đồ | Recharts · Ant Design Charts |
| Kanban | @hello-pangea/dnd |
| Gọi API | Axios (interceptor gắn token + chuẩn hóa lỗi) |
| Kiểm thử | Vitest · Testing Library · jsdom |

## Cấu trúc thư mục

```
src/
├── layouts/          # AdminLayout (portal), AuthLayout (đăng nhập/đăng ký)
├── components/       # Component dùng chung (ProtectedRoute, thẻ trạng thái, …)
├── contexts/         # Context toàn cục (phiên đăng nhập, thông tin công ty)
├── hooks/            # Custom hook
├── services/         # Lớp gọi API (api.js — base URL, token, xử lý lỗi)
└── pages/
    ├── auth/           # Đăng nhập, đăng ký, quên & đặt lại mật khẩu
    ├── admin/          # Quản lý tài khoản, phòng ban, loại hình làm việc
    ├── recruiter/      # Kanban, quản lý tin tuyển dụng, chi tiết ứng viên, đặt lịch
    ├── dept-manager/   # Yêu cầu tuyển dụng, quyết định tuyển dụng
    ├── interviewer/    # Buổi phỏng vấn, phiếu chấm, lịch sử chấm
    ├── criteria/       # Gọi AI đề xuất tiêu chí + duyệt & chỉnh bộ tiêu chí
    ├── analytics/      # Dashboard & biểu đồ tuyển dụng
    ├── offer/          # Quản lý thư mời làm việc
    ├── company/        # Thương hiệu công ty (logo, màu, giới thiệu)
    ├── mail-templates/ # Mẫu email tự động
    ├── recruitment/    # Career Site công khai + form nộp CV
    └── candidate/      # Trang magic link: chọn lịch · tra trạng thái · trả lời offer
```

## Quy ước

- **Không** thêm tiền tố `/api` lần thứ hai khi gọi endpoint — `services/api.js` đã gắn sẵn.
- Danh sách endpoint và vai trò được phép gọi: `Development/backend/docs/API_ENDPOINTS.md`.
- Token lưu ở client; hết hạn thì gọi `POST /api/Account/refresh-token` để lấy cặp token mới.
- `CompanyId` lấy từ JWT ở phía backend — **không** gửi kèm trong body hay query.
- Format code bằng Prettier (đã gắn `lint-staged`).
