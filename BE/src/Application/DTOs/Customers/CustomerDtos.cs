using Application.Common.Models;
using Application.DTOs.Orders;

namespace Application.DTOs.Customers;

// DTO khách hàng /api/customers (07 §2.9, P3).

public record CustomerDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Note { get; init; }
    public int Points { get; init; }
    public int OrderCount { get; init; }
    public decimal TotalSpent { get; init; }
    public DateTime? LastOrderAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record SaveCustomerRequest
{
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Note { get; init; }
}

public sealed record CustomerDetail : CustomerDto
{
    /// <summary>20 hóa đơn gần nhất.</summary>
    public IReadOnlyList<OrderListItem> RecentOrders { get; init; } = [];
}

/// <summary><c>search</c> theo SĐT, tên; mặc định sắp theo lastOrderAt giảm dần.</summary>
public sealed class CustomerQuery : PaginationQuery
{
}
