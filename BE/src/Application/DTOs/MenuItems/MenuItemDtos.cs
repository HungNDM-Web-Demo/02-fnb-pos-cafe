using Application.Common.Models;
using Domain.Enums.Pos.MenuItems;

namespace Application.DTOs.MenuItems;

// DTO món /api/menu-items (07 §2.3).

public sealed record MenuItemSizeDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public bool IsDefault { get; init; }
    public int SortOrder { get; init; }
}

public sealed record MenuItemDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public string? Description { get; init; }
    public bool HasSugarOption { get; init; }
    public bool HasIceOption { get; init; }
    public bool IsSoldOut { get; init; }
    public bool IsHidden { get; init; }

    /// <summary><c>An</c> &gt; <c>TamHet</c> &gt; <c>DangBan</c>.</summary>
    public MenuItemStatus Status { get; init; }

    public int SortOrder { get; init; }

    /// <summary>Theo sortOrder, đúng một isDefault.</summary>
    public IReadOnlyList<MenuItemSizeDto> Sizes { get; init; } = [];

    /// <summary>Giá size thấp nhất, hiện trên thẻ món.</summary>
    public decimal MinPrice { get; init; }

    /// <summary>Topping được phép, kể cả topping đang tạm hết.</summary>
    public IReadOnlyList<Guid> ToppingIds { get; init; } = [];

    /// <summary>Đã có trong hóa đơn (BR-18): FE vô hiệu nút Xóa, gợi ý Ẩn.</summary>
    public bool EverSold { get; init; }

    public DateTime UpdatedAt { get; init; }
}

public sealed record SaveMenuItemSizeInput
{
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public bool IsDefault { get; init; }
}

public sealed record SaveMenuItemRequest
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid CategoryId { get; init; }
    public string? Description { get; init; }
    public bool HasSugarOption { get; init; } = true;
    public bool HasIceOption { get; init; } = true;

    /// <summary>≥ 1; price &gt; 0 bội số 1.000.</summary>
    public IReadOnlyList<SaveMenuItemSizeInput> Sizes { get; init; } = [];

    public IReadOnlyList<Guid> ToppingIds { get; init; } = [];

    /// <summary>Bỏ trống khi tạo → cuối danh mục.</summary>
    public int? SortOrder { get; init; }
}

/// <summary>Bộ lọc danh sách món: <c>search</c> theo mã, tên; <c>categoryId</c>; <c>status</c>.</summary>
public sealed class MenuItemQuery : PaginationQuery
{
    public Guid? CategoryId { get; set; }
    public MenuItemStatus? Status { get; set; }
}

/// <summary><c>PATCH .../availability</c> (UC-02).</summary>
public sealed record SetAvailabilityRequest
{
    public bool IsSoldOut { get; init; }
}

/// <summary><c>PATCH .../hidden</c>.</summary>
public sealed record SetHiddenRequest
{
    public bool IsHidden { get; init; }
}

/// <summary>Kết quả tải ảnh món.</summary>
public sealed record MenuItemImageResult
{
    public string ImageUrl { get; init; } = string.Empty;
}
