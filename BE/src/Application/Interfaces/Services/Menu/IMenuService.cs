using Application.DTOs.Menu;

namespace Application.Interfaces.Services.Menu;

/// <summary>Thực đơn gộp cho màn bán hàng (<c>GET /api/menu</c>, FR-07).</summary>
public interface IMenuService
{
    /// <summary>Danh mục, món, topping chưa ẩn; món tạm hết vẫn trả để hiện mờ (FR-06).</summary>
    Task<MenuBundle> GetBundleAsync(CancellationToken ct = default);
}
