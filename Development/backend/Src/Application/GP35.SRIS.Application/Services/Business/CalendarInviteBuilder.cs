using System.Collections.Generic;
using System.Linq;
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

    /// <summary>
    /// Lời mời lịch dạng iMIP (METHOD:REQUEST) — Gmail/Outlook nhận diện là lời mời họp và TỰ thêm
    /// vào lịch người nhận (kèm nút RSVP), không cần OAuth. Dùng cho cả 3 bên (candidate/interviewer/
    /// recruiter): mỗi người là 1 ATTENDEE. UID ổn định + SEQUENCE tăng để dời/hủy CẬP NHẬT đúng event.
    /// method = "REQUEST" (mời/cập nhật) hoặc "CANCEL" (gỡ khỏi lịch).
    /// </summary>
    public static string BuildInvite(
        string uid, int sequence, string method,
        string summary, string description, DateTime startUtc, DateTime endUtc,
        string organizerEmail, IEnumerable<string> attendeeEmails)
    {
        var isCancel = string.Equals(method, "CANCEL", StringComparison.OrdinalIgnoreCase);
        var lines = new List<string>
        {
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//SRIS//Interview//VI",
            "CALSCALE:GREGORIAN",
            $"METHOD:{method.ToUpperInvariant()}",
            "BEGIN:VEVENT",
            $"UID:{uid}",
            $"SEQUENCE:{sequence}",
            $"DTSTAMP:{Stamp(DateTime.UtcNow)}",
            $"DTSTART:{Stamp(startUtc)}",
            $"DTEND:{Stamp(endUtc)}",
            $"SUMMARY:{EscapeText(summary)}",
            $"DESCRIPTION:{EscapeText(description)}",
            $"ORGANIZER:mailto:{organizerEmail}",
            $"STATUS:{(isCancel ? "CANCELLED" : "CONFIRMED")}"
        };

        foreach (var email in attendeeEmails
                     .Where(e => !string.IsNullOrWhiteSpace(e))
                     .Select(e => e.Trim())
                     .Distinct(StringComparer.OrdinalIgnoreCase))
        {
            lines.Add($"ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:{email}");
        }

        lines.Add("END:VEVENT");
        lines.Add("END:VCALENDAR");
        return string.Join("\r\n", lines) + "\r\n";
    }

    /// <summary>UID ổn định cho buổi PV của 1 hồ sơ ở 1 vòng — để dời/hủy trỏ về CÙNG event trên lịch.</summary>
    public static string StableUid(long companyId, long applicationId, int roundNumber)
        => $"sris-interview-{companyId}-{applicationId}-r{roundNumber}@sris";

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
