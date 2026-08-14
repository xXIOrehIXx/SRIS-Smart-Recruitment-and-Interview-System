using GP35.SRIS.Lib.Services.Ai;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// Bộ lọc tiêu chí sau khi AI bóc xong.
///
/// Ca thử không bịa ra: phần lớn lấy thẳng từ đầu ra thật của model ghi trong
/// <c>ai-experiments/exp_criteria_extract/out/KET_QUA.md</c> §6.2 (5 dòng giấy tờ lọt lưới ở
/// prompt production V4) và từ tiêu chí AI đề xuất cho job 46 (chuyên viên nhân sự C&amp;B).
/// Đây là lý do bộ lọc tồn tại, nên phải có test bám đúng vào chúng.
/// </summary>
public class CriteriaNameFilterTests
{
    // ---------------------------------------------------------------
    //  Lớp 1 — giấy tờ: bỏ hẳn
    // ---------------------------------------------------------------

    /// <summary>Đúng 5 dòng V4 để lọt (KET_QUA.md §6.2) + ca job 46.</summary>
    [Theory]
    [InlineData("Tốt nghiệp Cao đẳng trở lên chuyên ngành Kế toán - Kiểm toán")]
    [InlineData("Tốt nghiệp THPT trở lên")]
    [InlineData("Tốt nghiệp Đại học các ngành Quản trị nhân lực, Luật hoặc tương đương")]
    [InlineData("Ngoại hình ưa nhìn")]
    [InlineData("Chiều cao từ 1m60 trở lên")]
    [InlineData("Tốt nghiệp Đại học chuyên ngành Quản trị nhân lực, Luật hoặc Kinh tế")]
    public void Apply_Should_Drop_Paperwork_Lines_That_The_Prompt_Failed_To_Filter(string name)
    {
        var ketQua = CriteriaNameFilter.Apply([new ExtractedCriterion(name, 3)]);

        Assert.Empty(ketQua.Criteria);
        Assert.Equal([name], ketQua.Dropped);
    }

    /// <summary>
    /// Model bỏ được "Tốt nghiệp Đại học" trần trụi nhưng giữ lại khi có đuôi chuyên ngành
    /// (§6.2). Regex không phân biệt hai ca đó — đúng như mong muốn.
    /// </summary>
    [Theory]
    [InlineData("Tốt nghiệp Đại học")]
    [InlineData("Có chứng chỉ hành nghề kế toán (CPA/ACCA)")]
    [InlineData("Có bằng lái xe B2")]
    [InlineData("Thường trú tại Hà Nội")]
    [InlineData("Độ tuổi 22-30")]
    public void Apply_Should_Drop_Every_Document_And_Demographic_Class(string name)
    {
        var ketQua = CriteriaNameFilter.Apply([new ExtractedCriterion(name, 1)]);

        Assert.Empty(ketQua.Criteria);
    }

    // ---------------------------------------------------------------
    //  Lớp 2 — ngưỡng: cắt, KHÔNG bỏ
    // ---------------------------------------------------------------

    /// <summary>
    /// Ca chốt của job 46. Con số năm thì cầm CV lên đối chiếu là xong, nhưng "kinh nghiệm mảng
    /// C&amp;B" thì vẫn phải hỏi mới biết — bỏ cả dòng là mất oan một tiêu chí thật.
    /// </summary>
    [Theory]
    [InlineData("Tối thiểu 2 năm kinh nghiệm mảng C&B", "Kinh nghiệm mảng C&B")]
    [InlineData("Có ít nhất 3 năm kinh nghiệm kế toán tổng hợp", "Kinh nghiệm kế toán tổng hợp")]
    [InlineData("Kinh nghiệm từ 2 năm trở lên trong lĩnh vực marketing", "Kinh nghiệm trong lĩnh vực marketing")]
    [InlineData("Kinh nghiệm 2 năm mảng tuyển dụng", "Kinh nghiệm mảng tuyển dụng")]
    [InlineData("Trên 5 năm kinh nghiệm quản lý đội nhóm", "Kinh nghiệm quản lý đội nhóm")]
    [InlineData("Từ 3-5 năm kinh nghiệm vận hành kho", "Kinh nghiệm vận hành kho")]
    public void Apply_Should_Strip_The_Year_Threshold_And_Keep_The_Skill(string thô, string mongDoi)
    {
        var ketQua = CriteriaNameFilter.Apply([new ExtractedCriterion(thô, 4)]);

        var c = Assert.Single(ketQua.Criteria);
        Assert.Equal(mongDoi, c.Name);
        Assert.Equal(4, c.Weight);           // cắt tên thì không đụng trọng số
        Assert.Single(ketQua.Rewritten);
    }

    /// <summary>Cắt ngưỡng xong chỉ còn khung rỗng thì dòng đó không chấm được gì -> bỏ.</summary>
    [Theory]
    [InlineData("Tối thiểu 2 năm kinh nghiệm")]
    [InlineData("Ít nhất 1 năm kinh nghiệm làm việc")]
    [InlineData("Kinh nghiệm từ 3 năm trở lên")]
    public void Apply_Should_Drop_A_Threshold_Line_That_Has_Nothing_Left_To_Judge(string name)
    {
        var ketQua = CriteriaNameFilter.Apply([new ExtractedCriterion(name, 2)]);

        Assert.Empty(ketQua.Criteria);
        Assert.Equal([name], ketQua.Dropped);
    }

    // ---------------------------------------------------------------
    //  Không được đụng vào tiêu chí tốt
    // ---------------------------------------------------------------

    /// <summary>Khối "GIỮ" trong prompt production phải đi qua bộ lọc không suy suyển một chữ.</summary>
    [Theory]
    [InlineData("Thành thạo Excel")]
    [InlineData("Tiếng Anh giao tiếp")]
    [InlineData("Thành thạo SQL Server")]
    [InlineData("Kinh nghiệm sử dụng phần mềm kế toán MISA/Fast")]
    [InlineData("Kinh nghiệm làm kế toán tổng hợp")]
    [InlineData("Kỹ năng giao tiếp")]
    [InlineData("Kỹ năng làm việc nhóm")]
    [InlineData("Kỹ năng đàm phán và thuyết phục")]
    [InlineData("Thành thạo Excel (hàm SUMIF, VLOOKUP, PivotTable)")]
    public void Apply_Should_Leave_Genuine_Criteria_Untouched(string name)
    {
        var ketQua = CriteriaNameFilter.Apply([new ExtractedCriterion(name, 5)]);

        var c = Assert.Single(ketQua.Criteria);
        Assert.Equal(name, c.Name);
        Assert.Empty(ketQua.Dropped);
        Assert.Empty(ketQua.Rewritten);
    }

    /// <summary>"kỹ năng" chứa "năng", không được nhầm thành ngưỡng "năm".</summary>
    [Fact]
    public void Apply_Should_Not_Mistake_Ky_Nang_For_A_Year_Threshold()
    {
        var ketQua = CriteriaNameFilter.Apply([new ExtractedCriterion("Kỹ năng xử lý 3 tình huống khó", 1)]);

        var c = Assert.Single(ketQua.Criteria);
        Assert.Equal("Kỹ năng xử lý 3 tình huống khó", c.Name);
    }

    // ---------------------------------------------------------------
    //  Cả bộ
    // ---------------------------------------------------------------

    /// <summary>Bộ tiêu chí job 46: 2 dòng hỏng, 4 dòng tốt — đúng thứ người dùng báo.</summary>
    [Fact]
    public void Apply_Should_Clean_The_Job46_Set_And_Keep_The_Model_Ordering()
    {
        ExtractedCriterion[] tho =
        [
            new("Tốt nghiệp Đại học chuyên ngành Quản trị nhân lực, Luật hoặc Kinh tế", 3),
            new("Tối thiểu 2 năm kinh nghiệm mảng C&B", 5),
            new("Thành thạo Excel", 4),
            new("Am hiểu Luật Lao động và Luật BHXH", 5),
            new("Kỹ năng giao tiếp", 3),
            new("Kinh nghiệm sử dụng phần mềm tính lương", 4),
        ];

        var ketQua = CriteriaNameFilter.Apply(tho);

        Assert.Equal(
        [
            "Kinh nghiệm mảng C&B",
            "Thành thạo Excel",
            "Am hiểu Luật Lao động và Luật BHXH",
            "Kỹ năng giao tiếp",
            "Kinh nghiệm sử dụng phần mềm tính lương",
        ], ketQua.Criteria.Select(c => c.Name));

        Assert.Single(ketQua.Dropped);
        Assert.Single(ketQua.Rewritten);
    }

    /// <summary>Cắt ngưỡng có thể làm hai dòng chụm về một tên — giữ dòng đứng trước.</summary>
    [Fact]
    public void Apply_Should_Drop_Duplicates_Created_By_Trimming()
    {
        ExtractedCriterion[] tho =
        [
            new("Tối thiểu 2 năm kinh nghiệm mảng C&B", 5),
            new("Kinh nghiệm mảng C&B", 2),
        ];

        var ketQua = CriteriaNameFilter.Apply(tho);

        var c = Assert.Single(ketQua.Criteria);
        Assert.Equal("Kinh nghiệm mảng C&B", c.Name);
        Assert.Equal(5, c.Weight);
    }

    /// <summary>Danh sách rỗng vào -> rỗng ra, không nổ.</summary>
    [Fact]
    public void Apply_Should_Accept_An_Empty_List()
    {
        var ketQua = CriteriaNameFilter.Apply([]);

        Assert.Empty(ketQua.Criteria);
        Assert.Empty(ketQua.Dropped);
    }
}
