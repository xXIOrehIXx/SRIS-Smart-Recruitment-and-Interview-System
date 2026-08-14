# AI Testing — Tài liệu tham khảo (bóc từ slide nhóm khác)

> **Nguồn:** 5 slide "AI Testing" của một nhóm capstone FPT khác — hệ thống **SmartHR** (HRM: Attendance / Payroll / Leave / Security), dùng **Gemini 2.5 Flash** qua API.
> **Mục đích file này:** làm mẫu tham khảo về *cách trình bày* phần đánh giá AI trong report/slide. **KHÔNG phải** thiết kế của SRIS.
> **Khác biệt cần nhớ khi áp cho SRIS:** SRIS chạy **Local AI (Ollama + qwen2.5)**, không dùng OpenAI/Gemini; bài toán của SRIS là **bóc tiêu chí từ JD**, không phải trợ lý hỏi–đáp sinh SQL.

---

## 1. Slide 1 — AI Testing: So sánh model

| Model | Characteristics | Suitability for SmartHR |
|---|---|---|
| ChatGPT 4.5 | High quality and reasoning; high API & operational costs. | Good quality, but not cost-effective. |
| Claude | Excellent understanding and context size; higher latency. | Powerful, but less practical for a lightweight bot. |
| Gemini 2.5 Flash | Optimal balance of speed, cost, and structured output. | **Highly recommended**; best fit for speed, cost, and reasoning. |

**Ghi chú:** slide này là bảng *lý do chọn model*. Bảng tương đương của SRIS phải so các model **local** (qwen2.5 / gemma3:4b / llama…) theo tiêu chí RAM, tốc độ, khả năng ra JSON đúng schema, chất lượng tiếng Việt — và nêu rõ ràng buộc "không dùng API ngoài" là yêu cầu bắt buộc chứ không phải lựa chọn kỹ thuật.

---

## 2. Slide 2 — Định nghĩa TP/TN/FP/FN và công thức chỉ số

### 2.1 Bảng định nghĩa chỉ báo

| Indicator | Meaning | Pass (Requirement Met) | Fail (Requirement Not Met) |
|---|---|---|---|
| **TP** | Correct positive | AI correctly answers a valid request. | AI returns wrong data or incorrectly denies valid requests. |
| **TN** | Correct negative | AI correctly blocks unauthorized access or asks for clarification. | AI fails security boundaries or processes ambiguous queries. |
| **FP** | False positive | AI processes a request that should have been blocked or clarified. | AI correctly blocks access or asks for clarification. |
| **FN** | False negative | AI refuses or gives empty response to a valid request. | AI correctly answers valid requests or blocks invalid ones. |

> ⚠️ Bảng gốc trên slide đặt cột Pass/Fail hơi lộn xộn (FP/FN mô tả ngược nghĩa thông thường). Nếu tái sử dụng, cần viết lại cho chuẩn định nghĩa confusion matrix.

### 2.2 Bảng công thức + ngưỡng đánh giá

| Metric | Formula | Meaning | Evaluation Criteria |
|---|---|---|---|
| **Precision** | TP / (TP + FP) | Reliability of positive answers. | ≥ 0.85: Good · 0.70–0.84: Acceptable · < 0.70: Needs Improvement |
| **Recall (TPR)** | TP / (TP + FN) | Ability to avoid missing valid requests. | ≥ 0.85: Good · 0.70–0.84: Acceptable · < 0.70: Needs Improvement |
| **Accuracy** | (TP + TN) / (TP + TN + FP + FN) | Overall correctness rate. | ≥ 0.90: Good · 0.80–0.89: Acceptable · < 0.75: Needs Improvement |
| **FPR (False Positive Rate)** | FP / (FP + TN) | Rate of security leaks / wrong execution. | ≤ 0.05: Good · 0.05–0.15: Acceptable · > 0.15: Needs Improvement |

**Điểm đáng học:** họ **công bố ngưỡng trước khi đo**, chia 3 mức Good / Acceptable / Needs Improvement. Nhờ vậy con số cuối cùng có chỗ để "so", không phải số trần trụi.

---

## 3. Slide 3 — Khung kiểm thử AI (AI Testing Framework)

**Quy mô:** 221 HRM Test Cases, chia 4 nhóm:

| Nhóm test case | Nội dung |
|---|---|
| Attendance | Chấm công |
| Payroll | Lương |
| Leave | Nghỉ phép |
| Security | Kiểm soát truy cập / phân quyền |

**Luồng 5 bước:**

```
Test Dataset → AI Assistant → Response Evaluation → Security Validation → Final Metrics
```

| Bước | Việc làm |
|---|---|
| 1. Test Dataset | Bộ câu hỏi test cố định, có nhãn kỳ vọng |
| 2. AI Assistant | Chạy qua hệ thống AI đang có |
| 3. Response Evaluation | Đối chiếu câu trả lời với kỳ vọng |
| 4. Security Validation | Kiểm xem AI có rò dữ liệu / vượt quyền không |
| 5. Final Metrics | Tổng hợp Precision / Recall / Accuracy / FPR |

---

## 4. Slide 4 — Prompt Engineering Evolution (V1 → V5)

| Version | Tên | Nội dung thay đổi |
|---|---|---|
| V1 | Baseline | Initial prompt without rules |
| V2 | HR Rules | Added domain knowledge base |
| V3 | SQL Control | Structured query generation |
| V4 | Permission | Role-based access control layer |
| V5 | Final | Production-ready optimized version |

**Optimization Strategy (khối bên phải slide):**

- Prompt Engineering
- Gemini 2.5 Flash
- Dynamic Schema Injection
- Backend Guardrails
- Read-only SQL
- Permission Validation

**Điểm đáng học:** mỗi version chỉ thêm **một** lớp cải tiến → nhìn vào biểu đồ biết cải tiến nào đem lại bao nhiêu điểm. Đây đúng nguyên tắc prompt versioning trong §16.1 của SRIS.

---

## 5. Slide 5 — Final AI Evaluation Results

**Chỉ số cuối (V5):**

| Metric | Value |
|---|---|
| Overall Accuracy | **80.54%** |
| Precision | **90.68%** |
| Recall | **83.91%** |
| F1 Score | **87.16%** |

**Đường tiến hóa accuracy qua 5 version** (đọc từ biểu đồ đường, số xấp xỉ):

| Version | Accuracy (≈) |
|---|---|
| V1 | 50% |
| V2 | 61% |
| V3 | 64% |
| V4 | 71% |
| V5 | 81% |

**Kết luận trên slide:** *V5 Selected for Production | Accuracy ↑ Security ↑ User Experience ↑*

---

## 6. Đối chiếu nhanh với SRIS (phần này là ghi chú của tôi, không có trên slide)

| Hạng mục | Nhóm SmartHR | SRIS |
|---|---|---|
| Bài toán AI | Trợ lý hỏi–đáp HRM, sinh SQL read-only | Bóc tiêu chí đánh giá từ JD (LLM ra JSON có schema) |
| Model | Gemini 2.5 Flash (API ngoài) | Ollama + qwen2.5 chạy local (bắt buộc, ràng buộc PDPL) |
| Bộ test | 221 test case, 4 nhóm nghiệp vụ | 10 JD cố định đa ngành, mỗi tin chạy 2 lượt (§16.2) |
| Chỉ số | Precision / Recall / Accuracy / F1 / FPR | Tầng máy: % JSON hợp lệ lần đầu, % tiêu chí truy được về JD gốc, tỷ lệ trùng nghĩa. Tầng người: rubric 6 mã → precision / recall / F1 |
| Prompt versioning | V1→V5, mỗi bước thêm 1 lớp | baseline → v2 (thêm luật dài) → v3 (thêm ví dụ ngắn); kết luận **giữ baseline** |
| Kết quả | — | Precision 0.841 · Recall 0.914 · F1 0.876; 0 tiêu chí bịa (§16.2) |

**Ba thứ nên bê nguyên cách làm:**

1. **Công bố ngưỡng Good / Acceptable / Needs Improvement trước khi chạy số.**
2. **Biểu đồ đường theo version prompt** — cho hội đồng thấy quá trình cải tiến, không chỉ con số cuối.
3. **Sơ đồ 5 bước của khung kiểm thử** đặt ở đầu phần AI Testing để định khung trước khi vào số liệu.

**Một thứ nên làm khác:** SmartHR trình bày như thể AI luôn thành công. SRIS nói thẳng cả chỗ hỏng — hai khiếm khuyết còn lại (lọt tiêu chí "giấy tờ", một tin bị trả rỗng) và biên độ 0.714–0.841 của phép đo đều ghi rõ trong `exp_criteria_extract/out/KET_QUA.md`. Nêu hạn chế trước còn hơn để hội đồng tự tìm ra.
