# GP35.SRIS DB Migrator (DbUp)

Migration có version cho SQL Server, tương tự **Flyway** nhưng thuần .NET.
Các script `.sql` trong `Scripts/` chạy **lần lượt theo thứ tự tên** và được ghi vào
bảng `dbo.SchemaVersions` (giống `flyway_schema_history`) nên **không bao giờ chạy lại** file cũ.

## Quy ước đặt tên

```
Scripts/V001__schema.sql        <- DDL: bảng, index, RLS
Scripts/V002__cv_scoring.sql    <- thêm cột file cho CvDocument
Scripts/V003__<mô tả>.sql       <- migration tiếp theo (tự thêm)
```

- Tiền tố `V<số thứ tự>__` quyết định thứ tự chạy. Số tăng dần, **không sửa script đã chạy**
  (đã vào DB người khác rồi) — luôn thêm script MỚI.
- Script là EmbeddedResource (khai báo trong `.csproj`), không cần `USE <db>;`
  (DbUp tự kết nối đúng DB qua connection string).

## Connection string

Đọc từ `appsettings.json` (`ConnectionStrings:DefaultConnection`), ghi đè được bằng biến môi trường:

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=...;Database=SRIS;User Id=...;Password=...;TrustServerCertificate=True"
```

## Lệnh

```powershell
# Chạy các migration CHƯA chạy (lệnh hay dùng nhất — giống `flyway migrate`)
dotnet run --project tools/GP35.SRIS.DbMigrator

# Xem migration đang chờ
dotnet run --project tools/GP35.SRIS.DbMigrator -- list

# Baseline: đánh dấu các script HIỆN CÓ là "đã chạy" mà không thực thi lại
# (dùng MỘT LẦN khi DB đã có sẵn schema từ trước — giống `flyway baseline`)
dotnet run --project tools/GP35.SRIS.DbMigrator -- mark
```

`EnsureDatabase` sẽ tự tạo database nếu chưa tồn tại → đồng nghiệp DB trống chỉ cần
`dotnet run --project tools/GP35.SRIS.DbMigrator` là có đủ schema.

## Thêm migration mới

1. Tạo file `Scripts/V00X__mô_tả.sql` (số kế tiếp).
2. `dotnet run --project tools/GP35.SRIS.DbMigrator` → chỉ script mới được chạy.

## Lưu ý

- **Seed/dữ liệu test** (`db/seed_*.sql`) KHÔNG nằm trong chuỗi migration này — chạy tay khi cần,
  để không nhét tài khoản test vào DB của mọi người. Muốn seed tự động cho môi trường dev thì
  có thể thêm một script `V00X__seed_dev.sql` riêng.
- Vector (`VECTOR(384)`) và RLS được viết SQL tay trong V001 — đó là lý do dùng DbUp (chạy raw SQL)
  thay vì EF Core Migrations (EF Core 8 không map được kiểu VECTOR).
