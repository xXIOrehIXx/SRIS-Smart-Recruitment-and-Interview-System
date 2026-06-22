using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class InternalNoteRepo : BaseRepo<long, InternalNote>, IInternalNoteRepo
{
    private readonly SrisDbContext _db;

    public InternalNoteRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, InternalNote note)
    {
        note.CompanyId = companyId;
        _db.InternalNotes.Add(note);
        await _db.SaveChangesAsync();
        return note.NoteId;
    }

    public async Task<IReadOnlyList<InternalNoteRow>> GetByApplicationAsync(long companyId, long applicationId)
    {
        // Join User lấy email người viết (cùng tenant — Global Query Filter kèm company_id cả 2 bảng).
        return await (
            from n in _db.InternalNotes.AsNoTracking()
            join u in _db.Users.AsNoTracking() on n.UserId equals u.UserId into uj
            from u in uj.DefaultIfEmpty()
            where n.ApplicationId == applicationId
            orderby n.NoteId descending
            select new InternalNoteRow(n.NoteId, n.UserId, u != null ? u.Email : null, n.Content, n.CreatedAt))
            .ToListAsync();
    }
}
