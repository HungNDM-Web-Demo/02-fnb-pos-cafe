using Application.DTOs.Customers;
using Application.DTOs.Orders;
using Domain.Entities.Crm.Customers;

namespace Application.Mappings.Customers;

/// <summary>Ánh xạ viết tay cho khách hàng.</summary>
public static class CustomerMappings
{
    public static CustomerDto ToDto(this Customer customer) => Fill(new CustomerDto(), customer);

    public static CustomerDetail ToDetail(this Customer customer, IReadOnlyList<OrderListItem> recentOrders) =>
        Fill(new CustomerDetail { RecentOrders = recentOrders }, customer);

    private static T Fill<T>(T dto, Customer customer)
        where T : CustomerDto => dto with
    {
        Id = customer.Id,
        Phone = customer.Phone,
        Name = customer.Name,
        Note = customer.Note,
        Points = customer.Points,
        OrderCount = customer.OrderCount,
        TotalSpent = customer.TotalSpent,
        LastOrderAt = customer.LastOrderAt,
        CreatedAt = customer.CreatedAt
    };
}
