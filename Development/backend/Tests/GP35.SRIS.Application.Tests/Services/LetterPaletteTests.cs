using GP35.SRIS.Lib.Services.Pdf;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// Màu brand của thư mời do admin nhập tự do — bảng màu phải chịu được mọi thứ họ gõ vào
/// mà vẫn cho ra lá thư đọc được trên giấy trắng.
/// </summary>
public class LetterPaletteTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("xanh dương")]
    [InlineData("#12")]
    [InlineData("#GGGGGG")]
    public void From_Should_Fall_Back_To_Default_When_Color_Is_Unusable(string? color)
    {
        var palette = LetterPalette.From(color);

        Assert.Equal("#1F4E79", palette.Accent);
    }

    [Fact]
    public void From_Should_Keep_A_Dark_Enough_Brand_Color_As_Is()
    {
        var palette = LetterPalette.From("#0F62FE");

        Assert.Equal("#0F62FE", palette.Accent);
    }

    [Theory]
    [InlineData("#FFE600")]   // vàng chanh
    [InlineData("#00FFFF")]   // cyan
    [InlineData("#FFFFFF")]   // trắng tinh
    public void From_Should_Darken_Colors_That_Would_Vanish_On_White_Paper(string color)
    {
        var palette = LetterPalette.From(color);

        Assert.True(Contrast(palette.Accent) >= 4.5,
            $"Màu {color} -> {palette.Accent} vẫn quá sáng để in chữ trên nền trắng.");
    }

    [Fact]
    public void From_Should_Accept_Short_Hex_And_Missing_Hash()
    {
        Assert.Equal(LetterPalette.From("#003366").Accent, LetterPalette.From("036").Accent);
    }

    [Fact]
    public void Tint_Should_Be_Light_Enough_To_Read_Body_Text_On()
    {
        // Nền khối "Lương & Phúc lợi" — chữ thân thư in đè lên, nên phải gần như trắng.
        var palette = LetterPalette.From("#0F62FE");

        Assert.True(Luminance(palette.Tint) > 0.8);
    }

    // ============================================================

    /// <summary>Tỉ lệ tương phản với nền trắng theo WCAG.</summary>
    private static double Contrast(string hex) => 1.05 / (Luminance(hex) + 0.05);

    private static double Luminance(string hex)
    {
        var r = Channel(hex.Substring(1, 2));
        var g = Channel(hex.Substring(3, 2));
        var b = Channel(hex.Substring(5, 2));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    private static double Channel(string pair)
    {
        var v = Convert.ToInt32(pair, 16) / 255.0;
        return v <= 0.03928 ? v / 12.92 : Math.Pow((v + 0.055) / 1.055, 2.4);
    }
}
