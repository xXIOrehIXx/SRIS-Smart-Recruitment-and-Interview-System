"""
============================================================================
 BƯỚC 2 — BẢNG NHÃN CHẤM TAY

 ĐÂY LÀ NƠI DUY NHẤT ĐỂ SỬA NHÃN. Đừng gõ thẳng vào out/<ver>/nguoi_cham_tung_cau.csv:
 chạy lại 1_chay_model_va_may_cham.py là mất sạch (script đó ghi đè phiếu trống).

 Nhãn khoá theo (mã CV + nguyên văn câu) chứ không theo số dòng: một câu giống hệt xuất
 hiện ở nhiều bậc prompt sẽ luôn nhận cùng một nhãn, không có chuyện cùng một câu bị chấm
 DUNG ở V3 và SAISO ở V4 chỉ vì hai lần chấm cách nhau vài hôm.

 Chạy:
   ..\\..\\ai-service\\.venv\\Scripts\\python.exe 2_nguoi_cham_dien_nhan.py

 -> điền nhãn vào cả 4 thư mục out/v1..v4, rồi báo còn bao nhiêu câu chưa gán.

 ---------------------------------------------------------------------------
 AI KHÔNG ĐƯỢC TỰ CHẤM BÀI CỦA AI — VÀ NHÃN Ở ĐÂY ĐANG LÀ BẢN SƠ BỘ

 Nhờ chính một mô hình ngôn ngữ chấm đầu ra của mô hình ngôn ngữ là lập luận vòng
 tròn: cùng một điểm mù (đọc "03/2019 đến nay" thành "5 năm") sẽ vừa gây ra lỗi vừa
 bỏ qua lỗi đó lúc chấm, và con số đẹp lên mà không ai biết vì sao.

 Nhãn trong bảng NHAN / BO_SOT dưới đây do trợ lý AI (Claude) SOẠN SƠ BỘ ngày
 25/09/2026 theo LUAT_NGUOI_CHAM.md — cùng cách làm với exp_criteria_extract. Chúng
 chỉ thành "tầng người" khi người làm đề tài đã DUYỆT LẠI, ưu tiên các dòng có ghi
 chú bắt đầu bằng "PHÂN VÂN". Khi trích số vào báo cáo phải nói rõ nguồn nhãn này.

 Chấm lệch về phía CHẶT: mọi con số model tự tính ra đều là SAISO kể cả khi tính
 đúng (luật mục 2), và mốc thời gian ở BO_SOT phải là mốc của chính kinh nghiệm đó —
 năm tốt nghiệp trùng năm không được tính thay.

 Tầng máy (1_chay_model_va_may_cham.py) thì ngược lại — nó chỉ đếm và đối chiếu chuỗi,
 không phán xét nội dung, nên chạy tự động được và số của nó dùng ngay được.
 ---------------------------------------------------------------------------

 CÁCH GÁN NHÃN
 1. Đọc LUAT_NGUOI_CHAM.md (5 mã + ranh giới khi phân vân + ngưỡng).
 2. Mở out/v1/nguoi_cham_tung_cau.csv để xem các câu cần chấm, đối chiếu với CV gốc
    trong dataset.json.
 3. Thêm dòng vào NHAN dưới đây theo mẫu:
        ("C01_khong_ghi_so_nam", "trần quốc hưng là một ứng viên có kinh nghiệm 5 năm..."): ("SAISO", "CV không ghi số năm, model tự cộng"),
    Chuỗi câu lấy NGUYÊN VĂN từ cột `cau` của CSV (đã hạ chữ thường, gom khoảng trắng).
    Không cần chép hết câu — dùng KHOÁ RÚT GỌN ở mục 4.
 4. Khoá rút gọn: chỉ cần chép ~40 ký tự ĐẦU của câu là đủ để khớp; script so theo
    tiền tố. Trùng tiền tố giữa hai câu khác nhau thì nó báo lỗi để bạn kéo dài khoá.
 5. Chạy lại script này rồi chạy 3_nguoi_cham_tinh_diem.py --all.
============================================================================
"""

import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import csv  # noqa: E402
from pathlib import Path  # noqa: E402

HERE = Path(__file__).parent
OUT = HERE / "out"
VERS = ["v1", "v2", "v3", "v4"]

HOP_LE = {"DUNG", "BIA", "SUYDIEN", "SAISO", "SAORONG"}


# ===========================================================================
#  BẢNG NHÃN — (mã CV, tiền tố câu) -> (nhãn, ghi chú)
#
#  BẢN SƠ BỘ — xem khối "AI KHÔNG ĐƯỢC TỰ CHẤM BÀI CỦA AI" ở đầu file.
#  Câu nào chưa có trong bảng thì cột `nhan` để trống và
#  3_nguoi_cham_tinh_diem.py bỏ qua, nên chấm được tới đâu tính tới đó.
#  Một khoá có thể khớp câu của nhiều bậc (cùng câu thì cùng nhãn).
# ===========================================================================
PV = "PHÂN VÂN: "  # tiền tố ghi chú cho dòng người duyệt cần xem kỹ

NHAN: dict[tuple[str, str], tuple[str, str]] = {
    # ---------------- C01 — CV chỉ có mốc, không ghi số năm ----------------
    ("C01_khong_ghi_so_nam", "trần quốc hưng là một ứng viên có kinh nghiệm 5 năm"): ("SAISO", "CV chỉ có mốc 03/2019 – nay, không ghi số năm; model tự cộng"),
    ("C01_khong_ghi_so_nam", "trần quốc hưng là ứng viên có kinh nghiệm 4 năm"): ("SAISO", "CV chỉ có mốc 03/2019 – nay; '4 năm' tự cộng và sai"),
    ("C01_khong_ghi_so_nam", "trần quốc hưng là lập trình viên backend có kinh nghiệm từ năm 2019"): ("DUNG", "Nhắc mốc thay vì tự cộng — đúng luật V4"),
    ("C01_khong_ghi_so_nam", "anh từng làm việc tại công ty cp giải pháp phần mềm tân việt (03/2019"): ("DUNG", ""),
    ("C01_khong_ghi_so_nam", "anh cũng có kỹ năng sử dụng sql server"): ("DUNG", PV + "nửa sau là phán xét 'có thể phù hợp'; giữ DUNG vì câu mang dữ kiện riêng của CV"),
    ("C01_khong_ghi_so_nam", "anh tốt nghiệp kỹ sư công nghệ thông tin tại đại học bách khoa"): ("DUNG", ""),
    ("C01_khong_ghi_so_nam", "anh tốt nghiệp kỹ sư công nghệ thông tin từ đại học bách khoa"): ("DUNG", ""),
    ("C01_khong_ghi_so_nam", "đạt yêu cầu về kinh nghiệm và kỹ năng cần thiết"): ("SAORONG", "Phán xét, không kể gì về CV"),
    ("C01_khong_ghi_so_nam", "ứng viên có kinh nghiệm phát triển và bảo trì"): ("DUNG", ""),
    ("C01_khong_ghi_so_nam", "trước đó, ứng viên từng làm tại công ty tnhh phần mềm minh long"): ("DUNG", ""),
    ("C01_khong_ghi_so_nam", "ứng viên tốt nghiệp kỹ sư công nghệ thông tin tại đại học bách khoa"): ("DUNG", ""),
    ("C01_khong_ghi_so_nam", "kỹ năng: c#, asp.net core"): ("DUNG", ""),
    ("C01_khong_ghi_so_nam", "anh có kinh nghiệm thiết kế rest api"): ("DUNG", ""),
    ("C01_khong_ghi_so_nam", "trước đó, anh từng làm việc tại công ty tnhh phần mềm minh long"): ("DUNG", ""),

    # ---------------- C02 — ca chuẩn, khớp yêu cầu ----------------
    ("C02_ketoan_khop", "lê thị mai hương là ứng viên có 6 năm kinh nghiệm"): ("DUNG", "CV ghi thẳng '6 năm kinh nghiệm ở vị trí này'"),
    ("C02_ketoan_khop", "lê thị mai hương là kế toán tổng hợp có 6 năm"): ("DUNG", ""),
    ("C02_ketoan_khop", "cô tốt nghiệp cử nhân kế toán từ đại học kinh tế quốc dân"): ("DUNG", ""),
    ("C02_ketoan_khop", "ngoài ra, cô từng làm kế toán viên tại công ty tnhh sản xuất bao bì"): ("DUNG", ""),
    ("C02_ketoan_khop", "ứng viên phù hợp với vị trí kế toán tổng hợp"): ("SAORONG", "Phán xét, không phải tóm tắt"),
    ("C02_ketoan_khop", "cv ứng viên lê thị mai hương ứng tuyển"): ("DUNG", PV + "đúng nhưng gần như không mang thông tin — chỉ nêu lại vị trí"),
    ("C02_ketoan_khop", "ứng viên tốt nghiệp cử nhân kế toán từ đại học kinh tế quốc dân năm 2016"): ("DUNG", ""),
    ("C02_ketoan_khop", "có 6 năm kinh nghiệm làm kế toán tổng hợp tại công ty cp thương mại đại phúc, trong đó"): ("SAISO", "Tự chia '3 năm KTTH + 3 năm KTV ở Hòa An' — CV: Hòa An 08/2016–12/2018 (~2,4 năm)"),
    ("C02_ketoan_khop", "ứng viên có kinh nghiệm hạch toán nghiệp vụ phát sinh"): ("DUNG", ""),
    ("C02_ketoan_khop", "thành thạo phần mềm misa, excel (hàm nâng cao"): ("DUNG", ""),

    # ---------------- C03 — fresher, CV mỏng ----------------
    ("C03_fresher_mong", "nguyễn hoàng long là sinh viên mới tốt nghiệp ngành ứng dụng phần mềm, có kinh nghiệm thực tế"): ("SUYDIEN", PV + "CV ghi 'ReactJS (mức đồ án)'; gọi là 'kinh nghiệm thực tế' là nâng quá mức CV nói"),
    ("C03_fresher_mong", "nguyễn hoàng long là sinh viên mới tốt nghiệp ngành ứng dụng phần mềm, tốt nghiệp năm 2024"): ("DUNG", ""),
    ("C03_fresher_mong", "anh có kỹ năng cơ bản về html, css, javascript và git"): ("DUNG", ""),
    ("C03_fresher_mong", "anh có kỹ năng cơ bản về html, css, javascript và reactjs"): ("DUNG", ""),
    ("C03_fresher_mong", "dù chưa có kinh nghiệm làm việc chuyên sâu"): ("DUNG", "Neo ở mục MỤC TIÊU; nói thẳng là chưa có kinh nghiệm = DUNG (luật mục 2)"),
    ("C03_fresher_mong", "tuy nhiên, anh chưa đáp ứng đủ yêu cầu về kinh nghiệm"): ("SUYDIEN", PV + "đúng là thiếu 2 năm/TypeScript, nhưng 'chưa có kinh nghiệm REST API' ngược CV ('gọi API do bạn trong nhóm viết')"),
    ("C03_fresher_mong", "anh cần tích lũy thêm kinh nghiệm"): ("SAORONG", "Lời khuyên, không kể CV"),
    ("C03_fresher_mong", "đồ án tốt nghiệp của anh cho thấy khả năng làm việc nhóm"): ("SUYDIEN", "Neo: đồ án nhóm 3 người; 'khả năng làm việc nhóm' là model tự suy ra"),
    ("C03_fresher_mong", "anh nên tập trung vào việc nâng cao"): ("SAORONG", "Lời khuyên"),
    ("C03_fresher_mong", "ngoài ra, anh cần thể hiện rõ hơn"): ("SAORONG", "Lời khuyên sửa CV"),
    ("C03_fresher_mong", "anh cũng nên nhấn mạnh"): ("SAORONG", "Lời khuyên sửa CV"),
    ("C03_fresher_mong", "việc có kinh nghiệm làm việc thực tế"): ("SAORONG", "Lời khuyên"),
    ("C03_fresher_mong", "anh cần cải thiện cv"): ("SAORONG", "Lời khuyên sửa CV"),
    ("C03_fresher_mong", "anh cũng nên tìm cách phát triển"): ("SAORONG", "Câu cụt — V2 viết lan tới trần độ dài"),
    ("C03_fresher_mong", "cv ứng viên nguyễn hoàng long là sinh viên mới tốt nghiệp"): ("DUNG", ""),
    ("C03_fresher_mong", "trong đồ án tốt nghiệp, ứng viên tham gia nhóm 3 người"): ("DUNG", ""),
    ("C03_fresher_mong", "kỹ năng của ứng viên bao gồm html"): ("DUNG", ""),
    ("C03_fresher_mong", "mục tiêu nghề nghiệp là tìm môi trường"): ("DUNG", ""),
    ("C03_fresher_mong", "anh đã tham gia dự án website bán đồ thể thao"): ("DUNG", ""),

    # ---------------- C04 — trái ngành ----------------
    ("C04_trai_nganh", "cv của phạm đức thắng thể hiện kinh nghiệm"): ("SAISO", "Tự tính '3 năm Thành Đô + 2 năm Bình Minh' — CV chỉ có mốc 05/2021–nay và 09/2018–04/2021"),
    ("C04_trai_nganh", "anh có kinh nghiệm tư vấn, bán sản phẩm"): ("DUNG", ""),
    ("C04_trai_nganh", "tuy nhiên, cv không có kinh nghiệm lập trình"): ("DUNG", "Nêu đúng CV không có nền lập trình (mốc bắt buộc của C04); đuôi 'không phù hợp' là phán xét nhưng câu có dữ kiện riêng"),
    ("C04_trai_nganh", "cv ứng viên phạm đức thắng không có kinh nghiệm lập trình"): ("DUNG", ""),
    ("C04_trai_nganh", "ứng viên có kinh nghiệm làm chuyên viên kinh doanh và nhân viên bán hàng"): ("DUNG", ""),
    ("C04_trai_nganh", "không có thông tin về kỹ năng lập trình backend"): ("DUNG", ""),
    ("C04_trai_nganh", "ứng viên phạm đức thắng có kinh nghiệm làm chuyên viên kinh doanh tại hai công ty trong vòng 4 năm"): ("SAISO", "'4 năm' tự tính, lại sai: CV 09/2018 – nay; nơi thứ hai là nhân viên bán hàng, không phải chuyên viên KD"),
    ("C04_trai_nganh", "anh tốt nghiệp cử nhân quản trị kinh doanh"): ("DUNG", PV + "CV ghi 'chăm sóc khách hàng, tiếng Anh giao tiếp cơ bản', không đúng chữ 'kỹ năng giao tiếp' — coi là cùng ý"),
    ("C04_trai_nganh", "tuy nhiên, không có kinh nghiệm lập trình hay kỹ năng"): ("DUNG", ""),

    # ---------------- C05 — nhảy việc nhiều mốc ----------------
    ("C05_nhay_viec_nhieu_moc", "đỗ thị thanh vân có kinh nghiệm 2 năm"): ("SAISO", "Tự cộng; riêng VietTravel 06/2023–nay + Sao Mai 08/2019–02/2021 đã hơn 2 năm"),
    ("C05_nhay_viec_nhieu_moc", "cô có kỹ năng giao tiếp, xử lý khiếu nại, sử dụng word"): ("DUNG", ""),
    ("C05_nhay_viec_nhieu_moc", "cv phù hợp với yêu cầu công việc chăm sóc khách hàng tại tổng đài."): ("SAORONG", "Chỉ có phán xét"),
    ("C05_nhay_viec_nhieu_moc", "cv phù hợp với yêu cầu công việc chăm sóc khách hàng tại tổng đài và"): ("SUYDIEN", "Có neo (tổng đài ở VietTravel) nhưng kết luận 'chưa đủ thời gian như yêu cầu' sai: JD đòi 1 năm, CV từ 06/2023"),
    ("C05_nhay_viec_nhieu_moc", "tuy nhiên, kinh nghiệm trong chăm sóc khách hàng và giao tiếp tiếng anh"): ("DUNG", PV + "câu đánh giá 'điểm mạnh' nhưng neo đúng vào CV (CSKH, TOEIC 600)"),
    ("C05_nhay_viec_nhieu_moc", "đỗ thị thanh vân hiện đang sống"): ("DUNG", "Đúng (TP.HCM) nhưng là thông tin liên hệ, vô ích cho người tuyển"),
    ("C05_nhay_viec_nhieu_moc", "hồ chí minh, có thể liên hệ"): ("DUNG", "Mảnh câu do tách ở 'tp.'; email/SĐT có trong CV"),
    ("C05_nhay_viec_nhieu_moc", "tổng thể, cv này thể hiện sự phù hợp"): ("SAORONG", ""),
    ("C05_nhay_viec_nhieu_moc", "đỗ thị thanh vân có thể là ứng viên tiềm năng"): ("SAORONG", "Lặp 2 lần"),
    ("C05_nhay_viec_nhieu_moc", "cv này thể hiện sự chuyên nghiệp"): ("SAORONG", "Lặp 2 lần"),
    ("C05_nhay_viec_nhieu_moc", "đỗ thị thanh vân có kinh nghiệm làm việc trong lĩnh vực chăm sóc khách hàng và hỗ trợ"): ("DUNG", ""),
    ("C05_nhay_viec_nhieu_moc", "cô từng làm nhân viên chăm sóc khách hàng tại công ty du lịch viettravel"): ("DUNG", ""),
    ("C05_nhay_viec_nhieu_moc", "trước đó, cô cũng có kinh nghiệm làm giám sát ca"): ("DUNG", "Đủ 4 mốc cũ, đúng thứ tự, không trộn thành tích"),
    ("C05_nhay_viec_nhieu_moc", "cô tốt nghiệp cao đẳng du lịch sài gòn"): ("DUNG", ""),
    ("C05_nhay_viec_nhieu_moc", "kỹ năng của cô bao gồm giao tiếp"): ("DUNG", ""),
    ("C05_nhay_viec_nhieu_moc", "đỗ thị thanh vân có kinh nghiệm làm chăm sóc khách hàng tại tổng đài và tư vấn"): ("DUNG", ""),
    ("C05_nhay_viec_nhieu_moc", "cô có kỹ năng giao tiếp, xử lý khiếu nại, và sử dụng excel"): ("DUNG", ""),
    ("C05_nhay_viec_nhieu_moc", "ngoài ra, cô có chứng chỉ tiếng anh toeic 600"): ("DUNG", "Đuôi 'đáp ứng yêu cầu' là phán xét, câu vẫn có dữ kiện"),

    # ---------------- C06 — text PDF lộn xộn ----------------
    ("C06_text_pdf_lon_xon", "cv ứng viên võ hoàng minh có kinh nghiệm 2 năm"): ("SAISO", "CV: CNC 04/2020 – nay; '2 năm' không khớp (nhiều khả năng lấy từ '2 ca'). Tên cty 'Thành Công' đọc thành 'thanh công'"),
    ("C06_text_pdf_lon_xon", "anh có kỹ năng vận hành máy phay cnc"): ("DUNG", ""),
    ("C06_text_pdf_lon_xon", "ngoài ra, ứng viên còn có khả năng làm việc theo ca"): ("DUNG", ""),
    ("C06_text_pdf_lon_xon", "ngoài ra, ứng viên còn có kiến thức cơ bản về autocad"): ("DUNG", ""),
    ("C06_text_pdf_lon_xon", "anh có trình độ cao đẳng kỹ thuật cơ khí"): ("DUNG", ""),
    ("C06_text_pdf_lon_xon", "tỷ lệ phế phẩm của anh là dưới 2%"): ("SAISO", "Số đúng, gán sai chỗ: 'dưới 2%' là ở Đại Phát (nơi làm HIỆN TẠI), không phải 'công ty trước đây'"),
    ("C06_text_pdf_lon_xon", "anh phù hợp với yêu cầu công việc và có thể bắt đầu"): ("BIA", "'Có thể bắt đầu làm ngay' không có trong CV"),
    ("C06_text_pdf_lon_xon", "đã có kinh nghiệm trong lập chương trình"): ("DUNG", "Chữ dính từ PDF ('trên máy đọc bản vẽ') nhưng nội dung có trong CV"),
    ("C06_text_pdf_lon_xon", "anh có thể làm việc theo ca và có tinh thần trách nhiệm"): ("BIA", "'Tinh thần trách nhiệm cao' không có trong CV"),
    ("C06_text_pdf_lon_xon", "anh là ứng viên tiềm năng"): ("SAORONG", ""),
    ("C06_text_pdf_lon_xon", "anh có thể mang lại giá trị"): ("SAORONG", "Lặp 2 lần"),
    ("C06_text_pdf_lon_xon", "anh có thể là lựa chọn lý"): ("SAORONG", "Lặp 2 lần, lần sau cụt kèm ký tự Trung Quốc — V2 viết lan tới trần"),
    ("C06_text_pdf_lon_xon", "ứng viên cũng có kinh nghiệm 1 năm và 9 tháng"): ("SAISO", PV + "06/2018–03/2020 đúng là ~1 năm 9 tháng — tính ĐÚNG, nhưng luật mục 2 coi mọi số tự tính là SAISO"),
    ("C06_text_pdf_lon_xon", "ứng viên tốt nghiệp cao đẳng kỹ thuật cao thắng"): ("DUNG", ""),
    ("C06_text_pdf_lon_xon", "kỹ năng: đọc bản vẽ"): ("DUNG", ""),
    ("C06_text_pdf_lon_xon", "ứng viên là kỹ sư cơ khí có kinh nghiệm vận hành máy cnc từ năm 2020"): ("DUNG", ""),
    ("C06_text_pdf_lon_xon", "anh có kinh nghiệm kiểm tra kích thước"): ("DUNG", ""),
    ("C06_text_pdf_lon_xon", "tốt nghiệp cao đẳng kỹ thuật cao thắng"): ("DUNG", ""),

    # ---------------- C07 — CV song ngữ ----------------
    ("C07_song_ngu", "nguyen thi phuong linh là ứng viên có 2 năm"): ("SAISO", "CV 09/2020 – Present; '2 năm' là con số của JD"),
    ("C07_song_ngu", "cô có kinh nghiệm chạy quảng cáo google ads"): ("DUNG", PV + "CV 'around 300 million VND in total' (tổng 6 khách), model viết 'lên đến' — gần đúng"),
    ("C07_song_ngu", "linh cũng có khả năng đo lường"): ("DUNG", ""),
    ("C07_song_ngu", "ngoài ra, cô còn có kỹ năng thiết kế nội dung quảng cáo với canva"): ("SUYDIEN", PV + "Canva chỉ nằm ở mục Skills; CV nói PHỐI HỢP với đội thiết kế — ghép hai thứ thành 'tự thiết kế bằng Canva'"),
    ("C07_song_ngu", "trong quá khứ, linh từng làm marketing intern"): ("DUNG", ""),
    ("C07_song_ngu", "với kinh nghiệm và kỹ năng phù hợp"): ("SAORONG", ""),
    ("C07_song_ngu", "cv ứng viên nguyễn thị phương linh ứng tuyển"): ("DUNG", PV + "đúng nhưng không mang thông tin"),
    ("C07_song_ngu", "ứng viên có 2 năm kinh nghiệm digital marketing"): ("SAISO", "CV 09/2020 – Present; '2 năm' là con số của JD"),
    ("C07_song_ngu", "cô cũng xây dựng báo cáo hiệu suất"): ("DUNG", ""),
    ("C07_song_ngu", "ứng viên từng làm marketing intern"): ("DUNG", ""),
    ("C07_song_ngu", "ứng viên tốt nghiệp cử nhân kinh doanh quốc tế"): ("DUNG", ""),
    ("C07_song_ngu", "kỹ năng: google ads"): ("DUNG", ""),
    ("C07_song_ngu", "nguyễn thị phương linh là digital marketing executive có kinh nghiệm 2 năm"): ("SAISO", "Vẫn ra '2 năm' dù V4 cấm tự tính — câu 2 ngay sau lại ghi đúng 09/2020 đến nay"),
    ("C07_song_ngu", "cô làm việc tại abc digital agency từ 09/2020"): ("DUNG", ""),
    ("C07_song_ngu", "phương linh có kỹ năng sử dụng google analytics 4"): ("DUNG", ""),
    ("C07_song_ngu", "cô cũng có kinh nghiệm phối hợp với đội thiết kế"): ("DUNG", ""),

    # ---------------- C08 — thành tích nhiều số ----------------
    ("C08_thanh_tich_nhieu_so", "bùi trung kiên hiện là trưởng nhóm kinh doanh với hơn 4 năm"): ("SAISO", "'hơn 4 năm, 2 năm quản lý' là ngưỡng của JD, không phải số của CV (08/2017 – nay, trưởng nhóm từ 03/2021)"),
    ("C08_thanh_tich_nhieu_so", "anh có kinh nghiệm xây dựng và triển khai chỉ tiêu"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "anh cũng có kỹ năng đàm phán và trình bày tốt"): ("DUNG", PV + "CV liệt kê 'đàm phán, trình bày trước khách hàng'; chữ 'tốt' mượn từ JD"),
    ("C08_thanh_tich_nhieu_so", "trước đó, anh từng làm nhân viên kinh doanh tại công ty tnhh thương mại tân á và"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "bùi trung kiên hiện đang là trưởng nhóm"): ("SAISO", "'3 năm kinh nghiệm' tự tính — CV 03/2021 – nay"),
    ("C08_thanh_tich_nhieu_so", "ông có kinh nghiệm quản lý đội nhóm 12"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "trước đó, ông từng làm nhân viên kinh doanh"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "ông tốt nghiệp cử nhân marketing"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "cv này phù hợp với vị trí trưởng nhóm"): ("SAORONG", ""),
    ("C08_thanh_tich_nhieu_so", "đạt yêu cầu về kinh nghiệm và kỹ năng cần thiết"): ("SAORONG", "Cùng một câu lặp 13 lần"),
    ("C08_thanh_tich_nhieu_so", "bùi trung kiên ứng viên có kinh nghiệm 6 năm"): ("SAISO", "Tự cộng; CV 08/2017 – nay"),
    ("C08_thanh_tich_nhieu_so", "anh đã quản lý đội 12 nhân viên"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "đội đạt doanh số 46 tỷ"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "ngoài ra, anh còn đàm phán và ký 27"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "trước đó, anh từng làm nhân viên kinh doanh tại công ty tnhh thương mại tân á (2017"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "anh tốt nghiệp cử nhân marketing tại đại học thương mại (2013"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "kỹ năng nổi bật: đàm phán"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "bùi trung kiên hiện là trưởng nhóm kinh doanh tại công ty"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "anh quản lý đội 12 nhân viên"): ("DUNG", "Mọi số (12, 118%, 104%) khớp CV"),
    ("C08_thanh_tich_nhieu_so", "anh cũng có kinh nghiệm đàm phán và ký 27"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "trước đó, anh từng làm nhân viên kinh doanh tại công ty tnhh thương mại tân á từ 08/2017"): ("DUNG", ""),
    ("C08_thanh_tich_nhieu_so", "anh tốt nghiệp cử nhân marketing từ đại học thương mại năm 2017"): ("DUNG", ""),

    # ---------------- C09 — khoảng trống sự nghiệp ----------------
    ("C09_khoang_trong_su_nghiep", "trịnh thu hà là ứng viên có kinh nghiệm 4 năm"): ("SAISO", "CV có hai giai đoạn 05/2016–07/2020 và 09/2022–nay; '4 năm' tự cộng và bỏ mất một giai đoạn"),
    ("C09_khoang_trong_su_nghiep", "trịnh thu hà là chuyên viên nhân sự có kinh nghiệm 4 năm"): ("SAISO", "Vẫn tự cộng '4 năm' dù V4 cấm — đúng khiếm khuyết README đã ghi (CV hai mốc rời)"),
    ("C09_khoang_trong_su_nghiep", "cô từng làm chuyên viên nhân sự tại công ty tnhh may mặc"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "trước đó, cô làm nhân viên nhân sự tại công ty cp cơ khí hải phòng"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "trình độ học vấn là cử nhân quản trị nhân lực"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "kỹ năng nổi bật bao gồm excel"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "hà có bằng cử nhân quản trị nhân lực"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "tuy nhiên, cô đã nghỉ việc từ 08/2020"): ("DUNG", "Nhắc khoảng nghỉ đúng như CV — được phép"),
    ("C09_khoang_trong_su_nghiep", "ứng viên phù hợp với vị trí chuyên viên nhân sự"): ("SAORONG", ""),
    ("C09_khoang_trong_su_nghiep", "đang tìm kiế"): ("SUYDIEN", "Neo: nghỉ chăm con 08/2020–08/2022. Nhưng cô đã đi làm lại từ 09/2022, và 'chăm con nhỏ' bị đổi thành 'nghỉ sinh con' — đúng bẫy suy diễn của C09. Lặp 11 lần"),
    ("C09_khoang_trong_su_nghiep", "ứng viên từng làm việc tại công ty tnhh may mặc"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "trước đó, ứng viên làm tại công ty cp cơ khí"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "ứng viên tốt nghiệp cử nhân quản trị nhân lực"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "cô có kinh nghiệm tính lương"): ("DUNG", ""),
    ("C09_khoang_trong_su_nghiep", "hà tốt nghiệp cử nhân quản trị nhân lực"): ("DUNG", ""),

    # ---------------- C10 — liệt kê công nghệ ----------------
    ("C10_liet_ke_cong_nghe", "đinh văn tùng là một ứng viên có kinh nghiệm 2 năm"): ("SAISO", "Tự tính; CV 06/2022 – nay"),
    ("C10_liet_ke_cong_nghe", "anh có kiến thức về c#, asp.net core, sql server và am hiểu"): ("SUYDIEN", PV + "CV chỉ LIỆT KÊ Docker/Kubernetes/Jenkins…, phần kinh nghiệm không nói làm gì với chúng; 'am hiểu' là nâng dòng liệt kê lên"),
    ("C10_liet_ke_cong_nghe", "ngoài ra, anh còn có kỹ năng với các công nghệ khác"): ("DUNG", "Chỉ nhắc lại danh sách kỹ năng của CV"),
    ("C10_liet_ke_cong_nghe", "anh tốt nghiệp kỹ sư công nghệ thông tin từ đại học công nghiệp hà nội năm 2022 và đang tìm kiếm"): ("SUYDIEN", "Tốt nghiệp đúng; 'đang tìm cơ hội backend .NET' suy từ việc nộp đơn — CV không có mục tiêu, và anh đang đi làm"),
    ("C10_liet_ke_cong_nghe", "đánh giá chung, cv này phù hợp"): ("SAORONG", "Phán xét, lại sai: JD đòi 3 năm C#, CV không mô tả dự án C# nào"),
    ("C10_liet_ke_cong_nghe", "cv ứng viên đinh văn tùng ứng tuyển"): ("DUNG", PV + "đúng nhưng không mang thông tin"),
    ("C10_liet_ke_cong_nghe", "ứng viên có kinh nghiệm làm việc tại công ty tnhh gia công phần mềm"): ("DUNG", ""),
    ("C10_liet_ke_cong_nghe", "ứng viên có bằng kỹ sư công nghệ thông tin"): ("DUNG", ""),
    ("C10_liet_ke_cong_nghe", "kỹ năng công nghệ bao gồm"): ("DUNG", "Chép nguyên danh sách, không biến thành 'đã triển khai' — đúng"),
    ("C10_liet_ke_cong_nghe", "đinh văn tùng là một lập trình viên phần mềm với bằng kỹ sư"): ("DUNG", ""),
    ("C10_liet_ke_cong_nghe", "anh hiện đang làm việc tại công ty tnhh gia công"): ("DUNG", ""),
    ("C10_liet_ke_cong_nghe", "anh có kinh nghiệm với c#, asp.net core, sql server, docker, kubernetes"): ("SUYDIEN", "Đúng bẫy C10: Docker/Kubernetes/CI chỉ nằm trong danh sách tự liệt kê, CV không nói đã làm gì với chúng"),
    ("C10_liet_ke_cong_nghe", "mạnh nhất là khả năng triển khai và quản lý hệ thống"): ("SUYDIEN", "Phần kinh nghiệm chỉ có 'viết code theo đặc tả, sửa lỗi theo phiếu'; 'triển khai & quản lý hệ thống' suy từ danh sách công cụ DevOps"),
}


# ===========================================================================
#  MỐC BỎ SÓT — (bậc, mã CV) -> (số mốc bị bỏ sót, sót cái gì)
#
#  Đối chiếu với 'moc_phai_co' trong dataset.json. Diễn đạt khác cùng ý vẫn tính
#  là có nhắc; MỐC THỜI GIAN phải là mốc của chính kinh nghiệm đó (năm tốt nghiệp
#  trùng số không tính thay). Script 1 ghi đè phiếu trống nên bảng này nằm ở đây.
# ===========================================================================
BO_SOT: dict[tuple[str, str], tuple[int, str]] = {
    ("v1", "C01_khong_ghi_so_nam"): (1, "Mất 'ĐH Bách khoa Hà Nội'"),
    ("v1", "C02_ketoan_khop"): (0, ""),
    ("v1", "C03_fresher_mong"): (1, "Mất 'Cao đẳng FPT'"),
    ("v1", "C04_trai_nganh"): (0, ""),
    ("v1", "C05_nhay_viec_nhieu_moc"): (1, "Chỉ kể 2/5 nơi làm — mất ý 'nhiều nơi làm việc'"),
    ("v1", "C06_text_pdf_lon_xon"): (2, "Mất 'kỹ sư cơ khí', 'Cao đẳng Cao Thắng'"),
    ("v1", "C07_song_ngu"): (2, "Mất mốc 2020, 'ĐH Ngoại thương'"),
    ("v1", "C08_thanh_tich_nhieu_so"): (2, "Mất 'đội 12 người', mốc 2021"),
    ("v1", "C09_khoang_trong_su_nghiep"): (2, "Mất khoảng nghỉ 2 năm, 'ĐH Lao động Xã hội'"),
    ("v1", "C10_liet_ke_cong_nghe"): (1, "Mất mốc 2022"),

    ("v2", "C01_khong_ghi_so_nam"): (0, ""),
    ("v2", "C02_ketoan_khop"): (0, ""),
    ("v2", "C03_fresher_mong"): (1, "Mất 'Cao đẳng FPT'"),
    ("v2", "C04_trai_nganh"): (0, ""),
    ("v2", "C05_nhay_viec_nhieu_moc"): (1, "Chỉ kể 2/5 nơi làm — mất ý 'nhiều nơi làm việc'"),
    ("v2", "C06_text_pdf_lon_xon"): (2, "Mất 'kỹ sư cơ khí', tên trường Cao Thắng"),
    ("v2", "C07_song_ngu"): (2, "Mất mốc 2020, 'ĐH Ngoại thương'"),
    ("v2", "C08_thanh_tich_nhieu_so"): (1, "Mất mốc 2021 (thay bằng '3 năm kinh nghiệm' tự tính)"),
    ("v2", "C09_khoang_trong_su_nghiep"): (1, "Mất 'ĐH Lao động Xã hội'"),
    ("v2", "C10_liet_ke_cong_nghe"): (1, PV + "mốc 2022 chỉ xuất hiện ở năm tốt nghiệp, không phải mốc bắt đầu đi làm"),

    ("v3", "C01_khong_ghi_so_nam"): (1, "Mất mốc 2019 (thay bằng '4 năm' tự cộng)"),
    ("v3", "C02_ketoan_khop"): (0, ""),
    ("v3", "C03_fresher_mong"): (0, ""),
    ("v3", "C04_trai_nganh"): (1, "Mất 'bất động sản' (không nêu tên công ty/lĩnh vực)"),
    ("v3", "C05_nhay_viec_nhieu_moc"): (0, ""),
    ("v3", "C06_text_pdf_lon_xon"): (1, "Mất 'kỹ sư cơ khí' (gọi là kỹ thuật viên)"),
    ("v3", "C07_song_ngu"): (1, PV + "mốc 2020 chỉ xuất hiện ở năm tốt nghiệp, không phải mốc bắt đầu đi làm"),
    ("v3", "C08_thanh_tich_nhieu_so"): (1, PV + "mốc 2021 chỉ hiện trong '(2017–2021)' của công ty cũ, không nói lên trưởng nhóm từ 2021"),
    ("v3", "C09_khoang_trong_su_nghiep"): (1, "Mất khoảng nghỉ 2 năm"),
    ("v3", "C10_liet_ke_cong_nghe"): (0, ""),

    ("v4", "C01_khong_ghi_so_nam"): (0, ""),
    ("v4", "C02_ketoan_khop"): (0, ""),
    ("v4", "C03_fresher_mong"): (1, "Mất 'Cao đẳng FPT'"),
    ("v4", "C04_trai_nganh"): (1, "Mất 'bất động sản'"),
    ("v4", "C05_nhay_viec_nhieu_moc"): (2, "Không nêu nơi làm hiện tại (VietTravel); gộp thành 'tổng đài và tư vấn' — mất ý nhiều nơi làm"),
    ("v4", "C06_text_pdf_lon_xon"): (0, ""),
    ("v4", "C07_song_ngu"): (1, "Mất 'ĐH Ngoại thương'"),
    ("v4", "C08_thanh_tich_nhieu_so"): (0, ""),
    ("v4", "C09_khoang_trong_su_nghiep"): (3, "Mất cả giai đoạn 2016–2020, khoảng nghỉ 2 năm, 'ĐH Lao động Xã hội'"),
    ("v4", "C10_liet_ke_cong_nghe"): (0, ""),
}


def _tra(id_tin: str, cau: str) -> tuple[str, str]:
    """Khớp theo tiền tố. Nhiều khoá cùng khớp -> báo để người chấm kéo dài khoá."""
    hit = [(k, v) for k, v in NHAN.items() if k[0] == id_tin and cau.startswith(k[1])]
    if not hit:
        return "", ""
    if len(hit) > 1:
        print(f"  ⚠ {id_tin}: {len(hit)} khoá cùng khớp câu «{cau[:50]}…» — kéo dài khoá cho phân biệt")
    return hit[0][1]


def main() -> int:
    la = {n for n, _ in NHAN.values()} - HOP_LE
    if la:
        raise SystemExit(f"Nhãn không hợp lệ trong bảng NHAN: {sorted(la)} — xem LUAT_NGUOI_CHAM.md")

    tong_cau = tong_trong = 0
    for ver in VERS:
        p = OUT / ver / "nguoi_cham_tung_cau.csv"
        if not p.exists():
            print(f"[{ver}] chưa có phiếu chấm — chạy 1_chay_model_va_may_cham.py trước")
            continue

        with p.open(encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))

        trong = 0
        for r in rows:
            nhan, ghi_chu = _tra(r["id_tin"], r["cau"])
            r["nhan"], r["ghi_chu"] = nhan, ghi_chu
            if not nhan:
                trong += 1

        with p.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=["id_tin", "stt_cau", "cau", "nhan", "ghi_chu"])
            w.writeheader()
            w.writerows(rows)

        tong_cau += len(rows)
        tong_trong += trong
        print(f"[{ver}] {len(rows) - trong}/{len(rows)} câu đã có nhãn")

        ps = OUT / ver / "nguoi_cham_bo_sot.csv"
        if ps.exists():
            with ps.open(encoding="utf-8-sig") as f:
                sot = list(csv.DictReader(f))
            for r in sot:
                n, gc = BO_SOT.get((ver, r["id_tin"]), ("", ""))
                r["so_moc_bi_bo_sot"], r["ghi_chu"] = n, gc
            with ps.open("w", newline="", encoding="utf-8-sig") as f:
                w = csv.DictWriter(f, fieldnames=["id_tin", "so_moc_phai_co", "so_moc_bi_bo_sot", "ghi_chu"])
                w.writeheader()
                w.writerows(sot)

    print(f"\nTổng: {tong_cau - tong_trong}/{tong_cau} câu đã gán nhãn.")
    if tong_trong:
        print(f"Còn {tong_trong} câu chưa gán — thêm dòng vào bảng NHAN trong chính file này.")
        print("Nhớ: nhãn phải do NGƯỜI gán, không nhờ mô hình chấm hộ (lý do ở đầu file).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
