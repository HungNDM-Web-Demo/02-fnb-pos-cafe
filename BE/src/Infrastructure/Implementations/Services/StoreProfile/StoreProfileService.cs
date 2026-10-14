using Application.Interfaces.Repositories;
using Application.Interfaces.Services.StoreProfile;
using Domain.Entities.System.Settings;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.StoreProfile;

/// <summary>Thông tin quán cho bill và QR từ cài đặt nhóm "Quán" (06 §3, 07 §2.10).</summary>
public sealed class StoreProfileService(IGenericRepository<Setting> settings) : IStoreProfileService
{
    private const string Prefix = "Store.";

    public async Task<Application.DTOs.StoreProfile.StoreProfile> GetAsync(CancellationToken ct = default)
    {
        var values = await settings.QueryNoTracking()
            .Where(s => s.Key.StartsWith(Prefix))
            .ToDictionaryAsync(s => s.Key, s => s.Value, StringComparer.OrdinalIgnoreCase, ct);

        string Get(string name) => values.GetValueOrDefault(Prefix + name) ?? string.Empty;

        return new Application.DTOs.StoreProfile.StoreProfile
        {
            Name = Get("Name"),
            Address = Get("Address"),
            Phone = Get("Phone"),
            ReceiptFooter = Get("ReceiptFooter"),
            BankBin = Get("BankBin"),
            BankAccount = Get("BankAccount"),
            BankAccountName = Get("BankAccountName")
        };
    }
}
