using System.Net;
using System.Text.Json;
using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Excel;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>Đọc hồ sơ cho Kanban + chi tiết ứng viên (5.16). Chỉ đọc, không đổi state.</summary>
public class ApplicationQueryService : BaseService<ApplicationQueryService>, IApplicationQueryService
{
    private readonly IApplicationRepo _appRepo;
    private readonly IJobRepo _jobRepo;
    private readonly ICompanyRepo _companyRepo;
    private readonly ICandidateExcelExporter _exporter;

    public ApplicationQueryService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _exporter = serviceProvider.GetRequiredService<ICandidateExcelExporter>();
    }

    public async Task<ApplicationBoardDto> GetBoardByJobAsync(
        long companyId, long jobId, BoardSort sort = BoardSort.Recent)
    {
        var rows = await _appRepo.GetBoardByJobAsync(companyId, jobId, sort);
        return new ApplicationBoardDto
        {
            JobId = jobId,
            Sort = sort == BoardSort.Fit ? "fit" : "recent",
            Applications = rows.Select(r => new ApplicationCardDto
            {
                ApplicationId = r.ApplicationId,
                CandidateId = r.CandidateId,
                CandidateName = r.CandidateName,
                CandidateEmail = r.CandidateEmail,
                CurrentState = r.CurrentState,
                CvId = r.CvId,
                AppliedAt = r.AppliedAt,
                ScreeningStatus = r.ScreeningStatus,
                FitScore = r.FitScore,
                ScreeningDecision = r.ScreeningDecision
            }).ToList()
        };
    }

    public async Task<ApplicationDetailDto> GetDetailAsync(long companyId, long applicationId)
    {
        var r = await _appRepo.GetDetailAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        return new ApplicationDetailDto
        {
            ApplicationId = r.ApplicationId,
            CurrentState = r.CurrentState,
            RejectReason = r.RejectReason,
            AppliedAt = r.AppliedAt,
            StageUpdatedAt = r.StageUpdatedAt,
            CandidateId = r.CandidateId,
            CandidateName = r.CandidateName,
            CandidateEmail = r.CandidateEmail,
            CandidatePhone = r.CandidatePhone,
            CandidateSource = r.CandidateSource,
            JobId = r.JobId,
            JobTitle = r.JobTitle,
            CvId = r.CvId,
            CvFileName = r.CvFileName,
            CvParseStatus = r.CvParseStatus
        };
    }

    public async Task<(byte[] Content, string FileName)> ExportByJobAsync(long companyId, long jobId)
    {
        var job = await _jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy vị trí (job_id={jobId}).");
        var company = await _companyRepo.GetByCompanyId(companyId);
        var rows = await _appRepo.GetExportRowsByJobAsync(companyId, jobId);

        var model = new CandidateExportModel
        {
            JobTitle = job.Title,
            CompanyName = company?.Name,
            // Giờ ĐỊA PHƯƠNG: file này người ta mở ra đọc, không phải để máy so sánh mốc thời gian.
            ExportedAt = DateTime.Now,
            Rows = rows.Select(r => new CandidateExportRow
            {
                CandidateName = r.CandidateName,
                CandidateEmail = r.CandidateEmail,
                CandidatePhone = r.CandidatePhone,
                Source = r.CandidateSource,
                StateLabel = StateLabel(r.CurrentState),
                RejectReason = r.RejectReason,
                AppliedAt = r.AppliedAt,
                CvFileName = r.CvFileName,
                FitScore = r.FitScore,
                FitLabel = FitLabel(r.ScreeningStatus, r.ScreeningDecision),
                Summary = r.ScreeningSummary,
                Matched = FormatMatched(r.MatchedJson),
                Missing = FormatMissing(r.MissingJson)
            }).ToList()
        };

        return (_exporter.Generate(model), _exporter.BuildFileName(model));
    }

    /// <summary>
    /// Nhãn 4 pha cho người đọc file — mã state là chuyện nội bộ, không xuất ra ngoài.
    /// Bản sao của <c>components/ApplicationStateTag.jsx</c> bên FE; file Excel do backend
    /// dựng nên không dùng lại được bảng nhãn đó. Sửa nhãn thì sửa CẢ HAI.
    /// </summary>
    private static string StateLabel(string state) => (state ?? "").Trim().ToUpperInvariant() switch
    {
        ApplicationState.New => "Tiếp nhận & sàng lọc",
        ApplicationState.Screening => "Chờ Trưởng bộ phận duyệt",
        ApplicationState.Interview => "Phỏng vấn",
        ApplicationState.Offer => "Quyết định",
        ApplicationState.Hired => "Đã tuyển",
        ApplicationState.Rejected => "Từ chối",
        _ => state ?? ""
    };

    /// <summary>
    /// Chữ đi kèm điểm phù hợp (V046: không để con số đứng trần). "Chưa phân tích" là một ca
    /// RIÊNG, không phải "ít phù hợp" — hồ sơ chưa ai đọc thì chưa có nhận định nào cả.
    /// </summary>
    private static string FitLabel(string? screeningStatus, string? decision)
    {
        if (!string.Equals(screeningStatus, ScreeningStatus.Done, StringComparison.OrdinalIgnoreCase))
            return "Chưa phân tích";

        return (decision ?? "").Trim().ToUpperInvariant() switch
        {
            ScreeningDecision.Proceed => "Nên mời",
            ScreeningDecision.Consider => "Cân nhắc",
            ScreeningDecision.Reject => "Ít phù hợp",
            _ => "Chưa phân tích"
        };
    }

    /// <summary>
    /// [{"requirement","evidence"}] -> mỗi dòng "• yêu cầu — trích dẫn". Giữ NGUYÊN câu trích:
    /// đó là thứ để người đọc kiểm chứng AI, bỏ đi thì cột "đạt" chỉ còn là lời của model.
    /// </summary>
    private static string? FormatMatched(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return null;

            var lines = doc.RootElement.EnumerateArray().Select(el =>
            {
                var req = el.TryGetProperty("requirement", out var r) ? r.GetString() : null;
                var evi = el.TryGetProperty("evidence", out var e) ? e.GetString() : null;
                return string.IsNullOrWhiteSpace(evi) ? $"• {req}" : $"• {req} — “{evi}”";
            }).Where(l => l.Length > 2);

            var text = string.Join("\n", lines);
            return text.Length == 0 ? null : text;
        }
        catch (JsonException)
        {
            // Dòng JSON hỏng không được làm rớt cả file xuất — cột đó để trống là đủ.
            return null;
        }
    }

    /// <summary>["..."] -> mỗi dòng một gạch đầu dòng.</summary>
    private static string? FormatMissing(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return null;

            var lines = doc.RootElement.EnumerateArray()
                .Select(el => el.GetString())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => $"• {x}");

            var text = string.Join("\n", lines);
            return text.Length == 0 ? null : text;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
