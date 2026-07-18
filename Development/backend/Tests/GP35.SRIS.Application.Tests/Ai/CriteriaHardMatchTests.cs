using GP35.SRIS.Application.Services.Ai;
using GP35.SRIS.Domain.Entities;
using Xunit;

namespace GP35.SRIS.Application.Tests.Ai;

/// <summary>
/// Lọc tiêu chí HARD bằng keyword (docs 5.18): không phân biệt hoa/thường, không phân biệt
/// dấu tiếng Việt (CV "kế toán" khớp keyword "ke toan" và ngược lại), evidence là cửa sổ
/// văn bản GỐC quanh keyword.
/// </summary>
public class CriteriaHardMatchTests
{
    private static EvaluationCriteria Hard(string name, string? keywords = null) => new()
    {
        CriteriaId = 1,
        Name = name,
        Keywords = keywords,
        CriteriaType = "HARD"
    };

    [Fact]
    public void Match_ExactKeyword_ReturnsEvidenceAroundKeyword()
    {
        var cv = "Tôi có 5 năm kinh nghiệm kế toán tổng hợp tại công ty ABC, thành thạo MISA.";

        var (matched, evidence) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Kế toán", "kế toán"));

        Assert.True(matched);
        Assert.NotNull(evidence);
        Assert.Contains("kế toán tổng hợp", evidence);
    }

    [Fact]
    public void Match_IsDiacriticsInsensitive_KeywordAsciiCvHasDiacritics()
    {
        var cv = "Ứng viên có kinh nghiệm kế toán và kiểm toán.";

        var (matched, _) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Kế toán", "ke toan"));

        Assert.True(matched);
    }

    [Fact]
    public void Match_IsCaseInsensitive()
    {
        var cv = "Thành thạo JAVA và Spring Boot.";

        var (matched, _) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Java", "java"));

        Assert.True(matched);
    }

    [Fact]
    public void Match_MultipleKeywords_SecondKeywordHits()
    {
        var cv = "Có chứng chỉ ACCA, từng làm kiểm toán nội bộ.";

        var (matched, _) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Chứng chỉ kế toán", "cpa; acca; cma"));

        Assert.True(matched);
    }

    [Fact]
    public void Match_NoKeywordInCv_ReturnsFalseWithNullEvidence()
    {
        var cv = "Kinh nghiệm bán hàng và chăm sóc khách hàng.";

        var (matched, evidence) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Java", "java; spring"));

        Assert.False(matched);
        Assert.Null(evidence);
    }

    [Fact]
    public void Match_EmptyKeywords_FallsBackToCriterionName()
    {
        var cv = "Thành thạo Excel nâng cao, pivot table.";

        var (matched, _) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Excel", keywords: null));

        Assert.True(matched);
    }

    [Fact]
    public void Match_LongCv_EvidenceIsWindowNotWholeText()
    {
        var padding = new string('x', 2000);
        var cv = padding + " ứng viên biết dùng MISA thành thạo " + padding;

        var (matched, evidence) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("MISA", "misa"));

        Assert.True(matched);
        Assert.NotNull(evidence);
        Assert.True(evidence!.Length < 700, $"Evidence quá dài: {evidence.Length} ký tự");
        Assert.Contains("MISA", evidence);
    }

    // ===== RemoveDiacritics =====

    [Theory]
    [InlineData("kế toán", "ke toan")]
    [InlineData("kiểm định", "kiem dinh")]
    [InlineData("Đà Nẵng", "Da Nang")]
    [InlineData("english text", "english text")]
    public void RemoveDiacritics_Works(string input, string expected)
        => Assert.Equal(expected, CriteriaScoringService.RemoveDiacritics(input));
}
