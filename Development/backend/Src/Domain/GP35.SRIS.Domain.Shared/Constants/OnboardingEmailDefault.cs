namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Nội dung KHỞI ĐIỂM cho email onboarding (loại <see cref="EmailTemplateType.Onboarding"/>) —
/// email chào mừng gửi khi hồ sơ sang HIRED, viết theo đúng cách các công ty đang gửi thật:
/// chúc mừng → giờ làm việc → ngày/giờ/địa điểm buổi đầu (kèm chỗ gửi xe, thang máy) →
/// nội dung onboarding → nội quy + kênh công ty → hồ sơ cần nộp → gửi ảnh → lời kết.
///
/// <para>Chỉ là RUỘT thư — logo, vạch màu brand, chân trang do <see cref="EmailLayout"/> bọc
/// lúc gửi. Người tuyển dụng soạn trong ô soạn thảo giàu định dạng, không nhìn thấy HTML khung.</para>
///
/// Các mục thực tế mỗi công ty một khác nên để trong [ngoặc vuông] cho người tuyển dụng điền
/// một lần. Mẫu này seed ở trạng thái TẮT: chưa sửa xong mà gửi thì ứng viên nhận thư còn
/// nguyên "[điền địa chỉ]".
/// </summary>
public static class OnboardingEmailDefault
{
    public const string Subject = "Chào mừng {{candidateName}} gia nhập {{companyName}}!";

    /// <summary>
    /// Placeholder hệ thống tự điền: {{candidateName}}, {{jobTitle}}, {{companyName}},
    /// {{startDate}}, {{companyAddress}}, {{hrEmail}}, {{emailDomain}}.
    /// </summary>
    public const string Body = """
<p>Chào <b>{{candidateName}}</b>,</p>

<p>Đầu tiên xin chúc mừng bạn đã vượt qua vòng phỏng vấn vị trí <b>{{jobTitle}}</b> của
{{companyName}} và cảm ơn bạn đã lựa chọn {{companyName}} là điểm dừng chân tiếp theo trên con
đường phát triển nghề nghiệp của mình.</p>

<p>Bộ phận nhân sự gửi tới bạn một số lưu ý nhỏ, giúp bạn tự tin và có được ấn tượng tốt đẹp
nhất trong ngày làm việc đầu tiên:</p>

<p><b>1. Thời gian làm việc tại {{companyName}}</b></p>
<p>Thời gian làm việc linh hoạt ([8 tiếng mỗi ngày]) như sau:</p>
<ul>
  <li>Thời gian check in buổi sáng: từ [8h00] đến [9h00]</li>
  <li>Thời gian check out buổi chiều: từ [17h30] đến [18h30]</li>
</ul>

<p><b>2. Ngày làm việc đầu tiên</b></p>
<p>Bạn vui lòng có mặt tại công ty lúc <b>[9h00] ngày {{startDate}}</b>.</p>
<p><b>Địa chỉ:</b> {{companyAddress}}</p>
<p><b>Nơi gửi xe:</b></p>
<ul>
  <li>[Gửi xe dưới hầm B… của toà nhà — ghi rõ lối vào]</li>
  <li><b><i>Chú ý:</i></b> [lưu ý riêng của toà nhà, ví dụ xe đạp và xe đạp điện không được xuống hầm]</li>
  <li>[Chỗ gửi xe thay thế 1] · [Chỗ gửi xe thay thế 2]</li>
</ul>
<p><b>Thang máy:</b> [hướng dẫn lên văn phòng — tầng, có cần thẻ không]</p>

<p><b>3. Một số nội dung onboarding</b></p>
<ul>
  <li>Giới thiệu công ty và các bộ phận liên quan.</li>
  <li>Cấp máy móc, thiết bị, email nội bộ (@{{emailDomain}}).</li>
  <li>Hoàn thành thủ tục onboarding dưới sự điều phối của bộ phận nhân sự.</li>
  <li>Set up vân tay chấm công, chỗ ngồi, dự án,…</li>
</ul>

<p><b>4. Để hiểu về công ty rõ hơn, bạn đọc qua nội quy nhé</b></p>
<p>Nội quy {{companyName}}: <a href="[dán liên kết nội quy]" target="_blank">tại đây</a></p>
<p>Like và follow các kênh của công ty để cập nhật thông tin mới nhất:
<a href="[link Facebook]" target="_blank">Facebook</a> ·
<a href="[link LinkedIn]" target="_blank">LinkedIn</a> ·
<a href="[link TikTok]" target="_blank">TikTok</a> ·
<a href="[link Website]" target="_blank">Website</a></p>

<p><b>5. Danh sách hồ sơ và thông tin cần cung cấp cho nhân sự</b></p>
<ul>
  <li>[Sơ yếu lý lịch có xác nhận địa phương]</li>
  <li>[Bản sao công chứng: CCCD, bằng cấp, bảng điểm]</li>
  <li>[Giấy khám sức khoẻ trong vòng 6 tháng, ảnh 3x4]</li>
</ul>
<p>Nộp bản cứng vào ngày đầu tiên đi làm.</p>

<p><b>6. Và cuối cùng</b></p>
<p>Đừng quên gửi cho chúng mình một chiếc ảnh xinh xắn của bản thân để giới thiệu tới các đồng
nghiệp khác, bằng cách trả lời email này trước <b>[15h ngày …]</b>.</p>

<p>Trên đây là một số ghi chú nhỏ dành cho bạn trước ngày làm việc đầu tiên. Hẹn gặp lại bạn vào
ngày <b>{{startDate}}</b> tại <b>{{companyName}}</b>.</p>

<p>Mọi thông tin thắc mắc vui lòng liên hệ bộ phận nhân sự: <a href="mailto:{{hrEmail}}">{{hrEmail}}</a></p>

<p><i><b>Trân trọng!</b></i></p>
""";
}
