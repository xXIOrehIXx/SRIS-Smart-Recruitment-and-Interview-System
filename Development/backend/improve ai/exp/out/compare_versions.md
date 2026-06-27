# So sánh version pipeline gen quiz (Section 16)

Model: qwen2.5 · 12 JD test · 10 câu/JD mục tiêu · temperature 0.
Quy tắc 16.4: mỗi version đổi ĐÚNG 1 yếu tố so với version trước.

| Version | Yếu tố thêm so với version trước |
|---|---|
| v1_baseline | — (1 phát: JD → N câu). MỐC GỐC. |
| v2_skill_extraction | Trích skill từ JD → gen theo từng skill |
| v3_fewshot | + 1–2 câu mẫu (few-shot) trong prompt gen |
| v4_situational | + chỉ thị tường minh ép câu tình huống + ràng buộc distractor |
| v5_self_critique | + lượt AI tự soát rồi sửa/loại sau khi gen |

## Tầng đo tự động (16.2)

| Chỉ số | v1 | v2 | v3 | v4 | v5 |
|---|---|---|---|---|---|
| Tổng câu gen | 120 | 111 | 111 | 119 | 111 |
| JSON hợp lệ (%) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| Đúng cấu trúc (%) | 100.0 | 99.1 | 99.1 | 99.2 | **100.0** |
| Không trùng (%) | 97.5 | 100.0 | 100.0 | 97.5 | **100.0** |
| Tình huống — heuristic (%) | 11.7 | 27.9 | 43.2 | 50.4 | **60.4** |
| Tốc độ (≈ s/JD) | 9 | 16 | 16 | 23 | 45 |

> Tình huống (auto, tổng hợp) tăng đơn điệu qua cả 5 version: **11.7 → 27.9 → 43.2
> → 50.4 → 60.4**. v5 đồng thời đưa cấu trúc + không-trùng về 100% (lượt tự soát dọn
> các câu lỗi/đáp án lộ) — đổi lại chi phí ~45 s/JD (gấp đôi v4 vì 2 lượt LLM/skill).

> JSON/cấu trúc kịch trần ở mọi version vì ép JSON schema (hạ tầng), KHÔNG phải chất
> lượng prompt → không dùng để so version. Trục phân biệt = tình huống (auto, nhiễu)
> + **pass-rate rubric (người chấm — trục quyết định)**.

## Tình huống theo từng JD (%) — heuristic

| JD | v1 | v2 | v3 | v4 | v5 |
|---|---|---|---|---|---|
| dev_dotnet_junior | 0 | 20 | 30 | 20 | 40 |
| dev_dotnet_senior | 50 | 10 | 50 | 30 | 40 |
| frontend_react_mid | 0 | 20 | 20 | 20 | 60 |
| data_engineer_senior | 20 | 0 | 50 | 40 | 40 |
| ketoan_tonghop_mid | 0 | 10 | 20 | 27 | 40 |
| sales_b2b_junior | 10 | 44 | 44 | 67 | 88 |
| digital_marketing_mid | 10 | 0 | 60 | 20 | 10 |
| hr_tuyendung_junior | 10 | 40 | 30 | 80 | 89 |
| cskh_junior | 40 | 90 | 80 | 90 | 88 |
| project_manager_senior | 0 | 10 | 30 | 60 | 80 |
| edge_jd_rac | 0 (10q) | 67 (3q) | 67 (3q) | 90 (**10q**) | 86 (7q) |
| edge_jd_thieu_kythuat | 0 | 56 | 56 | 67 | 89 |

## Kết luận định tính

1. **v2** (trích skill): hết câu "hỏi lại nội dung JD"; xử lý JD rác đúng
   (edge_jd_rac 10 → 3 câu, không bịa).
2. **v3** (few-shot): chữa các JD kỹ thuật v2 bị tụt (data_engineer 0→50,
   marketing 0→60, dev_senior 10→50) — học phong cách qua ví dụ.
3. **v4** (ép tình huống): tổng hợp tình huống tăng tiếp (50.4%); JD nghiệp vụ nhảy
   mạnh (hr 30→80, pm 30→60). **Tác dụng phụ:** edge_jd_rac bật lại 10 câu — sức ép
   "phải ra tình huống" đẩy model bịa bối cảnh trên JD rỗng chuyên môn.
4. **v5** (tự soát): cao nhất mọi mặt auto (tình huống 60.4%, cấu trúc/không-trùng
   100%). Lượt soát **chữa tác dụng phụ của v4**: edge_jd_rac 10 → 7 câu (loại bớt
   câu bịa), nhiều JD có sàn tình huống cao hơn hẳn. Là bản "after" để chấm rubric.
5. Heuristic vẫn nhiễu ở mức JD lẻ (marketing tụt 60→10 ở v5) → KHÔNG kết luận chỉ
   bằng auto; rubric người chấm mới quyết.
6. Chi phí tăng dần (~9 → 16 → 16 → 23 → 45 s/JD) — đánh đổi chất lượng/tốc độ, ghi
   vào Cost Analysis. Lựa chọn triển khai thực tế có thể là v4 (rẻ hơn) hoặc v5 (chất
   nhất) tùy yêu cầu.

## Việc cần làm tiếp (người chấm)
- Chấm rubric **ĐẦY ĐỦ v1 + v5** (cặp before/after, ~111–120 câu mỗi cái) → bằng
  chứng chính cho hội đồng.
- Chấm rubric **MẪU v2/v3/v4** trên 3 JD cố định: dev_dotnet_junior,
  ketoan_tonghop_mid, edge_jd_rac.
- Điền sheet `Cham_diem` (file `quiz_eval_rubric.xlsx`) → sheet `Tong_hop_version`
  tự ra pass-rate (ngưỡng Đạt: Điểm TB ≥ 4).
- File `grading.csv` trong mỗi `out/<version>/` đã có sẵn cột đúng thứ tự sheet
  Cham_diem (5 cột rubric để trống) — copy thẳng vào Excel để chấm.
