import React from "react";
import { Tag, Tooltip } from "antd";

/**
 * NGUỒN DUY NHẤT cho cách hiện mức phù hợp CV↔JD do AI chấm (V046).
 *
 * Đây là ĐỀ XUẤT THAM KHẢO, không phải phán quyết — nên cách hiện phải nói ra điều đó:
 * luôn kèm chữ ("Nên mời" / "Cân nhắc" / "Ít phù hợp") chứ không để con số đứng trần.
 * Một ô "82" trơ trọi đọc như điểm thi; "82 · Nên mời" đọc như một gợi ý để người dùng
 * tự kiểm chứng bằng phần trích dẫn trong màn chi tiết.
 *
 * Hồ sơ chưa phân tích KHÔNG hiện điểm 0 — hiện "Chưa phân tích". Gộp hai ca đó lại là
 * đổ oan cho ứng viên chưa ai đọc.
 */

export const SCREENING_DECISION_LABELS = {
  PROCEED: "Nên mời",
  CONSIDER: "Cân nhắc",
  REJECT: "Ít phù hợp",
};

export const SCREENING_DECISION_COLORS = {
  PROCEED: "green",
  CONSIDER: "gold",
  REJECT: "default",
};

/**
 * REJECT cố ý để màu xám ("default") chứ không phải đỏ: đỏ trên danh sách đọc như
 * "đã loại", mà AI không loại được ai — hồ sơ đó vẫn đang chờ người xem.
 */
const FitScoreTag = ({ status, fitScore, decision }) => {
  if (status === "PENDING" || status === "RUNNING") {
    return <Tag color="processing">Đang phân tích…</Tag>;
  }

  if (status === "FAILED") {
    return (
      <Tooltip title="AI không đọc được CV này (thường là bản scan ảnh). Mở hồ sơ để xem chi tiết.">
        <Tag color="red">Không phân tích được</Tag>
      </Tooltip>
    );
  }

  if (status !== "DONE" || fitScore === null || fitScore === undefined) {
    return <Tag>Chưa phân tích</Tag>;
  }

  return (
    <Tooltip title="Mức phù hợp do AI đối chiếu CV với tin tuyển dụng. Đây là gợi ý để đọc trước — mở hồ sơ để xem AI dựa vào câu nào trong CV.">
      <Tag color={SCREENING_DECISION_COLORS[decision] || "default"}>
        {fitScore} · {SCREENING_DECISION_LABELS[decision] || "—"}
      </Tag>
    </Tooltip>
  );
};

export default FitScoreTag;
