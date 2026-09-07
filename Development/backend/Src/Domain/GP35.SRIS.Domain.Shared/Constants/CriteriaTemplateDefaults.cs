namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>1 dòng tiêu chí trong khuôn dựng sẵn (trọng số tương đối + thang điểm).</summary>
public record CriteriaTemplateItemSeed(string Name, decimal Weight, decimal MaxScore = 10);

/// <summary>1 khuôn tiêu chí dựng sẵn.</summary>
public record CriteriaTemplateSeed(string Name, string Description, IReadOnlyList<CriteriaTemplateItemSeed> Items);

/// <summary>
/// BỘ KHUÔN TIÊU CHÍ DỰNG SẴN — công ty mới mở màn Tiêu Chí là có ngay thư viện để áp vào tin
/// tuyển dụng, thay vì bảng trống (cùng ý với <see cref="EmailTemplateDefaults"/>).
///
/// <para>Khuôn trải khắp các nhóm vị trí một công ty nhỏ hay tuyển — KHÔNG chỉ IT (docs: hệ
/// thống tuyển mọi vị trí). Áp khuôn vào job = clone sang EvaluationCriteria APPROVED, sửa
/// riêng cho từng job sau được.</para>
///
/// <para><b>Chỉ đặt thứ PHẢI HỎI MỚI BIẾT</b> — cùng luật với prompt bóc tiêu chí (5.18):
/// bằng cấp, chứng chỉ, bằng lái đã được đối chiếu ở bước sàng lọc hồ sơ và không ai cho điểm
/// 0-10 dòng "có bằng B2". Mỗi dòng ở đây phải là thứ người phỏng vấn ngồi nghe rồi chấm được.</para>
///
/// <para>Trọng số là số TƯƠNG ĐỐI (FE quy ra phần trăm cộng đủ 100 — xem
/// <c>utils/criteriaWeight.js</c>), nên 3/2/1 đọc là "quan trọng gấp 3 / gấp 2 / một phần".</para>
/// </summary>
public static class CriteriaTemplateDefaults
{
    public static IReadOnlyList<CriteriaTemplateSeed> All => new[]
    {
        new CriteriaTemplateSeed(
            "Lập trình viên",
            "Khung chấm cho vị trí kỹ thuật phần mềm (dev, tester, IT). Nặng về chuyên môn và cách xử lý vấn đề.",
            new[]
            {
                new CriteriaTemplateItemSeed("Kiến thức chuyên môn và công nghệ sử dụng", 3),
                new CriteriaTemplateItemSeed("Tư duy phân tích, giải quyết vấn đề", 3),
                new CriteriaTemplateItemSeed("Kinh nghiệm dự án đã làm (vai trò, phần tự làm)", 2),
                new CriteriaTemplateItemSeed("Khả năng tự học công nghệ mới", 1),
                new CriteriaTemplateItemSeed("Giao tiếp và phối hợp trong nhóm", 1),
            }),

        new CriteriaTemplateSeed(
            "Nhân viên kinh doanh",
            "Khung chấm cho sales, telesales, phát triển thị trường. Nặng về khả năng tiếp cận khách và chốt đơn.",
            new[]
            {
                new CriteriaTemplateItemSeed("Kỹ năng tìm kiếm và tiếp cận khách hàng", 3),
                new CriteriaTemplateItemSeed("Kỹ năng thuyết phục, đàm phán, chốt đơn", 3),
                new CriteriaTemplateItemSeed("Hiểu biết sản phẩm và thị trường ngành", 2),
                new CriteriaTemplateItemSeed("Khả năng chịu áp lực doanh số", 2),
                new CriteriaTemplateItemSeed("Thái độ chủ động, tinh thần cầu tiến", 1),
            }),

        new CriteriaTemplateSeed(
            "Kế toán",
            "Khung chấm cho kế toán viên, kế toán tổng hợp. Nặng về nghiệp vụ và độ cẩn thận với số liệu.",
            new[]
            {
                new CriteriaTemplateItemSeed("Nghiệp vụ kế toán, thuế theo phần hành ứng tuyển", 3),
                new CriteriaTemplateItemSeed("Độ cẩn thận, chính xác khi xử lý số liệu", 3),
                new CriteriaTemplateItemSeed("Thành thạo phần mềm kế toán và Excel", 2),
                new CriteriaTemplateItemSeed("Khả năng chịu áp lực kỳ quyết toán, chốt sổ", 1),
                new CriteriaTemplateItemSeed("Tính trung thực, ý thức bảo mật số liệu", 1),
            }),

        new CriteriaTemplateSeed(
            "Chăm sóc khách hàng",
            "Khung chấm cho CSKH, lễ tân, hỗ trợ khách. Nặng về giao tiếp và xử lý tình huống.",
            new[]
            {
                new CriteriaTemplateItemSeed("Kỹ năng giao tiếp và lắng nghe khách hàng", 3),
                new CriteriaTemplateItemSeed("Xử lý tình huống khách phàn nàn, khách khó tính", 3),
                new CriteriaTemplateItemSeed("Kiên nhẫn, kiểm soát cảm xúc khi làm việc", 2),
                new CriteriaTemplateItemSeed("Nắm bắt sản phẩm, dịch vụ của công ty", 1),
                new CriteriaTemplateItemSeed("Khả năng làm việc theo ca, ngoài giờ", 1),
            }),

        new CriteriaTemplateSeed(
            "Marketing",
            "Khung chấm cho marketing, content, chạy quảng cáo. Nặng về ý tưởng và khả năng đo hiệu quả.",
            new[]
            {
                new CriteriaTemplateItemSeed("Tư duy nội dung và khả năng sáng tạo", 3),
                new CriteriaTemplateItemSeed("Kinh nghiệm triển khai chiến dịch (kênh, ngân sách, kết quả)", 2),
                new CriteriaTemplateItemSeed("Khả năng đọc và dùng số liệu để điều chỉnh", 2),
                new CriteriaTemplateItemSeed("Sử dụng công cụ marketing, thiết kế cơ bản", 2),
                new CriteriaTemplateItemSeed("Phối hợp với kinh doanh và các bộ phận khác", 1),
            }),

        new CriteriaTemplateSeed(
            "Kho vận - Vận hành",
            "Khung chấm cho nhân viên kho, giao nhận, vận hành. Nặng về tuân thủ quy trình và sự cẩn thận.",
            new[]
            {
                new CriteriaTemplateItemSeed("Kinh nghiệm quản lý hàng hóa, kiểm kê tồn kho", 3),
                new CriteriaTemplateItemSeed("Tính cẩn thận, tuân thủ quy trình và an toàn lao động", 3),
                new CriteriaTemplateItemSeed("Sức khỏe, khả năng làm ca và làm ngoài giờ", 2),
                new CriteriaTemplateItemSeed("Sử dụng phần mềm kho, thiết bị kiểm hàng", 1),
                new CriteriaTemplateItemSeed("Phối hợp với bộ phận kinh doanh, giao nhận", 1),
            }),

        new CriteriaTemplateSeed(
            "Hành chính - Nhân sự",
            "Khung chấm cho hành chính, nhân sự, trợ lý văn phòng. Nặng về tổ chức công việc và giao tiếp nội bộ.",
            new[]
            {
                new CriteriaTemplateItemSeed("Nghiệp vụ hành chính, nhân sự theo mảng ứng tuyển", 3),
                new CriteriaTemplateItemSeed("Kỹ năng tổ chức, sắp xếp và theo dõi công việc", 3),
                new CriteriaTemplateItemSeed("Giao tiếp nội bộ, xử lý yêu cầu của các bộ phận", 2),
                new CriteriaTemplateItemSeed("Tin học văn phòng và soạn thảo văn bản", 1),
                new CriteriaTemplateItemSeed("Cẩn trọng, giữ kín thông tin nhân sự", 1),
            }),

        new CriteriaTemplateSeed(
            "Trưởng nhóm - Quản lý",
            "Khung chấm cho vị trí có quản lý người: tổ trưởng, trưởng nhóm, trưởng bộ phận.",
            new[]
            {
                new CriteriaTemplateItemSeed("Năng lực dẫn dắt, phân việc cho đội nhóm", 3),
                new CriteriaTemplateItemSeed("Kinh nghiệm quản lý (quy mô nhóm, kết quả đạt được)", 2),
                new CriteriaTemplateItemSeed("Tư duy lập kế hoạch và theo dõi tiến độ", 2),
                new CriteriaTemplateItemSeed("Xử lý xung đột, giữ người trong nhóm", 2),
                new CriteriaTemplateItemSeed("Chuyên môn đủ sâu để hướng dẫn nhân viên", 1),
            }),

        new CriteriaTemplateSeed(
            "Thực tập sinh - Mới ra trường",
            "Khung chấm cho thực tập sinh, fresher. Chấm tiềm năng và thái độ thay vì kinh nghiệm.",
            new[]
            {
                new CriteriaTemplateItemSeed("Kiến thức nền tảng của ngành đã học", 3),
                new CriteriaTemplateItemSeed("Tinh thần học hỏi, tiếp thu góp ý", 3),
                new CriteriaTemplateItemSeed("Thái độ nghiêm túc và thời gian cam kết gắn bó", 2),
                new CriteriaTemplateItemSeed("Kỹ năng giao tiếp, trình bày ý kiến", 1),
                new CriteriaTemplateItemSeed("Định hướng nghề nghiệp rõ ràng", 1),
            }),
    };
}
