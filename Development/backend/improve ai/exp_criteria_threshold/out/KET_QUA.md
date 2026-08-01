# Đo ngưỡng khớp tiêu chí SOFT

**Câu hỏi:** `CriteriaMatchThreshold` nên để bao nhiêu?
(`appsettings.json` đang để **0.5**, mặc định trong code là **0.6** — cả hai đều là số áng chừng.)

**Cách đo:** 72 cặp `(tiêu chí SOFT, đoạn CV)` có nhãn người gán — 36 đúng / 36 sai.
Embedding bằng đúng model đang chạy thật (`BAAI/bge-m3` qua AI service `/embed`),
similarity = cosine, khớp với production (`similarity = 1 - VECTOR_DISTANCE('cosine', …)`).

---

## Kết quả 1 — không có ngưỡng nào dùng được

Phân bố similarity của hai nhóm **chồng lên nhau gần như hoàn toàn**:

| Nhóm | min | trung bình | max |
|---|---|---|---|
| Cặp ĐÚNG (label=1) | 0.497 | **0.568** | 0.647 |
| Cặp SAI (label=0) | 0.450 | **0.560** | 0.688 |

Trung bình chỉ chênh **0.008**, và cặp SAI có điểm cao nhất (0.688) còn **cao hơn** cặp ĐÚNG cao nhất (0.647).

Quét ngưỡng 0.30 → 0.90:

| Ngưỡng | Precision | Recall | F1 | Accuracy |
|---|---|---|---|---|
| 0.50 (đang chạy thật) | 0.515 | 0.944 | 0.667 | **0.528** |
| 0.52 (F1 cao nhất) | 0.567 | 0.944 | **0.708** | **0.611** |
| 0.60 (mặc định code) | 0.385 | 0.139 | 0.204 | **0.458** |

Bộ dữ liệu cân bằng 50/50, nên **đoán bừa cũng được accuracy 0.5**. Ngưỡng tốt nhất đạt 0.611 —
hơn đoán bừa đúng 11 điểm phần trăm. Ngưỡng 0.6 đang để mặc định trong code còn **tệ hơn đoán bừa**.

**Kết luận: vấn đề không nằm ở chỗ chọn sai số. Cosine similarity giữa câu tiêu chí và đoạn CV
không mang đủ thông tin để phán "đạt / không đạt", nên không con số nào cứu được.**

Lý do hợp lý: `bge-m3` là model **truy hồi** — nó đo *cùng chủ đề hay không*, chứ không đo
*có chứng minh được hay không*. "Học chuyên ngành kế toán" và "3 năm làm kế toán tổng hợp"
cùng chủ đề y hệt; thứ phân biệt chúng là **mức độ từng làm**, mà embedding không mã hóa.

---

## Kết quả 2 — đối chứng: để LLM phán

Chạy đúng 72 cặp đó qua Local LLM (`qwen2.5`, chính model đang dùng để bóc tiêu chí):

| | Precision | Recall | F1 | Accuracy |
|---|---|---|---|---|
| Vector + ngưỡng tốt nhất (0.52) | 0.567 | 0.944 | 0.708 | 0.611 |
| **LLM phán** | **1.000** | 0.944 | **0.971** | **0.972** |

TP/FP/FN/TN = 34/0/2/36 — **không có cặp sai nào bị nhận nhầm thành đạt**.

---

## Đề xuất

1. **Đừng dùng similarity làm phán quyết.** Giữ vector cho đúng việc nó giỏi: **tìm đoạn CV
   liên quan nhất** để hiện làm bằng chứng (code hiện đã làm vậy — `Evidence` = đoạn gần nhất).
2. **Thêm bước LLM kiểm chứng**: đưa tiêu chí + đoạn CV vừa truy hồi cho LLM phán đạt/không.
   Vẫn đúng nguyên tắc "AI không quyết" — kết quả chỉ là gợi ý, người sàng lọc chốt.
3. **Trước mắt**, nếu chưa kịp làm bước 2: để `0.52` thay vì `0.5`, và **không trình bày con số
   similarity như một phán quyết** trong giao diện — nên gọi là "độ liên quan" của đoạn CV.

---

## Hạn chế phải nói rõ

- Dữ liệu **do người viết đề tài soạn** theo văn phong CV tiếng Việt thường gặp, **không phải
  CV thật**, và **chỉ một người gán nhãn** (không đo được độ đồng thuận giữa nhiều người chấm).
- Con số của LLM có thể **lạc quan hơn thực tế**: prompt chấm có mô tả đúng tiêu chí phân biệt
  mà người soạn dùng khi gán nhãn ("đã thực sự làm" vs "mới học / mới hỗ trợ / mới có nguyện vọng").
  Trên CV thật, ranh giới mờ hơn nhiều.
- Ngược lại, **kết luận về vector thì không phụ thuộc prompt**: hai phân bố chồng nhau là tính
  chất của embedding, đo lại kiểu gì cũng vậy.

## Chạy lại

```bash
cd "improve ai/exp_criteria_threshold"
python run.py             # cần AI service ở 127.0.0.1:8000
python run_llm_judge.py   # cần Ollama + qwen2.5
```

Số liệu thô: `out/pair_similarity.csv`, `out/threshold_sweep.csv`, `out/llm_judge.csv`.
