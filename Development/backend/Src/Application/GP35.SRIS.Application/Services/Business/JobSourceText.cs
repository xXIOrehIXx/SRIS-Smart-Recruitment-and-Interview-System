using System.Text;
using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Gộp nội dung một tin tuyển dụng thành MỘT văn bản cho AI đọc.
///
/// <para>
/// Dùng chung cho cả hai đường AI của hệ thống — bóc tiêu chí (<see cref="EvaluationCriteriaService"/>)
/// và sàng lọc CV (<see cref="CvScreeningService"/>). Để mỗi bên tự ghép thì hai bên sẽ trôi
/// khỏi nhau: chuyện đã xảy ra một lần khi lượt bóc chỉ gửi mỗi <c>jd_text</c> và bỏ mất
/// "Yêu cầu ứng viên" — đúng phần dữ liệu giá trị nhất — rồi báo người dùng "chưa nêu yêu cầu
/// nào" trong khi họ đã nhập đầy đủ.
/// </para>
/// </summary>
public static class JobSourceText
{
    /// <summary>
    /// Mô tả công việc + yêu cầu ứng viên + kỹ năng -> 1 văn bản. Giữ tiêu đề từng mục để LLM
    /// thấy rõ ranh giới đầu việc / yêu cầu. Mục trống thì bỏ hẳn, không để tiêu đề rỗng gây nhiễu.
    /// Không có mục nào -> trả chuỗi rỗng (caller hiểu là "chưa có gì cho AI đọc").
    /// </summary>
    public static string Build(string? jdText, IReadOnlyList<JobRequirement> requirements, string? skillTags)
    {
        var sb = new StringBuilder();

        if (!string.IsNullOrWhiteSpace(jdText))
            sb.Append("[Mô tả công việc]\n").Append(jdText.Trim()).Append("\n\n");

        var reqLines = requirements
            .Select(r => r.Content?.Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .ToList();
        if (reqLines.Count > 0)
        {
            sb.Append("[Yêu cầu ứng viên]\n");
            foreach (var line in reqLines)
                sb.Append("- ").Append(line).Append('\n');
            sb.Append('\n');
        }

        if (!string.IsNullOrWhiteSpace(skillTags))
            sb.Append("[Kỹ năng yêu cầu]\n").Append(skillTags.Trim()).Append('\n');

        return sb.ToString().Trim();
    }
}
