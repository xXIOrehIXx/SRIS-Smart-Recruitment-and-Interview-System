using System.Text;

namespace GP35.SRIS.Application.Services.Ai;

/// <summary>
/// Bổ CV thành các ĐOẠN (chunk) để embed từng đoạn (docs 5.18). Chiến lược: tách theo
/// dòng trống/xuống dòng, gộp đoạn ngắn lại và bổ đoạn quá dài — mỗi chunk ~1 "ý" của CV
/// (1 kinh nghiệm, 1 nhóm kỹ năng...). Tham số cỡ chunk là điểm khởi đầu — PoC Việc B4
/// đo trên bộ CV test rồi mới khóa.
/// </summary>
public static class CvChunker
{
    /// <summary>Chunk ngắn hơn ngưỡng này thì gộp với chunk kế (dòng tiêu đề, gạch đầu dòng lẻ).</summary>
    private const int MinChars = 120;

    /// <summary>Chunk dài hơn ngưỡng này thì bổ tiếp theo câu/dòng.</summary>
    private const int MaxChars = 700;

    public static IReadOnlyList<string> Split(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return Array.Empty<string>();

        // (1) Tách thô theo dòng, gom thành đoạn tại dòng trống.
        var paragraphs = new List<string>();
        var current = new StringBuilder();
        foreach (var rawLine in text.Replace("\r\n", "\n").Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.Length == 0)
            {
                FlushParagraph(paragraphs, current);
                continue;
            }
            if (current.Length > 0) current.Append(' ');
            current.Append(line);

            // PDF extract thường KHÔNG có dòng trống -> chặn đoạn phình vô hạn.
            if (current.Length >= MaxChars) FlushParagraph(paragraphs, current);
        }
        FlushParagraph(paragraphs, current);

        // (2) Gộp đoạn quá ngắn với đoạn kế — tránh embed dòng tiêu đề trơ trọi.
        var merged = new List<string>();
        var buffer = new StringBuilder();
        foreach (var p in paragraphs)
        {
            if (buffer.Length > 0) buffer.Append(' ');
            buffer.Append(p);
            if (buffer.Length >= MinChars)
            {
                merged.Add(buffer.ToString());
                buffer.Clear();
            }
        }
        if (buffer.Length > 0)
        {
            // Mẩu cuối quá ngắn: dán vào chunk trước đó nếu có.
            if (merged.Count > 0) merged[^1] = merged[^1] + " " + buffer;
            else merged.Add(buffer.ToString());
        }

        return merged;
    }

    private static void FlushParagraph(List<string> paragraphs, StringBuilder current)
    {
        if (current.Length == 0) return;
        paragraphs.Add(current.ToString());
        current.Clear();
    }
}
