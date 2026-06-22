using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>Ghi chú nội bộ trên hồ sơ (docs "Activity Log & Internal Notes"). Nội bộ, không gửi ứng viên.</summary>
public class InternalNoteService : BaseService<InternalNoteService>, IInternalNoteService
{
    private const int MaxContentLength = 4000;

    private readonly IInternalNoteRepo _noteRepo;
    private readonly IApplicationRepo _appRepo;
    private readonly ILogger _logger;

    public InternalNoteService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _noteRepo = serviceProvider.GetRequiredService<IInternalNoteRepo>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<InternalNoteService>();
    }

    public async Task<InternalNoteDto> AddAsync(long companyId, long userId, long applicationId, CreateNoteDto dto)
    {
        var content = (dto?.Content ?? "").Trim();
        if (string.IsNullOrWhiteSpace(content))
            throw Bad("Nội dung ghi chú không được để trống.");
        if (content.Length > MaxContentLength)
            throw Bad($"Ghi chú tối đa {MaxContentLength} ký tự.");

        // Hồ sơ phải tồn tại trong tenant (tránh ghi chú treo vào hồ sơ không thuộc công ty).
        _ = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        var note = new InternalNote
        {
            ApplicationId = applicationId,
            UserId = userId,
            Content = content
        };
        note.NoteId = await _noteRepo.InsertAsync(companyId, note);

        _logger.Information("InternalNote: user {UserId} thêm ghi chú {NoteId} vào hồ sơ {AppId}.",
            userId, note.NoteId, applicationId);

        var rows = await _noteRepo.GetByApplicationAsync(companyId, applicationId);
        var created = rows.FirstOrDefault(r => r.NoteId == note.NoteId);
        return Map(applicationId, created, note);
    }

    public async Task<IReadOnlyList<InternalNoteDto>> GetByApplicationAsync(long companyId, long applicationId)
    {
        var rows = await _noteRepo.GetByApplicationAsync(companyId, applicationId);
        return rows.Select(r => new InternalNoteDto
        {
            NoteId = r.NoteId,
            ApplicationId = applicationId,
            AuthorId = r.UserId,
            AuthorEmail = r.AuthorEmail,
            Content = r.Content,
            CreatedAt = r.CreatedAt
        }).ToList();
    }

    // ============================================================

    private static InternalNoteDto Map(long applicationId, InternalNoteRow? row, InternalNote fallback) => new()
    {
        NoteId = fallback.NoteId,
        ApplicationId = applicationId,
        AuthorId = fallback.UserId,
        AuthorEmail = row?.AuthorEmail,
        Content = fallback.Content,
        CreatedAt = row?.CreatedAt ?? DateTime.UtcNow
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
