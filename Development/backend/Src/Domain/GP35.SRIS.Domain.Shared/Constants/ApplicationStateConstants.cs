namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>Trạng thái hồ sơ (cột Application.current_state varchar(20)) — docs 5.8.</summary>
public static class ApplicationState
{
    public const string New = "NEW";
    public const string Screening = "SCREENING";
    public const string Interview = "INTERVIEW";
    public const string Offer = "OFFER";
    public const string Hired = "HIRED";
    public const string Rejected = "REJECTED";

    public static readonly IReadOnlyList<string> All = new[]
    {
        New, Screening, Interview, Offer, Hired, Rejected
    };
}

/// <summary>
/// Luật chuyển trạng thái hồ sơ (docs 5.8) — 6 state, forward-only, 8 transition.
/// Logic THUẦN (không I/O); guard G2 cần dữ liệu nên kiểm ở tầng service.
///
/// Forward (4): NEW→SCREENING · SCREENING→INTERVIEW ·
///   INTERVIEW→OFFER (G2: ≥1 phiếu chấm SUBMITTED) · OFFER→HIRED.
/// Reject (4): NEW/SCREENING/INTERVIEW/OFFER → REJECTED (bắt buộc reject_reason).
/// (Guard G1 không còn — thuộc nhánh quiz đã loại khỏi scope; giữ tên G2 khớp tài liệu cũ.)
/// </summary>
public static class ApplicationStateMachine
{
    // Các bước tiến hợp lệ (KHÔNG gồm reject — reject xử lý riêng vì cần reason).
    private static readonly IReadOnlyDictionary<string, string[]> Forward =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            [ApplicationState.New] = new[] { ApplicationState.Screening },
            [ApplicationState.Screening] = new[] { ApplicationState.Interview },
            [ApplicationState.Interview] = new[] { ApplicationState.Offer },
            [ApplicationState.Offer] = new[] { ApplicationState.Hired },
            [ApplicationState.Hired] = Array.Empty<string>(),
            [ApplicationState.Rejected] = Array.Empty<string>()
        };

    public static bool IsValidState(string? state) =>
        state is not null && ApplicationState.All.Contains(state, StringComparer.OrdinalIgnoreCase);

    /// <summary>Có được phép tiến từ from -> to (chưa tính guard G2)?</summary>
    public static bool IsForwardAllowed(string from, string to) =>
        Forward.TryGetValue(from, out var targets) &&
        targets.Contains(to, StringComparer.OrdinalIgnoreCase);

    /// <summary>State này có được phép reject không (mọi state trừ HIRED/REJECTED)?</summary>
    public static bool CanReject(string from) =>
        !string.Equals(from, ApplicationState.Hired, StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(from, ApplicationState.Rejected, StringComparison.OrdinalIgnoreCase);

    /// <summary>Transition INTERVIEW→OFFER cần Guard G2 (≥1 phiếu chấm SUBMITTED).</summary>
    public static bool RequiresGuardG2(string from, string to) =>
        Eq(from, ApplicationState.Interview) && Eq(to, ApplicationState.Offer);

    private static bool Eq(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
}
