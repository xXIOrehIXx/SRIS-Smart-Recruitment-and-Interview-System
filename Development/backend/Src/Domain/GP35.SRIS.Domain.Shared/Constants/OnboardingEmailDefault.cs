namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Nội dung KHỞI ĐIỂM cho email onboarding (loại <see cref="EmailTemplateType.Onboarding"/>).
///
/// Đây KHÔNG phải nội dung tự gửi: các mục thực tế (giờ làm, chỗ gửi xe, nội quy, hồ sơ cần
/// nộp) mỗi công ty một khác, hệ thống không đoán được. Người tuyển dụng mở trang Mẫu Email,
/// bấm "Dùng mẫu có sẵn" là được điền sẵn khung này, sửa các chỗ trong [ngoặc vuông] rồi bật
/// dùng. Chưa có mẫu ACTIVE thì hệ thống KHÔNG gửi — thà không gửi còn hơn gửi cho ứng viên
/// một lá thư đầy "[điền địa chỉ]".
///
/// <para><b>Viết theo luật của HTML EMAIL, không phải web:</b> bố cục bằng &lt;table&gt;, CSS
/// inline, khổ 600px, có preheader ẩn, khai báo MSO cho Outlook, mọi &lt;td&gt; đặt nền tường
/// minh để dark mode không đảo màu chữ. KHÔNG flexbox/grid/CSS variable — Outlook bỏ qua sạch.</para>
///
/// <para><b>Không nhúng ảnh trang trí</b> (collage, sóng footer, icon mạng xã hội): hệ thống
/// không host được file ảnh cho email, URL tuyệt đối trỏ ra ngoài sẽ vỡ ở mọi tenant. Thay vào
/// đó dùng logo + màu brand công ty đã cấu hình sẵn.</para>
/// </summary>
public static class OnboardingEmailDefault
{
    public const string Subject = "Chào mừng {{candidateName}} gia nhập {{companyName}}!";

    /// <summary>
    /// Placeholder hệ thống tự điền: {{candidateName}}, {{jobTitle}}, {{companyName}},
    /// {{startDate}}, {{companyAddress}}, {{hrEmail}}, {{brandColor}}, {{companyLogoImg}}.
    /// Phần trong [ngoặc vuông] là chỗ người tuyển dụng tự điền một lần cho cả công ty.
    /// </summary>
    public const string Body = """
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  Chào mừng bạn đến với {{companyName}} — một vài lưu ý cho ngày đầu tiên.
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background-color:#F4F6F8;margin:0;padding:24px 0;">
  <tr>
    <td align="center" style="background-color:#F4F6F8;padding:0 12px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
             style="width:600px;max-width:600px;background-color:#FFFFFF;">

        <!-- ===== HEADER: logo + vạch màu brand ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:28px 40px 0 40px;" align="left">
            {{companyLogoImg}}
          </td>
        </tr>

        <!-- ===== HERO ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:20px 40px 0 40px;" align="left">
            <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;
                       font-weight:800;line-height:1.1;letter-spacing:0.5px;color:#0A2A5E;">
              WELCOME <span style="color:{{brandColor}};">ONBOARD</span>
            </h1>
            <p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
                      font-style:italic;font-weight:600;color:#0A2A5E;">
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
                     font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
            <p style="margin:0 0 14px 0;">Chào <b>{{candidateName}}</b>,</p>
            <p style="margin:0 0 14px 0;">
              Đầu tiên xin chúc mừng bạn đã vượt qua vòng phỏng vấn vị trí <b>{{jobTitle}}</b>
              của {{companyName}}, và cảm ơn bạn đã chọn {{companyName}} là điểm dừng chân tiếp
              theo trên con đường phát triển nghề nghiệp của mình.
            </p>
            <p style="margin:0;">
              Bộ phận nhân sự gửi bạn vài lưu ý nhỏ để ngày làm việc đầu tiên thật suôn sẻ:
            </p>
          </td>
        </tr>

        <!-- ===== 1. THỜI GIAN LÀM VIỆC ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0A2A5E;">
            1. Thời gian làm việc tại {{companyName}}
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
            Thời gian làm việc linh hoạt [8 tiếng mỗi ngày] như sau:
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                   style="margin-top:8px;">
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Giờ vào buổi sáng: từ [8h00] đến [9h00]
                </td>
              </tr>
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Giờ về buổi chiều: từ [17h30] đến [18h30]
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== 2. NGÀY LÀM VIỆC ĐẦU TIÊN ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0A2A5E;">
            2. Ngày làm việc đầu tiên
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
            Bạn vui lòng có mặt tại công ty lúc <b>[9h00] ngày {{startDate}}</b>.
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                   style="margin-top:8px;">
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Địa chỉ: <span style="color:#2E75B6;">{{companyAddress}}</span>
                </td>
              </tr>
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Nơi gửi xe: [hướng dẫn chỗ gửi xe — hầm/bãi ngoài, xe máy và xe đạp]
                </td>
              </tr>
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Lên văn phòng: [tầng, thang máy, có cần thẻ ra vào không]
                </td>
              </tr>
            </table>
            <p style="margin:10px 0 0 0;font-style:italic;font-weight:700;color:#0A2A5E;">
              Chú ý: [lưu ý riêng của toà nhà, ví dụ xe đạp không được xuống hầm]
            </p>
          </td>
        </tr>

        <!-- ===== 3. NỘI DUNG ONBOARDING ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0A2A5E;">
            3. Một số nội dung onboarding
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Giới thiệu công ty và các bộ phận liên quan
                </td>
              </tr>
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Cấp máy móc, thiết bị và tài khoản email nội bộ
                </td>
              </tr>
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Hoàn thành thủ tục nhận việc với bộ phận nhân sự
                </td>
              </tr>
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  Đăng ký chấm công, sắp xếp chỗ ngồi, giới thiệu dự án
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== 4. NỘI QUY ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0A2A5E;">
            4. Nội quy công ty
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
            Bạn đọc trước sổ tay nhân viên tại:
            <a href="[dán liên kết nội quy]" target="_blank"
               style="color:#2E75B6;text-decoration:underline;">tại đây</a>.
          </td>
        </tr>

        <!-- ===== 5. HỒ SƠ CẦN CHUẨN BỊ ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0A2A5E;">
            5. Hồ sơ cần chuẩn bị
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
            Nộp bản cứng trong ngày đầu đi làm:
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                   style="margin-top:8px;">
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  [Sơ yếu lý lịch có xác nhận địa phương]
                </td>
              </tr>
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  [Bản sao công chứng: CCCD, bằng cấp, bảng điểm]
                </td>
              </tr>
              <tr>
                <td width="16" valign="top" style="font-size:14px;line-height:1.6;color:{{brandColor}};">&bull;</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
                  [Giấy khám sức khoẻ trong vòng 6 tháng, ảnh 3x4]
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== 6. ẢNH CÁ NHÂN ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:22px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0A2A5E;">
            6. Và cuối cùng
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:8px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
            Đừng quên gửi cho chúng mình một tấm ảnh xinh xắn của bạn để giới thiệu với cả nhà,
            bằng cách trả lời email này trước <b>[ngày]</b> nhé.
          </td>
        </tr>

        <!-- ===== KẾT ===== -->
        <tr>
          <td style="background-color:#FFFFFF;padding:24px 40px 0 40px;
                     font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
            <p style="margin:0 0 12px 0;">
              Trên đây là vài ghi chú nhỏ dành cho bạn trước ngày làm việc đầu tiên.
              Hẹn gặp bạn ngày <b>{{startDate}}</b> tại <b>{{companyName}}</b>.
            </p>
            <p style="margin:0 0 12px 0;">
              Mọi thắc mắc bạn liên hệ bộ phận nhân sự qua
              <a href="mailto:{{hrEmail}}" style="color:#2E75B6;text-decoration:underline;">{{hrEmail}}</a>.
            </p>
            <p style="margin:0;font-style:italic;font-weight:700;color:#0A2A5E;">Trân trọng!</p>
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
