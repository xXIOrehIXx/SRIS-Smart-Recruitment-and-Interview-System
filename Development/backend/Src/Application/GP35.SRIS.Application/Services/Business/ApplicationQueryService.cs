using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>Đọc hồ sơ cho Kanban + chi tiết ứng viên (5.16). Chỉ đọc, không đổi state.</summary>
public class ApplicationQueryService : BaseService<ApplicationQueryService>, IApplicationQueryService
{
    private readonly IApplicationRepo _appRepo;

    public ApplicationQueryService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
    }

    public async Task<ApplicationBoardDto> GetBoardByJobAsync(long companyId, long jobId)
    {
        var rows = await _appRepo.GetBoardByJobAsync(companyId, jobId);
        return new ApplicationBoardDto
        {
            JobId = jobId,
            Applications = rows.Select(r => new ApplicationCardDto
            {
                ApplicationId = r.ApplicationId,
                CandidateId = r.CandidateId,
                CandidateName = r.CandidateName,
                CandidateEmail = r.CandidateEmail,
                CurrentState = r.CurrentState,
                AiMatchScore = r.AiMatchScore,
                CriteriaScore = r.CriteriaScore,
                CvId = r.CvId,
                AppliedAt = r.AppliedAt
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
            AiMatchScore = r.AiMatchScore,
            CriteriaScore = r.CriteriaScore,
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

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
