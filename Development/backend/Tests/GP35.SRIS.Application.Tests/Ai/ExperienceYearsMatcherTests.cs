using GP35.SRIS.Application.Services.Ai;
using GP35.SRIS.Domain.Entities;
using Xunit;

namespace GP35.SRIS.Application.Tests.Ai;

/// <summary>
/// Tiêu chí "≥ N năm kinh nghiệm" chấm bằng SỐ, không tìm chuỗi: đọc N từ tiêu chí,
/// cộng các mốc thời gian trong CV (gộp khoảng chồng lấn) rồi so hai con số.
/// </summary>
public class ExperienceYearsMatcherTests
{
    private static readonly DateTime Today = new(2026, 8, 1);

    private static EvaluationCriteria Hard(string name, string? keywords = null) => new()
    {
        CriteriaId = 1,
        Name = name,
        Keywords = keywords,
        CriteriaType = "HARD"
    };

    // ===== Đọc yêu cầu từ tiêu chí =====

    [Theory]
    [InlineData("Tối thiểu 3 năm kinh nghiệm kế toán", 3)]
    [InlineData("Kinh nghiệm 2 năm trở lên", 2)]
    [InlineData("Yêu cầu 2-3 năm kinh nghiệm", 2)]          // khoảng -> lấy cận dưới
    [InlineData("Từ 2 đến 4 năm kinh nghiệm", 2)]
    [InlineData("At least 5 years of experience", 5)]
    [InlineData("3+ years experience", 3)]
    [InlineData("Kinh nghiệm 1.5 năm mảng bán hàng", 1.5)]
    public void ParseRequiredYears_ReadsThreshold(string criterion, double expected)
        => Assert.Equal(expected, ExperienceYearsMatcher.ParseRequiredYears(criterion));

    [Theory]
    [InlineData("Thành thạo Excel")]
    [InlineData("Tốt nghiệp đại học chuyên ngành kế toán")]
    [InlineData("Giới tính nam")]                            // "nam" không dấu != "năm"
    [InlineData("Bằng trung cấp 2 năm")]                     // có "2 năm" nhưng không nói kinh nghiệm
    [InlineData(null)]
    public void ParseRequiredYears_NotAnExperienceCriterion_ReturnsNull(string? criterion)
        => Assert.Null(ExperienceYearsMatcher.ParseRequiredYears(criterion));

    // ===== Quét mốc thời gian trong CV =====

    [Fact]
    public void ScanCv_MonthYearRange_CountsMonths()
    {
        var scan = ExperienceYearsMatcher.ScanCv("Kế toán tổng hợp, 01/2022 - 01/2025, công ty ABC.", Today);

        Assert.Equal(3.0, scan.Years);
        Assert.Single(scan.Ranges);
    }

    [Fact]
    public void ScanCv_UntilNow_CountsUpToToday()
    {
        var scan = ExperienceYearsMatcher.ScanCv("Nhân viên kinh doanh 08/2024 – hiện tại.", Today);

        Assert.Equal(2.0, scan.Years);
        Assert.Contains("hiện tại", scan.Ranges[0]);   // bằng chứng giữ nguyên dấu
    }

    [Fact]
    public void ScanCv_BareYears_CountsWholeYears()
    {
        // 2019 -> hết 2021 = 36 tháng
        var scan = ExperienceYearsMatcher.ScanCv("Kinh nghiệm: 2019 - 2021 tại công ty XYZ.", Today);

        Assert.Equal(3.0, scan.Years);
    }

    [Fact]
    public void ScanCv_TwoSeparateJobs_SumsBoth()
    {
        var cv = "Công ty A: 01/2018 - 01/2020. Công ty B: 01/2022 - 01/2024.";

        var scan = ExperienceYearsMatcher.ScanCv(cv, Today);

        Assert.Equal(4.0, scan.Years);
        Assert.Equal(2, scan.Ranges.Count);
    }

    [Fact]
    public void ScanCv_OverlappingPeriods_CountedOnce()
    {
        // Làm 2 nơi cùng lúc: 01/2020-01/2023 và 01/2021-01/2022 -> vẫn là 3 năm, không phải 4.
        var cv = "Toàn thời gian 01/2020 - 01/2023. Cộng tác viên 01/2021 - 01/2022.";

        var scan = ExperienceYearsMatcher.ScanCv(cv, Today);

        Assert.Equal(3.0, scan.Years);
    }

    [Fact]
    public void ScanCv_IgnoresBirthYearAndReversedRange()
    {
        // "1975 - 1979" trước MinYear, "01/2024 - 01/2020" ngược mốc -> cả hai bị bỏ.
        var scan = ExperienceYearsMatcher.ScanCv("Sinh 1975 - 1979. Dự án 01/2024 - 01/2020.", Today);

        Assert.Null(scan.Years);
    }

    [Fact]
    public void ScanCv_NoDateRange_ReturnsNull()
    {
        var scan = ExperienceYearsMatcher.ScanCv("Kế toán viên, thành thạo MISA và Excel.", Today);

        Assert.Null(scan.Years);
        Assert.Empty(scan.Ranges);
    }

    // ===== Ráp vào luồng chấm tiêu chí HARD =====

    [Fact]
    public void MatchHard_EnoughExperience_Matches()
    {
        var cv = "Kế toán tổng hợp 01/2021 - 01/2025 tại công ty ABC.";

        var (matched, evidence) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Tối thiểu 3 năm kinh nghiệm kế toán"));

        Assert.True(matched);
        Assert.Contains("Ước tính 4 năm", evidence);
        Assert.Contains("yêu cầu từ 3 năm", evidence);
    }

    [Fact]
    public void MatchHard_NotEnoughExperience_DoesNotMatchButKeepsEvidence()
    {
        var cv = "Nhân viên kế toán 01/2024 - 01/2025.";

        var (matched, evidence) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Tối thiểu 3 năm kinh nghiệm kế toán"));

        Assert.False(matched);
        Assert.Contains("Ước tính 1 năm", evidence);
    }

    [Fact]
    public void MatchHard_CvHasNoDates_ReportsUndetermined()
    {
        var cv = "Kế toán viên, thành thạo MISA.";

        var (matched, evidence) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Tối thiểu 2 năm kinh nghiệm"));

        Assert.False(matched);
        Assert.Contains("Không xác định được", evidence);
    }

    [Fact]
    public void MatchHard_TextMentionsYearsButShorterThanRequired_NoLongerFalsePositive()
    {
        // Cách cũ (tìm chuỗi) sẽ khớp vì CV có đúng chữ "3 năm" — dù đó là 3 năm ĐẠI HỌC.
        var cv = "Học đại học 3 năm chuyên ngành kế toán. Đi làm 01/2025 - 06/2025.";

        var (matched, _) = CriteriaScoringService.MatchHardByKeywords(
            cv, Hard("Tối thiểu 3 năm kinh nghiệm kế toán"));

        Assert.False(matched);
    }

    [Fact]
    public void MatchHard_NonExperienceCriterion_StillUsesKeywordMatching()
    {
        var cv = "Thành thạo Excel nâng cao, pivot table.";

        var (matched, evidence) = CriteriaScoringService.MatchHardByKeywords(cv, Hard("Excel"));

        Assert.True(matched);
        Assert.Contains("Excel", evidence);
    }
}
