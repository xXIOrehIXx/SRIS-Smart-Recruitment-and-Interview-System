namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Nội dung KHỞI ĐIỂM cho email onboarding (loại <see cref="EmailTemplateType.Onboarding"/>) —
/// email chào mừng gửi khi hồ sơ sang HIRED, viết theo đúng cách các công ty đang gửi thật:
/// chúc mừng → giờ làm việc → ngày/giờ/địa điểm buổi đầu (kèm chỗ gửi xe, thang máy) →
/// nội dung onboarding → nội quy + kênh mạng xã hội → hồ sơ cần nộp → gửi ảnh → lời kết.
///
/// Đây KHÔNG phải nội dung tự gửi: các mục thực tế mỗi công ty một khác, hệ thống không đoán
/// được. Người tuyển dụng mở trang Mẫu Email, bấm "Dùng mẫu có sẵn" là được điền sẵn khung
/// này, sửa các chỗ trong [ngoặc vuông] rồi bật dùng. Chưa có mẫu ACTIVE thì hệ thống KHÔNG
/// gửi — thà không gửi còn hơn gửi cho ứng viên một lá thư đầy "[điền địa chỉ]".
///
/// <para><b>Viết theo luật của HTML EMAIL, không phải web:</b> bố cục bằng &lt;table&gt;, CSS
/// inline, khổ 600px, có preheader ẩn, khai báo MSO cho Outlook, mọi &lt;td&gt; đặt nền tường
/// minh để dark mode không đảo màu chữ. KHÔNG flexbox/grid/CSS variable — Outlook bỏ qua sạch.</para>
///
/// <para><b>Không nhúng ảnh trang trí</b> (banner, sóng chân trang, icon mạng xã hội):
/// storage của hệ thống chỉ cấp URL có hạn (~1 giờ) nên ảnh nhúng sẽ chết ngay sau đó, còn
/// URL CDN của mẫu gốc là tài sản tài khoản Mailchimp người khác. Thay bằng logo + màu brand
/// công ty đã cấu hình, và các kênh mạng xã hội để dạng LINK CHỮ.</para>
/// </summary>
public static class OnboardingEmailDefault
{
    public const string Subject = "Chào mừng {{candidateName}} gia nhập {{companyName}}!";

    /// <summary>
    /// Placeholder hệ thống tự điền: {{candidateName}}, {{jobTitle}}, {{companyName}},
    /// {{startDate}}, {{companyAddress}}, {{hrEmail}}, {{emailDomain}}, {{brandColor}},
    /// {{companyLogoImg}}. Phần trong [ngoặc vuông] là chỗ người tuyển dụng tự điền một lần.
    /// </summary>
    public const string Body = """
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  Chào mừng bạn đến với {{companyName}} — một vài lưu ý cho ngày làm việc đầu tiên.
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background-color:#F4F4F4;margin:0;padding:24px 0;">
  <tr>
    <td align="center" style="background-color:#F4F4F4;padding:0 12px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
             style="width:600px;max-width:600px;background-color:#FFFFFF;">

        <!-- ===== HEADER: logo công ty ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:28px 40px 0 40px;" align="center">
            {{companyLogoImg}}
          </td>
        </tr>

        <!-- ===== HERO ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:20px 40px 0 40px;" align="left">
            <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;
                       font-weight:800;line-height:1.1;letter-spacing:0.5px;color:#0A456E;">
              WELCOME <span style="color:{{brandColor}};">ONBOARD</span>
            </h1>
            <p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
                      font-style:italic;font-weight:600;color:#0A456E;">
              Bắt đầu hành trình mới cùng {{companyName}}!
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:14px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td width="48" height="4" bgcolor="{{brandColor}}"
                      style="font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- ===== MỞ ĐẦU ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:24px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
            <p style="margin:0 0 14px 0;">Hi <b style="color:{{brandColor}};">{{candidateName}}</b>,</p>
            <p style="margin:0 0 14px 0;">
              Đầu tiên xin chúc mừng bạn đã vượt qua vòng phỏng vấn vị trí
              <b style="color:{{brandColor}};">{{jobTitle}}</b> của {{companyName}} và cảm ơn bạn đã
              lựa chọn {{companyName}} là điểm dừng chân tiếp theo trên con đường phát triển nghề
              nghiệp của mình.
            </p>
            <p style="margin:0;">
              Bộ phận nhân sự gửi tới bạn một số lưu ý nhỏ, giúp bạn tự tin và có được ấn tượng
              tốt đẹp nhất trong ngày làm việc đầu tiên:
            </p>
          </td>
        </tr>

        <!-- ===== 1. THỜI GIAN LÀM VIỆC ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bolder;color:#000000;">
            1. Thời gian làm việc tại {{companyName}}
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
            Thời gian làm việc linh hoạt ([8 tiếng mỗi ngày]) như sau:
            <ul style="margin:8px 0 0 0;padding-left:20px;">
              <li style="margin-bottom:4px;">Thời gian check in buổi sáng: từ [8h00] đến [9h00]</li>
              <li>Thời gian check out buổi chiều: từ [17h30] đến [18h30]</li>
            </ul>
          </td>
        </tr>

        <!-- ===== 2. NGÀY LÀM VIỆC ĐẦU TIÊN ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bolder;color:#000000;">
            2. Ngày làm việc đầu tiên
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
            <p style="margin:0 0 8px 0;">
              Bạn vui lòng có mặt tại công ty lúc
              <b style="color:#0A456E;">[9h00] ngày {{startDate}}</b>.
            </p>
            <p style="margin:0 0 8px 0;">
              <b style="color:#0A456E;">Địa chỉ:</b> {{companyAddress}}
            </p>
            <p style="margin:0 0 4px 0;"><b style="color:#0A456E;">Nơi gửi xe:</b></p>
            <ul style="margin:0 0 8px 0;padding-left:20px;">
              <li style="margin-bottom:4px;">[Gửi xe dưới hầm B… của toà nhà — ghi rõ lối vào]</li>
              <li style="margin-bottom:4px;">
                <b><i>Chú ý:</i></b> [lưu ý riêng của toà nhà, ví dụ xe đạp và xe đạp điện không
                được xuống hầm]
              </li>
              <li>[Chỗ gửi xe thay thế 1] &nbsp;·&nbsp; [Chỗ gửi xe thay thế 2]</li>
            </ul>
            <p style="margin:0;">
              <b style="color:#0A456E;">Thang máy:</b> [hướng dẫn lên văn phòng — tầng, có cần thẻ không]
            </p>
          </td>
        </tr>

        <!-- ===== 3. NỘI DUNG ONBOARDING ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bolder;color:#000000;">
            3. Một số nội dung onboarding
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
            <ul style="margin:0;padding-left:20px;">
              <li style="margin-bottom:4px;">Giới thiệu công ty và các bộ phận liên quan.</li>
              <li style="margin-bottom:4px;">Cấp máy móc, thiết bị, email nội bộ (@{{emailDomain}}).</li>
              <li style="margin-bottom:4px;">Hoàn thành thủ tục onboarding dưới sự điều phối của bộ phận nhân sự.</li>
              <li>Set up vân tay chấm công, chỗ ngồi, dự án,…</li>
            </ul>
          </td>
        </tr>

        <!-- ===== 4. NỘI QUY + KÊNH THÔNG TIN ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bolder;color:#000000;">
            4. Để hiểu về công ty rõ hơn, bạn đọc qua nội quy nhé
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
            <p style="margin:0 0 8px 0;">
              Nội quy {{companyName}}:
              <a href="[dán liên kết nội quy]" target="_blank"
                 style="color:{{brandColor}};text-decoration:underline;">tại đây</a>
            </p>
            <p style="margin:0 0 8px 0;">
              Like và follow các kênh của công ty để cập nhật thông tin mới nhất nhé:
            </p>
            <p style="margin:0;">
              <a href="[link Facebook]" target="_blank"
                 style="color:{{brandColor}};text-decoration:underline;">Facebook</a>
              &nbsp;·&nbsp;
              <a href="[link LinkedIn]" target="_blank"
                 style="color:{{brandColor}};text-decoration:underline;">LinkedIn</a>
              &nbsp;·&nbsp;
              <a href="[link TikTok]" target="_blank"
                 style="color:{{brandColor}};text-decoration:underline;">TikTok</a>
              &nbsp;·&nbsp;
              <a href="[link Website]" target="_blank"
                 style="color:{{brandColor}};text-decoration:underline;">Website</a>
            </p>
          </td>
        </tr>

        <!-- ===== 5. HỒ SƠ CẦN NỘP ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bolder;color:#000000;">
            5. Danh sách hồ sơ và thông tin cần cung cấp cho nhân sự
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
            <ul style="margin:0;padding-left:20px;">
              <li style="margin-bottom:4px;">[Sơ yếu lý lịch có xác nhận địa phương]</li>
              <li style="margin-bottom:4px;">[Bản sao công chứng: CCCD, bằng cấp, bảng điểm]</li>
              <li>[Giấy khám sức khoẻ trong vòng 6 tháng, ảnh 3x4]</li>
            </ul>
            <p style="margin:8px 0 0 0;">Nộp bản cứng vào ngày đầu tiên đi làm.</p>
          </td>
        </tr>

        <!-- ===== 6. ẢNH CÁ NHÂN ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bolder;color:#000000;">
            6. Và cuối cùng
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
            Đừng quên gửi cho chúng mình một chiếc ảnh xinh xắn của bản thân để giới thiệu tới
            các đồng nghiệp khác, bằng cách trả lời email này trước
            <b style="color:#0A456E;">[15h ngày …]</b>.
          </td>
        </tr>

        <!-- ===== KẾT ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:24px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
            <p style="margin:0 0 12px 0;">
              Trên đây là một số ghi chú nhỏ dành cho bạn trước ngày làm việc đầu tiên.
            </p>
            <p style="margin:0 0 12px 0;">
              Hẹn gặp lại bạn vào ngày <b style="color:#0A456E;">{{startDate}}</b> tại
              <b>{{companyName}}</b>.
            </p>
            <p style="margin:0 0 12px 0;">
              Mọi thông tin thắc mắc vui lòng liên hệ bộ phận nhân sự:
              <a href="mailto:{{hrEmail}}" style="color:{{brandColor}};text-decoration:underline;">{{hrEmail}}</a>
            </p>
            <p style="margin:0;font-style:italic;font-weight:bolder;color:#0A456E;">Trân trọng!</p>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:28px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td height="4" bgcolor="{{brandColor}}" style="font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="background-color:#FFFFFF;padding:14px 40px 30px 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8A8F98;">
            {{companyName}}<br>{{companyAddress}}
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
""";
}
