using System.Text;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Dựng lời mời lịch không cần API: file .ics (iCalendar, mọi app lịch đọc được) + link
/// "Add to Google Calendar". Đây là cách tích hợp calendar IN-SCOPE (docs OUT đồng bộ 2 chiều).
/// Mốc thời gian dùng UTC (hậu tố Z) — InterviewSlot.start_time lưu UTC.
/// </summary>
public static class CalendarInviteBuilder
{
    /// <summary>Nội dung file .ics cho 1 sự kiện (1 VEVENT).</summary>
    public static string BuildIcs(string summary, string description, DateTime startUtc, DateTime endUtc)
    {
        var lines = new[]
        {
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//SRIS//Interview//VI",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            $"UID:{Guid.NewGuid():N}@sris",
            $"DTSTAMP:{Stamp(DateTime.UtcNow)}",
            $"DTSTART:{Stamp(startUtc)}",
            $"DTEND:{Stamp(endUtc)}",
            $"SUMMARY:{EscapeText(summary)}",
            $"DESCRIPTION:{EscapeText(description)}",
            "END:VEVENT",
            "END:VCALENDAR"
        };
        return string.Join("\r\n", lines) + "\r\n";
    }

    /// <summary>Link mở Google Calendar với sự kiện điền sẵn (không cần OAuth/API).</summary>
    public static string BuildGoogleCalendarUrl(string summary, string description, DateTime startUtc, DateTime endUtc)
    {
        var dates = $"{Stamp(startUtc)}/{Stamp(endUtc)}";
        return "https://calendar.google.com/calendar/render?action=TEMPLATE"
               + $"&text={Uri.EscapeDataString(summary)}"
               + $"&dates={dates}"
               + $"&details={Uri.EscapeDataString(description)}";
    }

    // ============================================================

    /// <summary>Định dạng UTC basic của iCal: yyyyMMddTHHmmssZ.</summary>
    private static string Stamp(DateTime utc) =>
        DateTime.SpecifyKind(utc, DateTimeKind.Utc).ToString("yyyyMMddTHHmmssZ");

    /// <summary>Escape ký tự đặc biệt trong TEXT của iCal (RFC 5545): \\ , ; và xuống dòng.</summary>
    private static string EscapeText(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
        {
            switch (ch)
            {
                case '\\': sb.Append("\\\\"); break;
                case ';': sb.Append("\\;"); break;
                case ',': sb.Append("\\,"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': break;
                default: sb.Append(ch); break;
            }
        }
        return sb.ToString();
    }
}
