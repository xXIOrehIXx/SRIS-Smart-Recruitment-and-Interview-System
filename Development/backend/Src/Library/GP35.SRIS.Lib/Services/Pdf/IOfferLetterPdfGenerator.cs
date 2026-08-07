namespace GP35.SRIS.Lib.Services.Pdf;

/// <summary>Sinh file PDF thư mời nhận việc từ <see cref="OfferLetterModel"/> (docs 5.15).</summary>
public interface IOfferLetterPdfGenerator
{
    /// <summary>Trả về nội dung file PDF (bytes) — không ghi ra đĩa, không đụng storage.</summary>
    byte[] Generate(OfferLetterModel model);

    /// <summary>Tên file gợi ý, vd "Thu-moi-nhan-viec-Nguyen-Van-A.pdf" (đã bỏ dấu, an toàn cho HTTP header).</summary>
    string BuildFileName(OfferLetterModel model);
}
