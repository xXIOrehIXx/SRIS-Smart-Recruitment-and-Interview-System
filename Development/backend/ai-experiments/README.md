# Thí nghiệm đánh giá AI

**Đây KHÔNG phải code chạy trong sản phẩm.** Không có gì ở đây được `GP35.SRIS.sln`
tham chiếu tới — xoá đi thì hệ thống vẫn build và chạy bình thường.

Folder này giữ **bằng chứng cho phương pháp đánh giá AI** (khung Section 16 trong
`docs/00_CONTEXT.md`): bộ test cố định, mỗi lần chỉ đổi một yếu tố, đo hai tầng
(máy chấm + rubric người). `docs/00_CONTEXT.md` trích thẳng số từ đây khi trả lời
câu hỏi *"Có phương pháp đánh giá AI không?"*, nên **xoá folder là câu đó mất chỗ dựa**.

Hai thí nghiệm, và chúng trả lời hai câu khác nhau:

| | Câu hỏi | Kết luận |
|---|---|---|
| `exp_criteria_extract/` | Tính năng **đang chạy** làm tốt đến đâu? | Precision 0.841 · Recall 0.914 · F1 0.876 |
| `exp_criteria_threshold/` | Có nên làm máy chấm CV không? | **Không** — và tính năng đã bị cắt vì số này |

---

## 1. `exp_criteria_extract/` — AI đề xuất tiêu chí (**tính năng ĐANG CHẠY**)

Bộ **quan trọng nhất**: nó đo đúng thứ duy nhất còn chạy thật trong sản phẩm.

Đo hai tầng:

- **Tầng 1 — máy đo** (`run.py` + `metrics.py`): tỉ lệ tiêu chí là "giấy tờ" (thứ
  đọc hồ sơ là biết, không đáng cho điểm phỏng vấn), tỉ lệ dòng gộp nhiều kỹ năng,
  trùng lặp, vượt trần, độ ổn định khi chạy lại, thời gian chạy. Không cần người.
- **Tầng 2 — người chấm** (`RUBRIC.md` + `score_rubric.py`): gán nhãn từng tiêu chí
  theo 6 mã, cộng phần đếm tiêu chí AI **bỏ sót** → precision / recall / F1 kèm bảng
  phân rã sai kiểu gì. **Đây mới là số để trích vào báo cáo.**

Bộ test: 10 tin tuyển dụng nhiều ngành (kế toán, kinh doanh, kho vận, CNTT, hành
chính, khách sạn, marketing, vận tải, sản xuất), trong đó 3 ca cố tình khó — tin
chỉ có đầu việc (phải trả rỗng), tin toàn yêu cầu giấy tờ, tin 13 yêu cầu vượt trần 10.

### Kết quả (đo 12–13/08/2026, đầy đủ ở `out/KET_QUA.md`)

- **Tầng 1:** so 3 phiên bản prompt → **giữ baseline**. Hai lần sửa prompt đều không
  cải thiện, v2 còn làm hỏng thêm. Ổn định tuyệt đối (Jaccard 1.000), 0/20 lượt hỏng.
- **Tầng 2:** **Precision 0.841 · Recall 0.914 · F1 0.876** trên 63 tiêu chí / 10 tin.
  **`BIA` = 0** — không dòng nào AI tự bịa, mọi tiêu chí truy được về câu chữ trong tin.
- Ba chỗ mất điểm đều có địa chỉ cụ thể, không phải nhiễu — xem `out/KET_QUA.md`.

`--tag` cho phép chạy nhiều phiên bản prompt rồi so: `python run.py --tag truoc_v038`.

```bash
cd ai-experiments/exp_criteria_extract
python run.py --repeat 3      # cần AI service ở 127.0.0.1:8000
# điền nhãn vào out/<tag>/labels.csv + missing.csv theo RUBRIC.md
python score_rubric.py --tag <tag>
```

---

## 2. `exp_criteria_threshold/` — chọn ngưỡng khớp tiêu chí SOFT

Chính là **Việc B4b** trong `docs/00_CONTEXT.md`. Trả lời câu: `CriteriaMatchThreshold`
nên để bao nhiêu?

Kết quả ngắn gọn: **không ngưỡng nào dùng được.** Cosine similarity giữa câu tiêu chí và
đoạn CV không tách được cặp đúng khỏi cặp sai (hai phân bố chồng lên nhau). Đối chứng bằng
Local LLM thì đạt accuracy 0.972.

Đây là thí nghiệm **bác bỏ chính tính năng nó đo** — máy chấm CV đã bị cắt khỏi phạm vi
(08/08/2026) dựa trên số này.

- Kết quả đầy đủ + hạn chế: `exp_criteria_threshold/out/KET_QUA.md`

```bash
cd ai-experiments/exp_criteria_threshold
python run.py             # cần AI service ở 127.0.0.1:8000
python run_llm_judge.py   # cần Ollama + qwen2.5
```

---

## Ghi chú

`AI_TESTING_REFERENCE.md` là tài liệu **tham khảo cách trình bày** bóc từ slide của một
nhóm capstone khác — không phải thiết kế của SRIS. Khung ngưỡng Tốt / Chấp nhận được /
Cần cải thiện trong `exp_criteria_extract/RUBRIC.md` lấy từ đó.

> **Đã xoá (13/08/2026):** thí nghiệm sinh câu hỏi phỏng vấn bằng LLM (`exp/`, 5 phiên bản
> prompt) cùng bộ `files/`. Tính năng quiz bị loại khỏi phạm vi từ 07/2026; thí nghiệm đó
> từng được giữ làm bằng chứng "nhóm biết đánh giá AI có kỷ luật", nhưng
> `exp_criteria_extract` giờ đã chứng minh đúng điều đó trên tính năng **thật sự đang chạy**
> nên nó thành thừa. Cần lại thì lấy từ git history.
