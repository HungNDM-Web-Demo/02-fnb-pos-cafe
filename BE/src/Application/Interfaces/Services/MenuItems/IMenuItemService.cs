using Application.DTOs.MenuItems;
using Application.Interfaces.Services.Common;

namespace Application.Interfaces.Services.MenuItems;

/// <summary>Món (UC-01, UC-02, FR-04, FR-06, BR-18).</summary>
public interface IMenuItemService : ICrudService<MenuItemDto, SaveMenuItemRequest, SaveMenuItemRequest, MenuItemQuery>
{
    /// <summary>Báo tạm hết, bán lại (FR-06).</summary>
    Task SetAvailabilityAsync(Guid id, SetAvailabilityRequest request, CancellationToken ct = default);

    /// <summary>Ẩn, hiện trên màn bán hàng (FR-04).</summary>
    Task SetHiddenAsync(Guid id, SetHiddenRequest request, CancellationToken ct = default);

    /// <summary>Tải ảnh món JPG/PNG/WebP tối đa 2 MB, lưu <c>/uploads/menu/{yyyy}/{MM}/{guid}.{ext}</c>.</summary>
    Task<MenuItemImageResult> UploadImageAsync(Guid id, Stream content, long sizeBytes, CancellationToken ct = default);
}
