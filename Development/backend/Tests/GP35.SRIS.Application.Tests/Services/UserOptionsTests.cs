using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Lib.Services;
using GP35.SRIS.Storage;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// Dropdown chọn người (GET /api/users/options?role=...): lọc role phải trả ĐÚNG người mang
/// role đó — trước đây Admin bị nhét vào mọi bộ lọc nên panel phỏng vấn dễ gán trúng Admin.
/// Ngoại lệ duy nhất: công ty chưa có ai mang role đó thì rơi về Admin, để công ty chạy bằng
/// 1 tài khoản Admin vẫn đặt được lịch (dropdown không rỗng).
/// </summary>
public class UserOptionsTests
{
    private const long CompanyId = 6;

    private static UserManageService CreateService(params User[] users)
    {
        var userRepo = new Mock<IUserRepo>();
        userRepo.Setup(r => r.GetListByCompanyAsync(CompanyId)).ReturnsAsync(users);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(userRepo.Object);
            s.AddSingleton(Mock.Of<IEncodeService>());
            // UserManageService còn lo ảnh đại diện (upload lên storage) -> ctor cần cả
            // IFileStorageService, dù các test dropdown dưới đây không đụng tới nó.
            s.AddSingleton(Mock.Of<IFileStorageService>());
        });
        return new UserManageService(provider);
    }

    private static User Make(long id, string email, string role, string status = "Active") =>
        new() { UserId = id, CompanyId = CompanyId, Email = email, Role = role, Status = status };

    [Fact]
    public async Task Loc_role_Interviewer_khong_tra_ve_Admin()
    {
        var svc = CreateService(
            Make(1, "admin@x.com", RoleConstants.Admin),
            Make(2, "iv@x.com", RoleConstants.Interviewer),
            Make(3, "rec@x.com", RoleConstants.HumanResource));

        var result = await svc.GetOptionsAsync(CompanyId, RoleConstants.Interviewer);

        Assert.Single(result);
        Assert.Equal("iv@x.com", result[0].Email);
    }

    [Fact]
    public async Task Cong_ty_chua_co_Interviewer_thi_roi_ve_Admin()
    {
        var svc = CreateService(
            Make(1, "admin@x.com", RoleConstants.Admin),
            Make(3, "rec@x.com", RoleConstants.HumanResource));

        var result = await svc.GetOptionsAsync(CompanyId, RoleConstants.Interviewer);

        Assert.Single(result);
        Assert.Equal("admin@x.com", result[0].Email);
    }

    [Fact]
    public async Task Khong_loc_role_thi_tra_het_ke_ca_Admin()
    {
        var svc = CreateService(
            Make(1, "admin@x.com", RoleConstants.Admin),
            Make(2, "iv@x.com", RoleConstants.Interviewer));

        var result = await svc.GetOptionsAsync(CompanyId, null);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task Bo_qua_tai_khoan_bi_khoa()
    {
        var svc = CreateService(
            Make(2, "iv@x.com", RoleConstants.Interviewer),
            Make(4, "iv2@x.com", RoleConstants.Interviewer, status: "Inactive"));

        var result = await svc.GetOptionsAsync(CompanyId, RoleConstants.Interviewer);

        Assert.Single(result);
        Assert.Equal("iv@x.com", result[0].Email);
    }

    [Fact]
    public async Task Interviewer_bi_khoa_thi_van_roi_ve_Admin()
    {
        var svc = CreateService(
            Make(1, "admin@x.com", RoleConstants.Admin),
            Make(2, "iv@x.com", RoleConstants.Interviewer, status: "Inactive"));

        var result = await svc.GetOptionsAsync(CompanyId, RoleConstants.Interviewer);

        Assert.Single(result);
        Assert.Equal("admin@x.com", result[0].Email);
    }
}
