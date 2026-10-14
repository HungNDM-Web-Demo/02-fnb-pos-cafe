using Application.Common.Exceptions;
using Application.DTOs.Categories;
using Application.DTOs.Menu;
using Application.DTOs.MenuItems;
using Application.DTOs.Toppings;
using Application.Interfaces.Services.Categories;
using Application.Interfaces.Services.Menu;
using Application.Interfaces.Services.MenuItems;
using Application.Interfaces.Services.Toppings;
using Domain.Common;
using Domain.Enums.Pos.MenuItems;
using FluentValidation;
using UnitTests.TestSupport;

namespace UnitTests.Pos;

/// <summary>Thực đơn (TC-01..TC-04): thêm món, trùng mã, xóa món đã bán, sửa thay cả bộ size, topping tạm hết.</summary>
public sealed class MenuManagementTests : IAsyncLifetime
{
    private PosTestHost _host = null!;
    private PosScenario _pos = null!;

    public async Task InitializeAsync()
    {
        _host = await PosTestHost.StartAsync();
        _pos = new PosScenario(_host);
        await _host.SignInAsync("quanly");
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    private async Task<SaveMenuItemRequest> Tc01RequestAsync(string code = "M099")
    {
        var categories = await _host.CallAsync<ICategoryService, IReadOnlyList<CategoryDto>>(s => s.GetListAsync());
        return new SaveMenuItemRequest
        {
            Code = code,
            Name = "Trà đào cam sả",
            CategoryId = categories.Single(c => c.Code == "TT").Id,
            Sizes = [new SaveMenuItemSizeInput { Name = "M", Price = 39_000, IsDefault = true }, new SaveMenuItemSizeInput { Name = "L", Price = 45_000 }],
            ToppingIds = [await _pos.ToppingIdAsync("TP04")]
        };
    }

    [Fact]
    public async Task Tc01_CreateItem_AppearsInMenu_Tc02_DuplicateCode()
    {
        var created = await _host.CallAsync<IMenuItemService, MenuItemDto>(async s => await s.CreateAsync(await Tc01RequestAsync()));
        Assert.Equal(("M099", 39_000m, "Trà trái cây", false), (created.Code, created.MinPrice, created.CategoryName, created.EverSold));
        Assert.Equal(["M", "L"], created.Sizes.Select(s => s.Name));

        var bundle = await _host.CallAsync<IMenuService, MenuBundle>(s => s.GetBundleAsync());
        Assert.Contains(bundle.Items, i => i.Id == created.Id);
        Assert.Equal(6, bundle.Categories.Count);

        var duplicate = await Assert.ThrowsAsync<ConflictException>(() =>
            _host.CallAsync<IMenuItemService, MenuItemDto>(async s => await s.CreateAsync(await Tc01RequestAsync("m001"))));
        Assert.Equal(("code", "Mã món đã tồn tại"), (duplicate.Field, duplicate.Message));
    }

    [Fact]
    public async Task Ue01E2_PriceNotThousandMultiple_IsInvalid()
    {
        var request = await Tc01RequestAsync() with { Sizes = [new SaveMenuItemSizeInput { Name = "M", Price = 39_500 }] };
        var result = new Application.Validators.MenuItems.SaveMenuItemRequestValidator().Validate(request);

        Assert.Equal(("Sizes[0].Price", "Giá phải là bội số 1.000 ₫"), (result.Errors.Single().PropertyName, result.Errors.Single().ErrorMessage));
    }

    [Fact]
    public async Task Tc03_DeleteSoldItem_Rejected_UpdateReplacesSizes()
    {
        var m009 = await _pos.ItemIdAsync("M009");
        var error = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IMenuItemService>(s => s.DeleteAsync(m009)));
        Assert.Equal("Món đã có trong hóa đơn, chỉ có thể ẩn", error.Message);

        var item = await _host.CallAsync<IMenuItemService, MenuItemDto>(s => s.GetByIdAsync(m009));
        Assert.True(item.EverSold);

        var updated = await _host.CallAsync<IMenuItemService, MenuItemDto>(s => s.UpdateAsync(m009, new SaveMenuItemRequest
        {
            Code = item.Code,
            Name = item.Name,
            CategoryId = item.CategoryId,
            Sizes = [new SaveMenuItemSizeInput { Name = "M", Price = 36_000, IsDefault = true }],
            ToppingIds = item.ToppingIds
        }));
        Assert.Equal(("M", 36_000m), (Assert.Single(updated.Sizes).Name, updated.MinPrice));

        await _host.CallAsync<IMenuItemService>(s => s.SetHiddenAsync(m009, new SetHiddenRequest { IsHidden = true }));
        var bundle = await _host.CallAsync<IMenuService, MenuBundle>(s => s.GetBundleAsync());
        Assert.DoesNotContain(bundle.Items, i => i.Id == m009);
    }

    [Fact]
    public async Task Tc04_ToppingSoldOut_CheckoutRejectedForAnyItem()
    {
        var tp01 = await _pos.ToppingIdAsync("TP01");
        await _host.CallAsync<IToppingService>(s => s.SetAvailabilityAsync(tp01, new SetAvailabilityRequest { IsSoldOut = true }));

        var toppings = await _host.CallAsync<IToppingService, IReadOnlyList<ToppingDto>>(s => s.GetListAsync());
        Assert.Equal(MenuItemStatus.TamHet, toppings.Single(t => t.Id == tp01).Status);

        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();
        var error = await Assert.ThrowsAsync<ValidationException>(() => _pos.CheckoutAsync(PosScenario.Checkout([line], 108_000)));
        Assert.Equal(("items[0].toppingIds", "Trân châu đang tạm hết"), (error.Errors.Single().PropertyName, error.Errors.Single().ErrorMessage));
    }

    [Fact]
    public async Task Category_DeleteWithItems_Rejected_Reorder()
    {
        var categories = await _host.CallAsync<ICategoryService, IReadOnlyList<CategoryDto>>(s => s.GetListAsync());
        var coffee = categories.Single(c => c.Code == "CF");

        var error = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<ICategoryService>(s => s.DeleteAsync(coffee.Id)));
        Assert.StartsWith($"Danh mục đang có {coffee.ItemCount} món", error.Message);

        var ids = categories.Select(c => c.Id).Reverse().ToList();
        await _host.CallAsync<ICategoryService>(s => s.ReorderAsync(new ReorderCategoriesRequest { Ids = ids }));
        var after = await _host.CallAsync<ICategoryService, IReadOnlyList<CategoryDto>>(s => s.GetListAsync());
        Assert.Equal(ids, after.Select(c => c.Id));
        Assert.Equal([10, 20, 30, 40, 50, 60], after.Select(c => c.SortOrder));

        var incomplete = await Assert.ThrowsAsync<ValidationException>(() =>
            _host.CallAsync<ICategoryService>(s => s.ReorderAsync(new ReorderCategoriesRequest { Ids = ids.Skip(1).ToList() })));
        Assert.Equal("ids", incomplete.Errors.Single().PropertyName);
    }
}
