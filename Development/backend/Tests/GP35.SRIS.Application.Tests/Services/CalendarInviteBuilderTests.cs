using System;
using GP35.SRIS.Application.Services.Business;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class CalendarInviteBuilderTests
{
    [Fact]
    public void BuildIcs_HappyPath_ReturnsValidIcsFormat()
    {
        // UTCID01: Happy path
        var summary = "Interview Round 1";
        var description = "Discussion with Panel";
        var startUtc = new DateTime(2025, 1, 1, 9, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2025, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var ics = CalendarInviteBuilder.BuildIcs(summary, description, startUtc, endUtc);

        Assert.NotNull(ics);
        Assert.Contains("BEGIN:VCALENDAR", ics);
        Assert.Contains("BEGIN:VEVENT", ics);
        Assert.Contains("SUMMARY:Interview Round 1", ics);
        Assert.Contains("DESCRIPTION:Discussion with Panel", ics);
        Assert.Contains("DTSTART:20250101T090000Z", ics);
        Assert.Contains("DTEND:20250101T100000Z", ics);
    }

    [Fact]
    public void BuildIcs_NullOrEmptyInputs_HandlesGracefully()
    {
        // UTCID02: Invalid/null input - System handles gracefully without throwing exceptions
        var startUtc = new DateTime(2025, 1, 1, 9, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2025, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var ics = CalendarInviteBuilder.BuildIcs(null!, "", startUtc, endUtc);

        Assert.NotNull(ics);
        Assert.Contains("SUMMARY:", ics);
        Assert.Contains("DESCRIPTION:", ics);
    }

    [Fact]
    public void BuildIcs_SpecialCharacters_EscapesSuccessfully()
    {
        // UTCID03: Boundary arguments
        var summary = "Interview, Round; 1 \\ Test";
        var description = "Line 1\nLine 2";
        var startUtc = new DateTime(2025, 1, 1, 9, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2025, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var ics = CalendarInviteBuilder.BuildIcs(summary, description, startUtc, endUtc);

        Assert.NotNull(ics);
        Assert.Contains("SUMMARY:Interview\\, Round\\; 1 \\\\ Test", ics);
        Assert.Contains("DESCRIPTION:Line 1\\nLine 2", ics);
    }

    [Fact]
    public void BuildGoogleCalendarUrl_HappyPath_ReturnsValidUrl()
    {
        // UTCID01: Happy path
        var summary = "Interview Round 1";
        var description = "Discussion with Panel";
        var startUtc = new DateTime(2025, 1, 1, 9, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2025, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var url = CalendarInviteBuilder.BuildGoogleCalendarUrl(summary, description, startUtc, endUtc);

        Assert.NotNull(url);
        Assert.StartsWith("https://calendar.google.com/calendar/render?action=TEMPLATE", url);
        Assert.Contains("text=Interview%20Round%201", url);
        Assert.Contains("dates=20250101T090000Z/20250101T100000Z", url);
        Assert.Contains("details=Discussion%20with%20Panel", url);
    }

    [Fact]
    public void BuildGoogleCalendarUrl_NullInputs_ThrowsArgumentNullException()
    {
        // UTCID02: Invalid/null input - throws ArgumentNullException due to Uri.EscapeDataString
        var startUtc = new DateTime(2025, 1, 1, 9, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2025, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        Assert.Throws<ArgumentNullException>(() =>
            CalendarInviteBuilder.BuildGoogleCalendarUrl(null!, "Description", startUtc, endUtc));
    }

    [Fact]
    public void BuildGoogleCalendarUrl_SpecialCharacters_EscapesSuccessfully()
    {
        // UTCID03: Boundary arguments
        var summary = "Interview & Coffee";
        var description = "Discussion & panel QA?";
        var startUtc = new DateTime(2025, 1, 1, 9, 0, 0, DateTimeKind.Utc);
        var endUtc = new DateTime(2025, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var url = CalendarInviteBuilder.BuildGoogleCalendarUrl(summary, description, startUtc, endUtc);

        Assert.NotNull(url);
        Assert.Contains("text=Interview%20%26%20Coffee", url);
        Assert.Contains("details=Discussion%20%26%20panel%20QA%3F", url);
    }
}
