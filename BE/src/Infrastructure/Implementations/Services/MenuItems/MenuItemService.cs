using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.MenuItems;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.MenuItems;
using Application.Interfaces.Services.Uploads;
using Application.Mappings.MenuItems;
using Domain.Common;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.MenuItems;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Menu;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.MenuItems;

/// <summary>Món (UC-01, UC-02, 07 §2.3). Thứ tự kiểm tra: định dạng (validator) → danh mục, topping (400) → trùng mã (409).</summary>
public sealed class MenuItemService(
    IGenericRepository<MenuItem> menuItems,
    IGenericRepository<Category> categories,
    IGenericRepository<Topping> toppings,
    IGenericRepository<OrderItem> orderItems,
    IUnitOfWork unitOfWork,
    IImageInspector imageInspector,
    IFileStorage fileStorage) : IMenuItemService
{
    /// <summary>Thư mục ảnh món trong <c>wwwroot/uploads</c>.</summary>
    public const string UploadFolder = "menu";

    private const string UploadsPrefix = "/uploads/";

    public async Task<PaginatedResult<MenuItemDto>> GetPagedAsync(MenuItemQuery query, CancellationToken ct = default)
    {
        var source = menuItems.QueryNoTracking().Include(m => m.Category).AsSplitQuery();

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(m => AppDbFunctions.Matches(m.Code, pattern) || AppDbFunctions.Matches(m.Name, pattern));
        }

        if (query.CategoryId is { } categoryId)
            source = source.Where(m => m.CategoryId == categoryId);

        source = query.Status switch
        {
            MenuItemStatus.An => source.Where(m => m.IsHidden),
            MenuItemStatus.TamHet => source.Where(m => !m.IsHidden && m.IsSoldOut),
            MenuItemStatus.DangBan => source.Where(m => !m.IsHidden && !m.IsSoldOut),
            _ => source
        };

        if (string.IsNullOrWhiteSpace(query.SortBy))
        {
            query.SortBy = nameof(MenuItem.SortOrder);
            query.SortDir ??= "asc";
        }

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var sold = await MenuQueries.SoldMenuItemIdsAsync(orderItems, ct);
        return page.Map(items => items.Select(m => m.ToDto(sold.Contains(m.Id))).ToList());
    }

    public async Task<MenuItemDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var item = await menuItems.QueryNoTracking().Include(m => m.Category).FirstOrDefaultAsync(m => m.Id == id, ct)
            ?? throw new NotFoundException(MenuQueries.ItemNotFoundMessage);
        return item.ToDto(await EverSoldAsync(id, ct));
    }

    public async Task<MenuItemDto> CreateAsync(SaveMenuItemRequest request, CancellationToken ct = default)
    {
        var category = await EnsureReferencesAsync(request, ct);
        await EnsureCodeUniqueAsync(request.Code, null, ct);

        var sortOrder = request.SortOrder
            ?? (await menuItems.QueryNoTracking().IgnoreAutoIncludes()
                .Where(m => m.CategoryId == request.CategoryId)
                .MaxAsync(m => (int?)m.SortOrder, ct) ?? 0) + Category.SortOrderStep;

        var item = MenuItem.Create(
            request.Code, request.Name, category.Id, request.Description, request.HasSugarOption, request.HasIceOption, sortOrder,
            request.Sizes.Select(s => (s.Name, s.Price, s.IsDefault)), request.ToppingIds);
        await menuItems.AddAsync(item, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(item.Id, ct);
    }

    public async Task<MenuItemDto> UpdateAsync(Guid id, SaveMenuItemRequest request, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        var category = await EnsureReferencesAsync(request, ct);
        await EnsureCodeUniqueAsync(request.Code, id, ct);

        item.Update(
            request.Code, request.Name, category.Id, request.Description, request.HasSugarOption, request.HasIceOption,
            request.SortOrder ?? item.SortOrder, request.Sizes.Select(s => (s.Name, s.Price, s.IsDefault)), request.ToppingIds);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        if (await EverSoldAsync(id, ct))
            throw new DomainException("Món đã có trong hóa đơn, chỉ có thể ẩn");

        menuItems.Delete(item);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task SetAvailabilityAsync(Guid id, SetAvailabilityRequest request, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        item.SetSoldOut(request.IsSoldOut);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task SetHiddenAsync(Guid id, SetHiddenRequest request, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        item.SetHidden(request.IsHidden);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<MenuItemImageResult> UploadImageAsync(Guid id, Stream content, long sizeBytes, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);

        if (sizeBytes <= 0)
            throw Invalid("Chưa chọn file ảnh.");
        if (sizeBytes > UploadLimits.MaxImageBytes)
            throw Invalid("Ảnh tối đa 2 MB.");

        using var buffer = new MemoryStream((int)sizeBytes);
        await content.CopyToAsync(buffer, ct);
        if (buffer.Length > UploadLimits.MaxImageBytes)
            throw Invalid("Ảnh tối đa 2 MB.");

        var image = imageInspector.Inspect(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
        if (image is null || image.Format == ImageFormat.Svg)
            throw Invalid("Chỉ nhận ảnh JPG, PNG hoặc WebP.");

        buffer.Position = 0;
        var url = await fileStorage.SaveAsync(buffer, UploadFolder, image.Extension, ct);

        var previous = item.ImageUrl;
        item.SetImage(url);
        await unitOfWork.SaveChangesAsync(ct);

        // Ảnh tải lên trước đó không còn dùng; ảnh mẫu /seed/... nằm ở FE nên không đụng tới.
        if (previous is not null && previous.StartsWith(UploadsPrefix, StringComparison.OrdinalIgnoreCase))
            await fileStorage.DeleteAsync(previous, ct);

        return new MenuItemImageResult { ImageUrl = url };
    }

    private async Task<MenuItem> LoadAsync(Guid id, CancellationToken ct) =>
        await menuItems.Query().FirstOrDefaultAsync(m => m.Id == id, ct)
        ?? throw new NotFoundException(MenuQueries.ItemNotFoundMessage);

    private Task<bool> EverSoldAsync(Guid id, CancellationToken ct) => orderItems.AnyAsync(i => i.MenuItemId == id, ct);

    /// <summary>Danh mục phải tồn tại (<c>errors.categoryId</c>), topping phải tồn tại (<c>errors.toppingIds</c>).</summary>
    private async Task<Category> EnsureReferencesAsync(SaveMenuItemRequest request, CancellationToken ct)
    {
        var category = await categories.QueryNoTracking().FirstOrDefaultAsync(c => c.Id == request.CategoryId, ct)
            ?? throw FieldErrors.Single("categoryId", "Danh mục không tồn tại");

        var requested = request.ToppingIds.Distinct().ToList();
        if (requested.Count > 0)
        {
            var found = await toppings.QueryNoTracking().CountAsync(t => requested.Contains(t.Id), ct);
            if (found != requested.Count)
                throw FieldErrors.Single("toppingIds", "Topping không tồn tại");
        }

        return category;
    }

    private async Task EnsureCodeUniqueAsync(string code, Guid? currentId, CancellationToken ct)
    {
        var normalized = MenuItem.NormalizeCode(code);
        if (await menuItems.AnyAsync(m => m.Code == normalized && m.Id != currentId, ct))
            throw new ConflictException("Mã món đã tồn tại", "code");
    }

    private static ValidationException Invalid(string message) => new([new ValidationFailure("file", message)]);
}
