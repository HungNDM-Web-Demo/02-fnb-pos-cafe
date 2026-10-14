using System.Globalization;
using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.Promotions;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Promotions;
using Application.Mappings.Promotions;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Promotions;
using Domain.Enums.Pos.Promotions;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Promotions;

/// <summary>Khuyến mãi tự động (UC-13, FR-26, 07 §2.7).</summary>
public sealed class PromotionService(
    IGenericRepository<Promotion> promotions,
    IGenericRepository<Category> categories,
    IGenericRepository<MenuItem> menuItems,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) : IPromotionService
{
    public const string CodePrefix = "KM";
    private const string NotFoundMessage = "Không tìm thấy khuyến mãi.";

    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<PromotionDto>> GetPagedAsync(PromotionQuery query, CancellationToken ct = default)
    {
        var now = Now;
        var source = promotions.QueryNoTracking();

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(p => AppDbFunctions.Matches(p.Code, pattern) || AppDbFunctions.Matches(p.Name, pattern));
        }

        source = query.Status switch
        {
            PromotionStatus.TamDung => source.Where(p => p.IsPaused),
            PromotionStatus.SapChay => source.Where(p => !p.IsPaused && p.StartDate > now),
            PromotionStatus.DaHet => source.Where(p => !p.IsPaused && p.EndDate < now),
            PromotionStatus.DangChay => source.Where(p => !p.IsPaused && p.StartDate <= now && now <= p.EndDate),
            _ => source
        };

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = nameof(Promotion.StartDate);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var categoryNames = await CategoryNamesAsync(ct);
        return page.Map(items => items.Select(p => p.ToDto(CategoryName(p, categoryNames), now)).ToList());
    }

    public async Task<IReadOnlyList<PromotionDto>> GetActiveAsync(CancellationToken ct = default)
    {
        var now = Now;
        var list = await promotions.QueryNoTracking()
            .Where(p => !p.IsPaused && p.StartDate <= now && now <= p.EndDate)
            .OrderBy(p => p.Code)
            .ToListAsync(ct);
        var categoryNames = await CategoryNamesAsync(ct);
        return list.Select(p => p.ToDto(CategoryName(p, categoryNames), now)).ToList();
    }

    public async Task<PromotionDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var promotion = await promotions.QueryNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException(NotFoundMessage);
        return promotion.ToDto(CategoryName(promotion, await CategoryNamesAsync(ct)), Now);
    }

    public async Task<PromotionDto> CreateAsync(SavePromotionRequest request, CancellationToken ct = default)
    {
        await EnsureReferencesAsync(request, ct);
        var (startTime, endTime, startDate, endDate) = ParseSchedule(request);

        var promotion = Promotion.Create(
            await NextCodeAsync(ct), request.Name, request.Description, request.DiscountType, request.DiscountValue, request.MaxDiscount,
            request.Scope, request.CategoryId, request.MenuItemIds, request.MinOrderAmount, startTime, endTime, request.DaysOfWeek,
            startDate, endDate);
        await promotions.AddAsync(promotion, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(promotion.Id, ct);
    }

    public async Task<PromotionDto> UpdateAsync(Guid id, SavePromotionRequest request, CancellationToken ct = default)
    {
        var promotion = await LoadAsync(id, ct);
        await EnsureReferencesAsync(request, ct);
        var (startTime, endTime, startDate, endDate) = ParseSchedule(request);

        promotion.Update(
            request.Name, request.Description, request.DiscountType, request.DiscountValue, request.MaxDiscount, request.Scope,
            request.CategoryId, request.MenuItemIds, request.MinOrderAmount, startTime, endTime, request.DaysOfWeek, startDate, endDate);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task SetPausedAsync(Guid id, SetPausedRequest request, CancellationToken ct = default)
    {
        var promotion = await LoadAsync(id, ct);
        promotion.SetPaused(request.IsPaused);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var promotion = await LoadAsync(id, ct);
        promotions.Delete(promotion);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<Promotion> LoadAsync(Guid id, CancellationToken ct) =>
        await promotions.Query().FirstOrDefaultAsync(p => p.Id == id, ct)
        ?? throw new NotFoundException(NotFoundMessage);

    /// <summary>Mã <c>KM</c> + 2 số, không trùng kể cả bản ghi đã xóa.</summary>
    private async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var codes = (await promotions.QueryNoTracking().IgnoreQueryFilters().Select(p => p.Code).ToListAsync(ct))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var next = codes.Count + 1;
        string code;
        do
        {
            code = CodePrefix + next.ToString("00", CultureInfo.InvariantCulture);
            next++;
        }
        while (codes.Contains(code));
        return code;
    }

    private async Task EnsureReferencesAsync(SavePromotionRequest request, CancellationToken ct)
    {
        if (request.Scope == PromotionScope.DanhMuc)
        {
            if (request.CategoryId is not { } categoryId || !await categories.AnyAsync(c => c.Id == categoryId, ct))
                throw FieldErrors.Single("categoryId", "Danh mục không tồn tại");
        }

        if (request.Scope == PromotionScope.Mon)
        {
            var ids = request.MenuItemIds.Distinct().ToList();
            var found = await menuItems.QueryNoTracking().IgnoreAutoIncludes().CountAsync(m => ids.Contains(m.Id), ct);
            if (ids.Count == 0 || found != ids.Count)
                throw FieldErrors.Single("menuItemIds", "Món không tồn tại");
        }
    }

    private static (TimeOnly? StartTime, TimeOnly? EndTime, DateTime StartDate, DateTime EndDate) ParseSchedule(SavePromotionRequest request)
    {
        TimeOnly? startTime = VietnamDates.TryParseTime(request.StartTime, out var st) ? st : null;
        TimeOnly? endTime = VietnamDates.TryParseTime(request.EndTime, out var et) ? et : null;
        if (!VietnamDates.TryParse(request.StartDate, out var start))
            throw FieldErrors.Single("startDate", "Ngày dạng yyyy-MM-dd");
        if (!VietnamDates.TryParse(request.EndDate, out var end))
            throw FieldErrors.Single("endDate", "Ngày dạng yyyy-MM-dd");
        if (end < start)
            throw FieldErrors.Single("endDate", "Ngày kết thúc phải sau ngày bắt đầu");
        if (startTime is not null && endTime is not null && endTime <= startTime)
            throw FieldErrors.Single("endTime", "Giờ kết thúc phải sau giờ bắt đầu");

        return (startTime, endTime, VietnamDates.StartOfDayUtc(start), VietnamDates.EndOfDayUtc(end));
    }

    private Task<Dictionary<Guid, string>> CategoryNamesAsync(CancellationToken ct) =>
        categories.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(c => c.Id, c => c.Name, ct);

    private static string? CategoryName(Promotion promotion, Dictionary<Guid, string> names) =>
        promotion.CategoryId is { } id ? names.GetValueOrDefault(id) : null;
}
