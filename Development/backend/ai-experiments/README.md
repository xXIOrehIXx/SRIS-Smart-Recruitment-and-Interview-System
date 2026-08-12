# Thí nghiệm đánh giá AI

**Đây KHÔNG phải code chạy trong sản phẩm.** Không có gì ở đây được `GP35.SRIS.sln`
tham chiếu tới — xoá đi thì hệ thống vẫn build và chạy bình thường.

Folder này giữ **bằng chứng cho phương pháp đánh giá AI** (khung Section 16 trong
`docs/00_CONTEXT.md`): bộ test cố định, mỗi lần chỉ đổi một yếu tố, đo hai tầng
(máy chấm + rubric người). `docs/00_CONTEXT.md:346` trích thẳng số từ đây khi trả lời
câu hỏi *"Có phương pháp đánh giá AI không?"*, nên **xoá folder là câu đó mất chỗ dựa**.

## Ba thí nghiệm

### 0. `exp_criteria_extract/` — AI đề xuất tiêu chí (**tính năng ĐANG CHẠY**)

Đây là bộ **quan trọng nhất**, và cũng là bộ ra đời muộn nhất: hai thí nghiệm bên
dưới đo kỹ hai tính năng đã bị CẮT khỏi phạm vi, còn thứ duy nhất còn chạy thật
trong sản phẩm thì mãi chưa có số nào. Bộ này lấp đúng chỗ trống đó.

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

`--tag` cho phép chạy nhiều phiên bản prompt rồi so: `python run.py --tag truoc_v038`.

```bash
cd ai-experiments/exp_criteria_extract
python run.py --repeat 3      # cần AI service ở 127.0.0.1:8000
# điền nhãn vào out/baseline/labels.csv + missing.csv theo RUBRIC.md
python score_rubric.py
```

## Hai thí nghiệm cũ (tính năng đã cắt)

### 1. `exp/` — sinh câu hỏi phỏng vấn bằng LLM (5 phiên bản prompt)

Đo pipeline sinh câu hỏi qua 5 lần cải tiến prompt: v1 baseline → v2 trích kỹ năng →
v3 few-shot → v4 tình huống → v5 tự phản biện. Điểm máy đo tăng đều **11.7% → 60.4%**.

> **Tính năng quiz đã bị loại khỏi phạm vi đề tài (07/2026).** Giữ lại thí nghiệm này
> **không phải** để làm quiz, mà vì nó là bằng chứng nhóm biết đánh giá AI có kỷ luật —
> đối tượng đo tình cờ là quiz. Đừng đọc folder này rồi tưởng quiz còn trong scope.

- Kết quả: `exp/out/compare_versions.md`, `exp/out/v*/auto_metrics.csv`
- Rubric người chấm: `files/quiz_eval_rubric.xlsx`
- Mô tả 5 phiên bản: `NOTE_quiz_gen_5_versions.md`

### 2. `exp_criteria_threshold/` — chọn ngưỡng khớp tiêu chí SOFT

Chính là **Việc B4b** trong `docs/00_CONTEXT.md:427`. Trả lời câu: `CriteriaMatchThreshold`
nên để bao nhiêu?

Kết quả ngắn gọn: **không ngưỡng nào dùng được.** Cosine similarity giữa câu tiêu chí và
đoạn CV không tách được cặp đúng khỏi cặp sai (hai phân bố chồng lên nhau). Đối chứng bằng
Local LLM thì đạt accuracy 0.972.

- Kết quả đầy đủ + hạn chế: `exp_criteria_threshold/out/KET_QUA.md`

## Chạy lại

```bash
cd ai-experiments/exp_criteria_threshold
python run.py             # cần AI service ở 127.0.0.1:8000
python run_llm_judge.py   # cần Ollama + qwen2.5
```

`exp/` (quiz) cần Ollama; xem `exp/run.py`.
