using GP35.SRIS.Domain.Shared.Constants;
using Xunit;

namespace GP35.SRIS.Application.Tests.StateMachine;

/// <summary>
/// Luật state machine thuần (docs 5.8): 6 state, forward-only, 8 transition
/// (4 tiến + reject từ 4 state), guard G2 chỉ ở cửa INTERVIEW→OFFER.
/// </summary>
public class ApplicationStateMachineTests
{
    // ===== 4 bước tiến hợp lệ =====

    [Theory]
    [InlineData("NEW", "SCREENING")]
    [InlineData("SCREENING", "INTERVIEW")]
    [InlineData("INTERVIEW", "OFFER")]
    [InlineData("OFFER", "HIRED")]
    public void IsForwardAllowed_ValidSteps_ReturnsTrue(string from, string to)
        => Assert.True(ApplicationStateMachine.IsForwardAllowed(from, to));

    [Theory]
    [InlineData("new", "screening")]
    [InlineData("Interview", "Offer")]
    public void IsForwardAllowed_IsCaseInsensitive(string from, string to)
        => Assert.True(ApplicationStateMachine.IsForwardAllowed(from, to));

    // ===== Cấm lùi, cấm nhảy cóc, cấm rời state chốt =====

    [Theory]
    [InlineData("SCREENING", "NEW")]        // lùi
    [InlineData("OFFER", "INTERVIEW")]      // lùi
    [InlineData("NEW", "INTERVIEW")]        // nhảy cóc
    [InlineData("NEW", "OFFER")]            // nhảy cóc
    [InlineData("SCREENING", "HIRED")]      // nhảy cóc
    [InlineData("HIRED", "OFFER")]          // state chốt
    [InlineData("REJECTED", "NEW")]         // state chốt
    [InlineData("NEW", "REJECTED")]         // reject KHÔNG đi qua forward (cần reason, nhánh riêng)
    public void IsForwardAllowed_InvalidSteps_ReturnsFalse(string from, string to)
        => Assert.False(ApplicationStateMachine.IsForwardAllowed(from, to));

    // ===== Reject từ mọi state trừ 2 state chốt =====

    [Theory]
    [InlineData("NEW")]
    [InlineData("SCREENING")]
    [InlineData("INTERVIEW")]
    [InlineData("OFFER")]
    public void CanReject_OpenStates_ReturnsTrue(string from)
        => Assert.True(ApplicationStateMachine.CanReject(from));

    [Theory]
    [InlineData("HIRED")]
    [InlineData("REJECTED")]
    [InlineData("hired")]
    public void CanReject_ClosedStates_ReturnsFalse(string from)
        => Assert.False(ApplicationStateMachine.CanReject(from));

    // ===== Guard G2 chỉ nằm ở cửa INTERVIEW→OFFER =====

    [Fact]
    public void RequiresGuardG2_OnlyOnInterviewToOffer()
    {
        Assert.True(ApplicationStateMachine.RequiresGuardG2("INTERVIEW", "OFFER"));
        Assert.True(ApplicationStateMachine.RequiresGuardG2("interview", "offer"));

        Assert.False(ApplicationStateMachine.RequiresGuardG2("NEW", "SCREENING"));
        Assert.False(ApplicationStateMachine.RequiresGuardG2("SCREENING", "INTERVIEW"));
        Assert.False(ApplicationStateMachine.RequiresGuardG2("OFFER", "HIRED"));
    }

    // ===== Validate tên state =====

    [Theory]
    [InlineData("NEW", true)]
    [InlineData("hired", true)]
    [InlineData("INTERVIEWING", false)] // không có state INTERVIEW_1/_2/ING — multi-round là DỮ LIỆU
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValidState_Works(string? state, bool expected)
        => Assert.Equal(expected, ApplicationStateMachine.IsValidState(state));
}
