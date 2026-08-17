namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// VỎ email: logo + vạch màu brand + chân trang. Người tuyển dụng KHÔNG bao giờ nhìn thấy
/// phần này — họ chỉ soạn RUỘT (đoạn văn, danh sách, in đậm, link) trong ô soạn thảo.
///
/// <para><b>Vì sao tách:</b> vỏ email phải là bảng &lt;table&gt; + CSS inline + comment MSO thì
/// Outlook mới render đúng. Nhét cả cục đó vào ô soạn thảo giàu định dạng là hỏng: mọi trình
/// soạn thảo (Quill, TinyMCE, contentEditable) đều chuẩn hoá lại HTML và ăn mất bảng, comment
/// điều kiện, preheader. Tách ra thì HR sửa chữ thoải mái mà khung email không bao giờ vỡ.</para>
/// </summary>
public static class EmailLayout
{
    /// <summary>Dấu hiệu người dùng đã dán nguyên một email hoàn chỉnh -> KHÔNG bọc thêm lần nữa.</summary>
    public static bool LooksLikeFullDocument(string? html) =>
        html is not null &&
        (html.Contains("<html", StringComparison.OrdinalIgnoreCase) ||
         html.Contains("<!--[if mso]", StringComparison.OrdinalIgnoreCase) ||
         html.Contains("id=\"bodyTable\"", StringComparison.OrdinalIgnoreCase));

    /// <summary>Mẫu đã tự có ảnh -> vỏ KHÔNG chèn logo nữa (xem <see cref="Wrap"/>).</summary>
    private static bool HasOwnImage(string? html) =>
        html is not null && html.Contains("<img", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Bọc ruột thư vào khung có thương hiệu. Chuỗi trả về vẫn còn placeholder
    /// ({{companyLogoImg}}, {{brandColor}}, {{companyName}}) — thay giá trị ở bước render.
    ///
    /// <para>Vỏ mở đầu bằng <c>&lt;meta charset="utf-8"&gt;</c>: header MIME đã khai utf-8 rồi,
    /// nhưng hễ đoạn HTML bị bóc khỏi phong bì để render riêng là mất khai báo đó, và cả lá thư
    /// tiếng Việt hiện ra dạng "THÆ¯ Má»I NHáº¬N VIá»†C".</para>
    ///
    /// <para><b>Hàng logo tự nhường chỗ:</b> mẫu nào người tuyển dụng đã tự chèn ảnh (banner
    /// riêng cho thư mời, ảnh chào mừng onboarding…) thì vỏ bỏ hàng logo đi. Chèn thêm logo
    /// công ty lên trên ảnh họ vừa đặt là ra hai ảnh chồng nhau ở đầu thư — chưa ai muốn thế,
    /// và họ không có cách nào tắt được vì vỏ này họ không nhìn thấy.</para>
    /// </summary>
    public static string Wrap(string innerHtml)
    {
        if (LooksLikeFullDocument(innerHtml)) return innerHtml;

        var logoRow = HasOwnImage(innerHtml)
            ? ""
            : """
      <tr><td align="center" style="background-color:#FFFFFF;padding:26px 34px 0 34px;">
        {{companyLogoImg}}
      </td></tr>
""";

        return """
<meta charset="utf-8">
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background-color:#F4F4F4;margin:0;padding:24px 0;">
  <tr><td align="center" style="background-color:#F4F4F4;padding:0 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
           style="width:600px;max-width:600px;background-color:#FFFFFF;">
""" + logoRow + """
      <tr><td style="background-color:#FFFFFF;padding:16px 34px 0 34px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="48" height="4" bgcolor="{{brandColor}}" style="font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td></tr>

      <tr><td style="background-color:#FFFFFF;padding:20px 34px 8px 34px;
             font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1F2933;">
""" + innerHtml + """
      </td></tr>

      <tr><td align="center" style="background-color:#FFFFFF;padding:18px 34px 28px 34px;
             font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8A8F98;">
        {{companyName}}
      </td></tr>

    </table>
  </td></tr>
</table>
""";
    }
}
