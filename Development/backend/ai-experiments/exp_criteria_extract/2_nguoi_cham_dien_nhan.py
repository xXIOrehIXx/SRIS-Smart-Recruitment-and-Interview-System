"""
============================================================================
 ĐIỀN PHIẾU CHẤM TAY vào out/<ver>/nguoi_cham_tung_dong.csv + nguoi_cham_bo_sot.csv

 Nhãn ở đây là BẢN NHÁP do trợ lý soạn theo LUAT_NGUOI_CHAM.md, người làm đề tài phải
 rà lại. Sửa nhãn thì sửa trong file này rồi chạy lại — đừng sửa tay vào
 nguoi_cham_tung_dong.csv, vì chạy lại 1_chay_model_va_may_cham.py là mất hết.

 Khoá là (mã tin, nguyên văn tiêu chí) nên một tiêu chí xuất hiện ở nhiều
 phiên bản luôn nhận cùng một nhãn — đây là điều kiện để so 4 bậc với nhau.

 Chạy:  python 2_nguoi_cham_dien_nhan.py
============================================================================
"""

import csv
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
VERS = ["v1", "v2", "v3", "v4"]

# (nhãn, ghi chú) — ghi chú bắt buộc với ca phân vân, theo LUAT_NGUOI_CHAM.md
LABELS = {
    # ------------------------------------------------------------------ J01
    "J01_ke_toan": {
        "Tốt nghiệp Cao đẳng trở lên chuyên ngành Kế toán - Kiểm toán": ("GIAYTO", "Nhìn bằng là xong"),
        "Có tối thiểu 2 năm kinh nghiệm ở vị trí kế toán tổng hợp": ("DUNG", ""),
        "Nắm vững chế độ kế toán và luật thuế hiện hành": ("DUNG", "Chế độ kế toán và luật thuế là một mảng kiến thức, chấm một điểm"),
        "Sử dụng thành thạo phần mềm kế toán MISA hoặc Fast": ("DUNG", "MISA/Fast là hai biến thể cùng một thứ, không tính gộp"),
        "Thành thạo Excel (hàm SUMIF, VLOOKUP, PivotTable)": ("DUNG", ""),
        "Cẩn thận, trung thực, chịu được áp lực mùa quyết toán": ("GOP", "Ba tính cách độc lập, phải cho ba điểm — V3/V4 tách đúng"),
        "Cẩn thận": ("DUNG", ""),
        "Trung thực": ("DUNG", ""),
        "Chịu được áp lực mùa quyết toán": ("DUNG", ""),
        "Kỹ năng báo cáo tài chính": ("DUNG", "Có trong skill_tags nên không tính bịa"),
        "Kỹ năng thuế GTGT": ("TRUNG", "Đã nằm trong dòng 'luật thuế hiện hành'"),
    },
    # ------------------------------------------------------------------ J02
    "J02_kinh_doanh": {
        "Kinh nghiệm bán hàng B2B": ("DUNG", ""),
        "Kỹ năng đàm phán và thuyết phục": ("DUNG", "Thuyết phục là một phần của đàm phán, một điểm"),
        "Kỹ năng giao tiếp, xây dựng quan hệ khách hàng": ("DUNG", "Xây dựng quan hệ là giao tiếp áp dụng vào bán hàng, một điểm"),
        "Chủ động tìm kiếm khách hàng mới": ("DUNG", ""),
        "Có thể chịu được áp lực doanh số": ("DUNG", ""),
        "Kỹ năng sử dụng CRM": ("DUNG", "Có trong skill_tags"),
        "Sẵn tệp khách hàng ngành xây dựng": ("DUNG", "CV không thể hiện, phải hỏi mới biết"),
        "Tệp khách hàng ngành xây dựng sẵn có": ("DUNG", "CV không thể hiện, phải hỏi mới biết"),
        "Đã có tệp khách hàng ngành xây dựng (ưu tiên)": ("DUNG", "CV không thể hiện, phải hỏi mới biết"),
    },
    # ------------------------------------------------------------------ J03
    "J03_kho_van": {
        "Tốt nghiệp THPT trở lên": ("GIAYTO", "Nhìn bằng là xong"),
        "Sức khỏe tốt, có thể làm việc theo ca": ("DUNG", "Ca ranh giới: mơ hồ và có kèm điều kiện ca làm, nhưng tin có nêu và người phỏng vấn vẫn hỏi được"),
        "Biết sử dụng máy tính văn phòng cơ bản (Word, Excel)": ("DUNG", "Một mức độ 'tin học văn phòng cơ bản', phần trong ngoặc chỉ là ví dụ"),
        "Cẩn thận, trung thực trong kiểm đếm hàng hóa": ("GOP", "Cẩn thận (không nhầm số) và trung thực (không gian lận) là hai điểm khác nhau"),
        "Ưu tiên có kinh nghiệm vận hành xe nâng": ("DUNG", ""),
        "Kinh nghiệm vận hành xe nâng": ("DUNG", ""),
        "Quản lý kho": ("DUNG", "Từ skill_tags; tên hơi trống nhưng hỏi được"),
        "Kiểm kê": ("DUNG", "Từ skill_tags"),
        "Xe nâng": ("TRUNG", "Trùng dòng 'kinh nghiệm vận hành xe nâng' cùng tin"),
        "Excel": ("TRUNG", "Trùng dòng 'máy tính văn phòng cơ bản (Word, Excel)'"),
        "Kỹ năng sử dụng Excel": ("TRUNG", "Trùng dòng 'máy tính văn phòng cơ bản (Word, Excel)'"),
    },
    # ------------------------------------------------------------------ J04
    "J04_dotnet": {
        "Kinh nghiệm với C# và ASP.NET Core": ("GOP", "Ngôn ngữ và framework chấm riêng được — V4 tách đúng"),
        "Kinh nghiệm với C#": ("DUNG", ""),
        "Kinh nghiệm với ASP.NET Core": ("DUNG", ""),
        "Kinh nghiệm với Entity Framework": ("DUNG", ""),
        "Kinh nghiệm với REST API": ("DUNG", ""),
        "Kinh nghiệm với kiến trúc microservices": ("DUNG", ""),
        "Thành thạo SQL Server và viết stored procedure": ("GOP", "Dùng được SQL Server khác với viết được stored procedure — V4 tách đúng"),
        "Thành thạo SQL Server": ("DUNG", ""),
        "Viết được stored procedure": ("DUNG", ""),
        "Sử dụng được Git trong quy trình làm việc nhóm": ("DUNG", ""),
        "Tiếng Anh đọc hiểu tài liệu kỹ thuật": ("DUNG", ""),
        "Tư duy phân tích, giải quyết vấn đề độc lập": ("DUNG", "Một năng lực giải quyết vấn đề, một điểm"),
    },
    # ------------------------------------------------------------------ J05
    "J05_hanh_chinh": {
        "Tốt nghiệp Đại học các ngành Quản trị nhân lực, Luật hoặc tương đương": ("GIAYTO", "Nhìn bằng là xong"),
        "Có 1 năm kinh nghiệm ở vị trí hành chính nhân sự": ("DUNG", ""),
        "Nắm được quy định về BHXH, hợp đồng lao động": ("DUNG", "Cùng một mảng pháp luật lao động, một điểm"),
        "Thành thạo Word, Excel, biết dùng phần mềm chấm công": ("GOP", "Ba công cụ khác nhau — V3/V4 tách đúng"),
        "Thành thạo Word": ("DUNG", ""),
        "Thành thạo Excel": ("DUNG", ""),
        "Biết dùng phần mềm chấm công": ("DUNG", ""),
        "Kỹ năng giao tiếp và sắp xếp công việc tốt": ("GOP", "Giao tiếp và tổ chức công việc là hai năng lực rời — V3/V4 tách đúng"),
        "Kỹ năng giao tiếp tốt": ("DUNG", ""),
        "Kỹ năng sắp xếp công việc tốt": ("DUNG", ""),
        "Cẩn thận, bảo mật thông tin": ("GOP", "Cẩn thận và ý thức bảo mật là hai điểm khác nhau; không phiên bản nào tách"),
        "Tính lương": ("DUNG", "Từ skill_tags"),
        "BHXH": ("TRUNG", "Trùng dòng 'quy định về BHXH, hợp đồng lao động'"),
        "Hợp đồng lao động": ("TRUNG", "Trùng dòng 'quy định về BHXH, hợp đồng lao động'"),
        "Excel": ("TRUNG", "Trùng dòng 'Thành thạo Word, Excel, biết dùng phần mềm chấm công'"),
        "Kỹ năng quản lý hồ sơ nhân sự": ("DAUVIEC", "Lấy nguyên đầu việc trong mô tả công việc"),
        "Kỹ năng đăng tin tuyển dụng và sàng lọc hồ sơ ứng viên": ("DAUVIEC", "Lấy nguyên đầu việc trong mô tả công việc"),
        "Kỹ năng tổ chức sự kiện nội bộ, sinh nhật nhân viên": ("DAUVIEC", "Lấy nguyên đầu việc trong mô tả công việc"),
        "Kỹ năng mua sắm và cấp phát văn phòng phẩm": ("DAUVIEC", "Lấy nguyên đầu việc trong mô tả công việc"),
    },
    # ------------------------------------------------------------------ J06
    "J06_le_tan": {
        "Ngoại hình": ("GIAYTO", "Nhìn là biết, không chấm phỏng vấn (rubric chốt sẵn)"),
        "Ngoại hình ưa nhìn": ("GIAYTO", "Nhìn là biết, không chấm phỏng vấn (rubric chốt sẵn)"),
        "Chiều cao từ 1m60 trở lên": ("GIAYTO", "Số đo, không phải thứ đem chấm"),
        "Tiếng Anh giao tiếp": ("DUNG", "Rubric chốt: tiếng Anh giao tiếp phải nói mới biết"),
        "Tiếng Anh giao tiếp tốt": ("DUNG", "Rubric chốt: tiếng Anh giao tiếp phải nói mới biết"),
        "Biết thêm tiếng Trung hoặc Hàn": ("DUNG", ""),
        "Kỹ năng giao tiếp": ("DUNG", ""),
        "Kỹ năng xử lý tình huống": ("DUNG", ""),
        "Kỹ năng xử lý tình huống với khách khó tính": ("DUNG", ""),
        "Có thể làm việc theo ca": ("DUNG", ""),
        "Có thể làm việc theo ca, kể cả cuối tuần và lễ tết": ("DUNG", ""),
        "Có kinh nghiệm lễ tân khách sạn 3 sao trở lên": ("DUNG", ""),
        "Kinh nghiệm làm lễ tân khách sạn 3 sao trở lên": ("DUNG", ""),
        "Có kinh nghiệm làm lễ tân khách sạn 3 sao trở lên": ("DUNG", ""),
        "Biết sử dụng OTA": ("DUNG", "Từ skill_tags; chỉ V2 nêu"),
    },
    # ------------------------------------------------------------------ J07
    "J07_marketing": {
        "Kinh nghiệm chạy quảng cáo Facebook Ads và Google Ads": ("GOP", "Hai nền tảng nối bằng 'và', chấm hai điểm được — V4 tách đúng"),
        "Kinh nghiệm chạy quảng cáo Facebook Ads": ("DUNG", ""),
        "Kinh nghiệm chạy quảng cáo Google Ads": ("DUNG", ""),
        "Viết nội dung bán hàng bằng tiếng Việt mạch lạc": ("DUNG", ""),
        "Năng lực viết nội dung bán hàng bằng tiếng Việt mạch lạc": ("DUNG", ""),
        "Biết sử dụng Canva hoặc Photoshop ở mức cơ bản": ("DUNG", "Nối bằng 'hoặc' — hai biến thể cùng một việc"),
        "Kiến thức cơ bản về sử dụng Canva hoặc Photoshop": ("DUNG", "Nối bằng 'hoặc' — hai biến thể cùng một việc"),
        "Sử dụng Canva hoặc Photoshop ở mức cơ bản": ("DUNG", "Nối bằng 'hoặc' — hai biến thể cùng một việc"),
        "Đọc hiểu số liệu và biết sử dụng Google Analytics": ("DUNG", "Ca ranh giới: đọc số và dùng GA là một năng lực phân tích, giữ nguyên một dòng"),
        "Kỹ năng đọc hiểu số liệu và sử dụng Google Analytics": ("DUNG", "Ca ranh giới: đọc số và dùng GA là một năng lực phân tích"),
        "Đọc hiểu số liệu và sử dụng Google Analytics": ("DUNG", "Ca ranh giới: đọc số và dùng GA là một năng lực phân tích"),
        "Sáng tạo, chủ động đề xuất ý tưởng": ("DUNG", "Chủ động đề xuất ý tưởng chính là biểu hiện của sáng tạo, một điểm"),
    },
    # ------------------------------------------------------------------ J09
    "J09_chi_dau_viec": {
        "Theo dõi hướng dẫn từ tổ trưởng": ("DAUVIEC", "Việc làm sau khi vào công ty"),
        "Kiểm tra chất lượng sản phẩm": ("DAUVIEC", "Việc làm sau khi vào công ty"),
        "Loại bỏ hàng lỗi": ("DAUVIEC", "Việc làm sau khi vào công ty"),
        "Vệ sinh máy móc sau ca làm việc": ("DAUVIEC", "Việc làm sau khi vào công ty"),
        "Ghi chép chính xác sản lượng": ("DAUVIEC", "Việc làm sau khi vào công ty"),
        "Ghi chép chính xác sản lượng vào biểu mẫu": ("DAUVIEC", "Việc làm sau khi vào công ty"),
        "Tuân thủ nội quy an toàn lao động": ("DAUVIEC", "Nội quy phải tuân thủ khi đã đi làm"),
        "Tuân thủ nội quy an toàn lao động của nhà máy": ("DAUVIEC", "Nội quy phải tuân thủ khi đã đi làm"),
        "Tham gia họp đầu ca": ("DAUVIEC", "Việc làm sau khi vào công ty"),
    },
    # ------------------------------------------------------------------ J10
    "J10_qua_nhieu": {
        "Kinh nghiệm phát triển phần mềm": ("DUNG", ""),
        "Kinh nghiệm dẫn dắt nhóm": ("DUNG", ""),
        "Thành thạo Java hoặc C#": ("DUNG", "Nối bằng 'hoặc'"),
        "Kinh nghiệm thiết kế kiến trúc hệ thống phân tán": ("DUNG", ""),
        "Nắm vững cơ sở dữ liệu quan hệ và tối ưu truy vấn": ("DUNG", "Tối ưu truy vấn nằm trong kiến thức CSDL quan hệ, một điểm"),
        "Kinh nghiệm với Docker, Kubernetes": ("GOP", "Hai công nghệ chấm riêng được; không phiên bản nào tách"),
        "Hiểu quy trình Agile/Scrum": ("DUNG", ""),
        "Kỹ năng giao tiếp và thuyết trình tốt": ("GOP", "Giao tiếp 1-1 và thuyết trình trước đám đông là hai điểm khác nhau"),
        "Kỹ năng huấn luyện, kèm cặp thành viên mới": ("DUNG", "Huấn luyện và kèm cặp là một việc"),
        "Tiếng Anh giao tiếp được với khách hàng nước ngoài": ("DUNG", ""),
        "Có chứng chỉ PMP hoặc Scrum Master": ("GIAYTO", "Chứng chỉ: có hoặc không, không có mức độ"),
        "Đã làm việc trong lĩnh vực fintech": ("GIAYTO", "Đọc phần công ty cũ trong CV là biết"),
        "Tốt nghiệp Đại học chuyên ngành CNTT": ("GIAYTO", "Nhìn bằng là xong"),
    },
    # ------------------------------------------------------------------ J08
    "J08_cskh": {
        "Tốt nghiệp Trung cấp trở lên": ("GIAYTO", "Nhìn bằng là xong"),
        "Trình độ học vấn": ("GIAYTO", "Vẫn là bằng cấp, chỉ đổi cách gọi"),
        "Có ít nhất 6 tháng kinh nghiệm chăm sóc khách hàng qua điện thoại": ("DUNG", ""),
        "Kinh nghiệm làm việc": ("DUNG", "Có căn cứ nhưng tên trống nghĩa — V2 hay rút gọn kiểu này"),
        "Giọng nói dễ nghe, phát âm rõ ràng": ("DUNG", "Ca ranh giới: nghe hai câu là biết, đúng thứ chỉ phỏng vấn mới đánh giá được"),
        "Giọng nói và phát âm": ("DUNG", "Cùng một khía cạnh giọng nói, một điểm"),
        "Kỹ năng lắng nghe và xoa dịu khách đang bức xúc": ("GOP", "Lắng nghe và xoa dịu chấm rời được — V2 tách đúng"),
        "Kỹ năng lắng nghe": ("DUNG", ""),
        "Kỹ năng xoa dịu khách hàng": ("DUNG", ""),
        "Sử dụng được Excel và phần mềm quản lý khách hàng": ("GOP", "Hai công cụ khác nhau — V3/V4 tách đúng"),
        "Sử dụng được Excel": ("DUNG", ""),
        "Nắm bắt Excel": ("DUNG", ""),
        "Sử dụng được phần mềm quản lý khách hàng": ("DUNG", ""),
        "Sử dụng phần mềm quản lý khách hàng": ("DUNG", ""),
        "Nắm bắt phần mềm quản lý khách hàng": ("DUNG", ""),
        "Kiên nhẫn, giữ được bình tĩnh khi bị khách lớn tiếng": ("DUNG", "Giữ bình tĩnh là biểu hiện của kiên nhẫn, một điểm"),
        "Kiên nhẫn và khả năng giữ bình tĩnh": ("DUNG", "Một điểm"),
    },
}

# Số tiêu chí AI BỎ SÓT — chỉ đếm thứ tự nó cũng đạt cả ba điều kiện DUNG.
# Không tính 'cắt cho đủ trần 10' ở J10 là bỏ sót (đúng thiết kế).
MISSING = {
    "J01_ke_toan":     {"v1": (0, ""), "v2": (0, ""),
                        "v3": (1, "Mất 'báo cáo tài chính' (có trong skill_tags)"),
                        "v4": (1, "Mất 'báo cáo tài chính' (có trong skill_tags)")},
    "J02_kinh_doanh":  {"v1": (0, ""), "v2": (0, ""), "v3": (0, ""),
                        "v4": (1, "Mất 'CRM' (có trong skill_tags)")},
    "J03_kho_van":     {"v1": (0, ""), "v2": (0, ""),
                        "v3": (2, "Mất 'quản lý kho' và 'kiểm kê' — luật ở V3 cắt quá tay"),
                        "v4": (0, "")},
    "J04_dotnet":      {"v1": (0, ""), "v2": (0, ""), "v3": (0, ""), "v4": (0, "")},
    "J05_hanh_chinh":  {"v1": (0, ""),
                        "v2": (1, "Mất 'tính lương' (có trong skill_tags)"),
                        "v3": (1, "Mất 'tính lương'"),
                        "v4": (1, "Mất 'tính lương'")},
    "J06_le_tan":      {"v1": (1, "Mất 'OTA' (có trong skill_tags)"), "v2": (0, ""),
                        "v3": (1, "Mất 'OTA'"), "v4": (1, "Mất 'OTA'")},
    "J07_marketing":   {"v1": (0, ""), "v2": (0, ""), "v3": (0, ""), "v4": (0, "")},
    "J09_chi_dau_viec": {"v1": (0, "Tin không nêu yêu cầu nào nên không có gì để sót"),
                         "v2": (0, "Tin không nêu yêu cầu nào nên không có gì để sót"),
                         "v3": (0, "Trả rỗng là ĐÚNG thiết kế"),
                         "v4": (0, "Trả rỗng là ĐÚNG thiết kế")},
    "J10_qua_nhieu":   {"v1": (0, ""),
                        "v2": (0, "Bỏ 3 dòng để về trần 10 và bỏ đúng 3 dòng giấy tờ"),
                        "v3": (0, "Bỏ đúng 3 dòng giấy tờ"),
                        "v4": (0, "Bỏ đúng 3 dòng giấy tờ")},
    "J08_cskh":        {"v1": (0, ""), "v2": (0, ""), "v3": (0, ""),
                        "v4": (0, "Thẻ kỹ năng 'xử lý khiếu nại' coi như đã nằm trong dòng "
                                  "'xoa dịu khách đang bức xúc', không tính là sót")},
}


def main() -> int:
    thieu = []
    for ver in VERS:
        out = HERE / "out" / ver

        lp = out / "nguoi_cham_tung_dong.csv"
        rows = list(csv.DictReader(lp.open(encoding="utf-8-sig")))
        for r in rows:
            key = LABELS.get(r["id"], {}).get(r["tieu_chi"])
            if key is None:
                thieu.append(f"{ver}  {r['id']:<20} {r['tieu_chi']}")
                continue
            r["nhan"], r["ghi_chu"] = key
        with lp.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=["id", "tieu_chi", "nhan", "ghi_chu"])
            w.writeheader()
            w.writerows(rows)

        mp = out / "nguoi_cham_bo_sot.csv"
        mrows = list(csv.DictReader(mp.open(encoding="utf-8-sig")))
        for r in mrows:
            n, note = MISSING[r["id"]][ver]
            r["so_bo_sot"], r["ghi_chu"] = n, note
        with mp.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=["id", "so_bo_sot", "ghi_chu"])
            w.writeheader()
            w.writerows(mrows)

        print(f"[OK] {ver}: {len(rows)} tiêu chí + {len(mrows)} dòng bỏ sót")

    if thieu:
        print("\n[!] Chưa có nhãn cho các dòng sau (thêm vào LABELS rồi chạy lại):")
        for t in thieu:
            print("   ", t)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
