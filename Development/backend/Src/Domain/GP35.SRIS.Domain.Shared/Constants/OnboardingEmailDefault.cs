namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Nội dung MẶC ĐỊNH của email onboarding (loại <see cref="EmailTemplateType.Onboarding"/>) —
/// email chào mừng gửi kèm thư chúc mừng khi hồ sơ sang HIRED.
///
/// <para>Bản này GỬI ĐƯỢC NGAY (15/09/2026): chỉ dùng thông tin hệ thống tự có — ngày vào làm lấy
/// từ thư mời, địa chỉ công ty, email nhân sự. Bản trước đầy chỗ "[điền tay]" (giờ check-in, chỗ
/// gửi xe, link nội quy…) nên phải seed ở trạng thái TẮT, và công ty nào chưa kịp sửa thì ứng
/// viên trúng tuyển KHÔNG nhận được thư chào mừng nào — với công ty nhỏ, gần như là không bao giờ.
/// Công ty muốn thêm giờ làm, chỗ gửi xe, nội quy… thì soạn mẫu riêng ở màn Mẫu Email và bật lên;
/// mẫu đang bật luôn thắng bản này.</para>
///
/// <para>Chỉ là RUỘT thư — logo, vạch màu brand, chân trang do <see cref="EmailLayout"/> bọc
/// lúc gửi. Người tuyển dụng soạn trong ô soạn thảo giàu định dạng, không nhìn thấy HTML khung.</para>
/// </summary>
public static class OnboardingEmailDefault
{
    public const string Subject = "Chào mừng {{candidateName}} gia nhập {{companyName}}!";

    /// <summary>
    /// Placeholder hệ thống tự điền: {{candidateName}}, {{jobTitle}}, {{companyName}},
    /// {{startDate}}, {{companyAddress}}, {{hrEmail}} ({{emailDomain}} vẫn dùng được trong mẫu riêng).
    /// </summary>
    public const string Body = """
<p>Chào <b>{{candidateName}}</b>,</p>

<p>Chúc mừng bạn chính thức gia nhập <b>{{companyName}}</b> ở vị trí <b>{{jobTitle}}</b>! Cảm ơn
bạn đã chọn {{companyName}} là điểm dừng chân tiếp theo trên con đường phát triển nghề nghiệp
của mình.</p>

<p>Bộ phận nhân sự gửi bạn một số thông tin để bạn chuẩn bị cho ngày làm việc đầu tiên:</p>

<p><b>1. Ngày làm việc đầu tiên</b></p>
<ul>
  <li><b>Ngày bắt đầu:</b> {{startDate}}</li>
  <li><b>Địa điểm:</b> {{companyAddress}}</li>
</ul>

<p><b>2. Trong ngày đầu tiên, bạn sẽ</b></p>
<ul>
  <li>Được giới thiệu về công ty và các bộ phận liên quan.</li>
  <li>Nhận máy móc, thiết bị và tài khoản làm việc.</li>
  <li>Hoàn thành thủ tục nhận việc cùng bộ phận nhân sự.</li>
</ul>

<p><b>3. Giấy tờ bạn nên mang theo</b></p>
<ul>
  <li>Căn cước công dân (bản gốc để đối chiếu).</li>
  <li>Bản sao bằng cấp, chứng chỉ liên quan tới vị trí.</li>
  <li>Thông tin tài khoản ngân hàng để nhận lương.</li>
</ul>
<p>Nếu cần thêm giấy tờ nào khác, bộ phận nhân sự sẽ báo bạn trước ngày đi làm.</p>

<p>Mọi thắc mắc bạn cứ trả lời email này hoặc liên hệ bộ phận nhân sự: {{hrEmail}}</p>

<p>Hẹn gặp bạn tại <b>{{companyName}}</b>!</p>

<p><i><b>Trân trọng!</b></i></p>
""";
}
