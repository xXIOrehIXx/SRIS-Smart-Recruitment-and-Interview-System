# Script SQL chạy tay (demo / dọn dữ liệu)

Migration schema nằm ở `tools/GP35.SRIS.DbMigrator/Scripts/` và chạy tự động lúc host khởi
động. Thư mục này là các script **người chạy tay** bằng sqlcmd / SSMS: dựng dữ liệu demo,
dọn công ty rác, giãn ngày cho biểu đồ.

## Mọi file ở đây PHẢI lưu UTF-8 **có BOM**

Không phải chuyện thẩm mỹ — đây là lỗi đã đi tới hộp thư ứng viên.

sqlcmd không đoán encoding. File UTF-8 **không có BOM** mà không truyền `-f 65001` thì nó đọc
theo codepage ANSI của máy, và mọi literal `N'...'` tiếng Việt bị dịch sai **trước khi** tới
SQL Server. Cột vẫn là NVARCHAR, `INSERT` vẫn báo thành công, nên không có lỗi nào nổi lên —
chỉ có dữ liệu rác nằm im trong bảng:

```
N'THƯ MỜI NHẬN VIỆC'  ->  THÆ¯ Má»œI NHáº¬N VIá»†C
N'Công ty ... ABC'    ->  CÃ´ng ty ... ABC
```

Rác đó chảy thẳng ra ngoài: `seed_offer_ready_candidate.sql` seed tên công ty / tên vị trí /
tên ứng viên, mà `NotificationService` lấy đúng mấy trường đó dựng thư mời nhận việc. Bản thân
đường gửi mail không sai (MimeKit ra `charset=utf-8`, quoted-printable, round-trip khớp) —
nó chỉ gửi trung thực thứ đã hỏng sẵn trong DB.

**BOM chữa tận gốc:** sqlcmd, SSMS và Azure Data Studio đều tự nhận UTF-8 khi thấy BOM, nên
script chạy đúng dù người chạy có nhớ `-f 65001` hay không.

Kiểm tra trước khi commit:

```powershell
Get-ChildItem db\*.sql | ForEach-Object {
  $b = [System.IO.File]::ReadAllBytes($_.FullName)
  $ok = $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF
  "{0,-34} {1}" -f $_.Name, $(if ($ok) { "OK" } else { "THIEU BOM" })
}
```

Cẩn thận với editor: VS Code hiện `UTF-8` và `UTF-8 with BOM` là hai mục khác nhau ở thanh
trạng thái, chọn nhầm khi lưu là mất BOM mà diff nhìn như không có gì đổi.

## Soi lại dữ liệu đã lỡ hỏng

```sql
SELECT company_id, name FROM dbo.Company
WHERE name COLLATE Latin1_General_BIN LIKE '%Ã%'
   OR name COLLATE Latin1_General_BIN LIKE '%á»%'
   OR name COLLATE Latin1_General_BIN LIKE '%Æ%';
```

Không sửa tại chỗ được (thông tin đã mất khi dịch sai codepage) — xoá rồi seed lại bằng script
đã có BOM.
