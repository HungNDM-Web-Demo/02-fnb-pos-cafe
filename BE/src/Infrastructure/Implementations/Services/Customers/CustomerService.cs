using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Customers;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Customers;
using Application.Mappings.Customers;
using Application.Mappings.Orders;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Orders;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Customers;

/// <summary>Khách tích điểm (UC-15, 07 §2.9).</summary>
public sealed class CustomerService(
    IGenericRepository<Customer> customers,
    IGenericRepository<Order> orders,
    IUnitOfWork unitOfWork) : ICustomerService
{
    public const string NotFoundMessage = "Không tìm thấy khách hàng.";
    public const string DuplicatePhoneMessage = "Số điện thoại đã có khách";
    private const int RecentOrdersCount = 20;

    public async Task<PaginatedResult<CustomerDto>> GetPagedAsync(CustomerQuery query, CancellationToken ct = default)
    {
        var source = customers.QueryNoTracking();

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            var digits = new string(term.Where(char.IsDigit).ToArray());
            var phonePattern = LikePattern.Contains(digits.Length > 0 ? digits : term);
            source = source.Where(c => AppDbFunctions.Matches(c.Phone, phonePattern) || AppDbFunctions.Matches(c.Name, pattern));
        }

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = nameof(Customer.LastOrderAt);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(c => c.ToDto()).ToList());
    }

    public async Task<CustomerDto> LookupAsync(string phone, CancellationToken ct = default)
    {
        var normalized = Customer.NormalizePhone(phone ?? string.Empty);
        var customer = await customers.QueryNoTracking().FirstOrDefaultAsync(c => c.Phone == normalized, ct)
            ?? throw new NotFoundException(NotFoundMessage);
        return customer.ToDto();
    }

    public async Task<CustomerDetail> GetDetailAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await customers.QueryNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(NotFoundMessage);

        var recent = await orders.QueryNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payment)
            .AsSplitQuery()
            .Where(o => o.CustomerId == id && o.Status != OrderStatus.DangGiu)
            .OrderByDescending(o => o.PaidAt)
            .Take(RecentOrdersCount)
            .ToListAsync(ct);

        return customer.ToDetail(recent.Select(o => o.ToListItem()).ToList());
    }

    public async Task<CustomerDto> CreateAsync(SaveCustomerRequest request, CancellationToken ct = default)
    {
        await EnsurePhoneUniqueAsync(request.Phone, null, ct);
        var customer = Customer.Create(request.Phone, request.Name, request.Note);
        await customers.AddAsync(customer, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return customer.ToDto();
    }

    public async Task<CustomerDto> UpdateAsync(Guid id, SaveCustomerRequest request, CancellationToken ct = default)
    {
        var customer = await customers.Query().FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(NotFoundMessage);
        await EnsurePhoneUniqueAsync(request.Phone, id, ct);

        customer.ChangePhone(request.Phone);
        customer.Update(request.Name, request.Note);
        await unitOfWork.SaveChangesAsync(ct);
        return customer.ToDto();
    }

    private async Task EnsurePhoneUniqueAsync(string phone, Guid? currentId, CancellationToken ct)
    {
        var normalized = Customer.NormalizePhone(phone);
        if (await customers.AnyAsync(c => c.Phone == normalized && c.Id != currentId, ct))
            throw new ConflictException(DuplicatePhoneMessage, "phone");
    }
}
