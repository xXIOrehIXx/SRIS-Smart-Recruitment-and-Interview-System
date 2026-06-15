using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace GP35.SRIS.Lib.Models;

public class EmailDto
{
}

#region ObjReq và Res dành cho tích hợp hệ thống gửi mail
[ExcludeFromCodeCoverage]
public class SendEmailServiceReq
{
  public string ApplicationCode { get; set; }
  public string Subject { get; set; }
  public string Body { get; set; }
  public bool IsBodyHtml { get; set; }
  public bool IsAttachment { get; set; }
  public List<FileAttachment> FileAttachments { get; set; }
  public List<Recipient> Recipients { get; set; }
  public bool IsMerge { get; set; }

}
[ExcludeFromCodeCoverage]
public class FileAttachment
{
  public string AttachmentName { get; set; }
  public byte[] Content { get; set; }
  public string MimeType { get; set; }
}
[ExcludeFromCodeCoverage]
public class Recipient
{
  public string RecipientAddress { get; set; }
  public string RecipientName { get; set; }
  public int RecipientType { get; set; }
  public Dictionary<string, string> MergeData { get; set; }
}
[ExcludeFromCodeCoverage]
public class EmailAttachment
{
  public string FileName { get; set; }
  public string FileExtension { get; set; }
  public Byte[] FileContent { get; set; }
}
#endregion
