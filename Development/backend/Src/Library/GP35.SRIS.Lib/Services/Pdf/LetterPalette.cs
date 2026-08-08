using System.Globalization;

namespace GP35.SRIS.Lib.Services.Pdf;

/// <summary>
/// Bảng màu của một lá thư, suy ra từ <c>Company.primary_color</c>.
///
/// Màu brand do admin tự nhập nên KHÔNG tin được: vàng chanh / cyan in lên giấy trắng là
/// mất chữ. Ở đây tự làm tối màu tới ngưỡng còn đọc được, sai định dạng thì rơi về navy
/// mặc định — thư mời không bao giờ được xấu hay khó đọc chỉ vì admin gõ nhầm mã màu.
/// </summary>
public sealed class LetterPalette
{
    /// <summary>Navy trung tính, dùng khi công ty chưa chọn màu brand.</summary>
    private const string DefaultBrand = "#1F4E79";

    /// <summary>Ngưỡng sáng tối đa cho chữ/đường kẻ trên nền trắng (đủ 4.5:1 theo WCAG).</summary>
    private const double MaxLuminance = 0.17;

    /// <summary>Xanh cyan của khung viền khi công ty chưa chọn màu brand (bám mẫu thư tham chiếu).</summary>
    private const string DefaultFrame = "#29ABE2";

    /// <summary>Nền giấy tím-xám rất nhạt — cố định, không đổi theo brand để thư luôn dễ đọc.</summary>
    private const string PaperColor = "#EFEFF8";

    private LetterPalette(byte r, byte g, byte b, string frame)
    {
        Accent = Hex(r, g, b);
        SoftLine = Hex(Blend(r, 0.68), Blend(g, 0.68), Blend(b, 0.68));
        Tint = Hex(Blend(r, 0.94), Blend(g, 0.94), Blend(b, 0.94));
        Frame = frame;
    }

    /// <summary>Màu khung viền quanh trang — dùng NGUYÊN màu brand (viền không cần tương phản chữ).</summary>
    public string Frame { get; }

    /// <summary>Nền trong khung.</summary>
    public string Paper => PaperColor;

    /// <summary>Chữ tiêu đề/heading — gần đen như mẫu, KHÔNG tô màu brand.</summary>
    public string Heading => "#1A1A1A";

    /// <summary>Màu chủ đạo: tiêu đề, tên công ty, gạch đầu dòng, đường kẻ đậm.</summary>
    public string Accent { get; }

    /// <summary>Cùng tông nhưng nhạt — đường kẻ phụ, viền footer.</summary>
    public string SoftLine { get; }

    /// <summary>Nền rất nhạt cho khối Lương &amp; Phúc lợi.</summary>
    public string Tint { get; }

    /// <summary>Chữ phụ (địa chỉ, nhãn trường, footer).</summary>
    public string Muted => "#6B7280";

    /// <summary>Chữ thân thư — đen dịu, không dùng #000 cho đỡ gắt.</summary>
    public string Body => "#1F2933";

    public static LetterPalette From(string? brandColor)
    {
        var parsed = Parse(brandColor);

        // Khung viền lấy nguyên màu brand (không làm tối): viền không phải chữ, ép tối làm
        // mất đúng cái màu công ty chọn. Chưa cấu hình brand -> cyan như thư mẫu.
        var frame = parsed is (byte fr, byte fg, byte fb) ? Hex(fr, fg, fb) : DefaultFrame;

        // Chữ/gạch chân thì vẫn phải đọc được trên giấy -> dùng bản đã làm tối.
        var (r, g, b) = Darken(parsed ?? Parse(DefaultBrand)!.Value);
        return new LetterPalette(r, g, b, frame);
    }

    // ============================================================

    /// <summary>Nhận "#RGB", "#RRGGBB" hoặc không có "#". Khác thế -> null (dùng màu mặc định).</summary>
    private static (byte R, byte G, byte B)? Parse(string? value)
    {
        var hex = value?.Trim().TrimStart('#');
        if (string.IsNullOrEmpty(hex)) return null;

        if (hex.Length == 3)
            hex = string.Concat(hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]);
        if (hex.Length != 6) return null;

        if (!byte.TryParse(hex.AsSpan(0, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var r) ||
            !byte.TryParse(hex.AsSpan(2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var g) ||
            !byte.TryParse(hex.AsSpan(4, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var b))
            return null;

        return (r, g, b);
    }

    /// <summary>Giảm dần độ sáng cho tới khi chữ nổi rõ trên nền trắng.</summary>
    private static (byte R, byte G, byte B) Darken((byte R, byte G, byte B) c)
    {
        var (r, g, b) = ((double)c.R, (double)c.G, (double)c.B);

        // Mỗi vòng tối đi 8%; màu trắng tinh cần ~30 vòng là chạm ngưỡng nên vòng lặp luôn dừng.
        for (var i = 0; i < 40 && Luminance(r, g, b) > MaxLuminance; i++)
        {
            r *= 0.92;
            g *= 0.92;
            b *= 0.92;
        }

        return ((byte)Math.Round(r), (byte)Math.Round(g), (byte)Math.Round(b));
    }

    /// <summary>Độ sáng tương đối theo WCAG (đã tuyến tính hoá sRGB).</summary>
    private static double Luminance(double r, double g, double b)
        => 0.2126 * Linear(r) + 0.7152 * Linear(g) + 0.0722 * Linear(b);

    private static double Linear(double channel)
    {
        var v = channel / 255.0;
        return v <= 0.03928 ? v / 12.92 : Math.Pow((v + 0.055) / 1.055, 2.4);
    }

    /// <summary>Pha kênh màu với trắng theo tỉ lệ <paramref name="towardsWhite"/> (1 = trắng hẳn).</summary>
    private static byte Blend(byte channel, double towardsWhite)
        => (byte)Math.Round(channel + (255 - channel) * towardsWhite);

    private static string Hex(byte r, byte g, byte b) => $"#{r:X2}{g:X2}{b:X2}";
}
