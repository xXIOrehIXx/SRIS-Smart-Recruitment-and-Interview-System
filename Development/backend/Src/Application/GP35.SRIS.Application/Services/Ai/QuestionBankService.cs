using GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;

namespace GP35.SRIS.Application.Services.Ai;

/// <summary>
/// Xem/quản lý ngân hàng câu hỏi đã duyệt (5.6 / Việc 12). Việc "ghim" câu vào bank xảy ra
/// tự động khi duyệt quiz (QuizService.ApproveAsync); việc "kéo câu từ bank" nằm ở QuizService.
/// </summary>
public class QuestionBankService : BaseService<QuestionBankService>, IQuestionBankService
{
    private readonly IQuestionBankRepo _bankRepo;

    public QuestionBankService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _bankRepo = serviceProvider.GetRequiredService<IQuestionBankRepo>();
    }

    public async Task<QuestionBankSearchResultDto> SearchAsync(
        long companyId, string? topic, string? search, int page = 1, int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var (items, total) = await _bankRepo.SearchAsync(
            companyId, topic, search, skip: (page - 1) * pageSize, take: pageSize);

        return new QuestionBankSearchResultDto
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items.Select(Map).ToList()
        };
    }

    public Task<bool> DeactivateAsync(long companyId, long bankItemId) =>
        _bankRepo.DeactivateAsync(companyId, bankItemId);

    private static QuestionBankItemDto Map(QuestionBankItem b) => new()
    {
        BankItemId = b.BankItemId,
        Content = b.Content,
        Options = JsonConvert.DeserializeObject<List<string>>(b.OptionsJson) ?? new List<string>(),
        CorrectIndex = LabelToIndex(b.CorrectOption),
        Topic = b.Topic,
        Difficulty = b.Difficulty,
        TimesUsed = b.TimesUsed,
        ApprovedAt = b.ApprovedAt
    };

    /// <summary>"A" -> 0, "B" -> 1 ... Trả 0 nếu nhãn không hợp lệ (correct_option lưu nhãn chữ).</summary>
    private static int LabelToIndex(string? label)
    {
        if (string.IsNullOrWhiteSpace(label)) return 0;
        var idx = char.ToUpperInvariant(label.Trim()[0]) - 'A';
        return idx >= 0 ? idx : 0;
    }
}
