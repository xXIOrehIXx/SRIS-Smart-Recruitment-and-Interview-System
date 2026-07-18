using GP35.SRIS.Domain.Shared.Security;
using Xunit;

namespace GP35.SRIS.Application.Tests.Security;

/// <summary>
/// Token magic link (docs 5.13): dạng "{companyId}.{secret}" để middleware giải tenant
/// từ tiền tố; DB chỉ lưu SHA-256 hex 64 ký tự của token gốc.
/// </summary>
public class MagicLinkTokenCodecTests
{
    [Fact]
    public void Generate_PrefixesCompanyId_AndParsesBack()
    {
        var token = MagicLinkTokenCodec.Generate(42);

        Assert.StartsWith("42.", token);
        Assert.True(MagicLinkTokenCodec.TryParseCompanyId(token, out var companyId));
        Assert.Equal(42, companyId);
    }

    [Fact]
    public void Generate_TokensAreUnique()
    {
        var a = MagicLinkTokenCodec.Generate(1);
        var b = MagicLinkTokenCodec.Generate(1);
        Assert.NotEqual(a, b);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("khong-co-dau-cham")]
    [InlineData(".secret")]        // thiếu companyId
    [InlineData("abc.secret")]     // companyId không phải số
    [InlineData("0.secret")]       // companyId phải > 0
    [InlineData("-5.secret")]
    public void TryParseCompanyId_InvalidTokens_ReturnsFalse(string? raw)
        => Assert.False(MagicLinkTokenCodec.TryParseCompanyId(raw, out _));

    [Fact]
    public void Hash_Is64LowercaseHex_AndDeterministic()
    {
        var h1 = MagicLinkTokenCodec.Hash("6.mot-token-goc");
        var h2 = MagicLinkTokenCodec.Hash("6.mot-token-goc");

        Assert.Equal(64, h1.Length); // khớp cột CHAR(64)
        Assert.Equal(h1, h1.ToLowerInvariant());
        Assert.Matches("^[0-9a-f]{64}$", h1);
        Assert.Equal(h1, h2);
    }

    [Fact]
    public void Hash_DifferentInputs_DifferentHashes()
    {
        Assert.NotEqual(
            MagicLinkTokenCodec.Hash("6.token-a"),
            MagicLinkTokenCodec.Hash("6.token-b"));
    }

    [Fact]
    public void Hash_NeverEqualsRawToken_SoDbLeakDoesNotLeakLinks()
    {
        var raw = MagicLinkTokenCodec.Generate(7);
        Assert.NotEqual(raw, MagicLinkTokenCodec.Hash(raw));
    }
}
