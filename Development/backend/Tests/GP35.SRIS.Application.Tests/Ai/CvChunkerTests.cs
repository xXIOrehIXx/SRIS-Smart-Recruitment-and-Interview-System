using GP35.SRIS.Application.Services.Ai;
using Xunit;

namespace GP35.SRIS.Application.Tests.Ai;

/// <summary>
/// CvChunker (docs 5.18): bổ CV thành chunk ~1 ý để embed từng đoạn.
/// Hai bẫy thực tế: PDF extract không có dòng trống, và PDF extract ra 1 dòng dài liền mạch.
/// </summary>
public class CvChunkerTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \n  \n ")]
    public void Split_EmptyText_ReturnsEmpty(string? text)
        => Assert.Empty(CvChunker.Split(text!));

    [Fact]
    public void Split_ShortText_SingleChunk()
    {
        var chunks = CvChunker.Split("Kỹ sư phần mềm với 3 năm kinh nghiệm Java, Spring Boot và SQL Server. Từng làm hệ thống thanh toán.");
        Assert.Single(chunks);
    }

    [Fact]
    public void Split_ParagraphsSeparatedByBlankLines_SplitsOnBlankLines()
    {
        // Cả 2 đoạn phải dài hơn MinChars (120) — đoạn ngắn hơn sẽ bị gộp vào đoạn kế (đúng thiết kế)
        var text =
            "KINH NGHIỆM: 3 năm phát triển backend Java tại công ty A, xây dựng API thanh toán, tối ưu SQL Server cho hệ thống 1 triệu giao dịch/ngày.\n" +
            "\n" +
            "HỌC VẤN: Tốt nghiệp Đại học Bách Khoa chuyên ngành Công nghệ thông tin năm 2020, GPA 3.5/4, đạt học bổng khuyến khích học tập 3 kỳ liên tiếp và giải nhì Olympic tin học.\n";

        var chunks = CvChunker.Split(text);

        Assert.Equal(2, chunks.Count);
        Assert.Contains(chunks, c => c.StartsWith("KINH NGHIỆM"));
        Assert.Contains(chunks, c => c.StartsWith("HỌC VẤN"));
    }

    [Fact]
    public void Split_SingleLongLineWithoutNewlines_NoChunkExplodes()
    {
        // Mô phỏng PDF extract ra 1 dòng dài liền mạch (không có \n)
        var words = string.Join(' ', Enumerable.Repeat("kinhnghiem java backend api", 300)); // ~8000 ký tự

        var chunks = CvChunker.Split(words);

        Assert.True(chunks.Count > 1, "Text dài phải bị bổ thành nhiều chunk");
        // MaxChars=700, gộp đoạn ngắn có thể cộng thêm chút — chặn trên nới lỏng
        Assert.All(chunks, c => Assert.True(c.Length <= 900, $"Chunk quá dài: {c.Length} ký tự"));
        Assert.All(chunks, c => Assert.False(string.IsNullOrWhiteSpace(c)));
    }

    [Fact]
    public void Split_ShortHeadingLines_AreMergedIntoNeighborChunk()
    {
        var text =
            "KỸ NĂNG\n" + // dòng tiêu đề trơ trọi — phải được gộp, không thành chunk riêng
            "\n" +
            "Java, Spring Boot, SQL Server, Docker, Kubernetes. Có kinh nghiệm CI/CD với GitHub Actions và triển khai trên Azure.";

        var chunks = CvChunker.Split(text);

        Assert.All(chunks, c => Assert.True(c.Length >= 60,
            $"Chunk quá ngắn (tiêu đề trơ trọi chưa được gộp): '{c}'"));
    }

    [Fact]
    public void Split_PreservesAllImportantContent()
    {
        var text = "Ứng viên biết MISA.\n\nCó chứng chỉ ACCA quốc tế.\n\nThành thạo Excel nâng cao và pivot table trong phân tích dữ liệu tài chính doanh nghiệp.";

        var joined = string.Join(" ", CvChunker.Split(text));

        Assert.Contains("MISA", joined);
        Assert.Contains("ACCA", joined);
        Assert.Contains("pivot table", joined);
    }
}
