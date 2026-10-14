using Application.DTOs.StoreProfile;

namespace Application.Interfaces.Services.StoreProfile;

/// <summary>Thông tin quán cho bill và QR, đọc từ cài đặt <c>Store.*</c> (07 §2.10).</summary>
public interface IStoreProfileService
{
    Task<DTOs.StoreProfile.StoreProfile> GetAsync(CancellationToken ct = default);
}
