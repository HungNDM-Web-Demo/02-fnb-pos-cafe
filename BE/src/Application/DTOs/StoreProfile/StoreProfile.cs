namespace Application.DTOs.StoreProfile;

/// <summary>Thông tin quán in trên bill và QR (<c>GET /api/store-profile</c>, 07 §2.10), đọc từ cài đặt <c>Store.*</c>.</summary>
public sealed record StoreProfile
{
    public string Name { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string ReceiptFooter { get; init; } = string.Empty;
    public string BankBin { get; init; } = string.Empty;
    public string BankAccount { get; init; } = string.Empty;
    public string BankAccountName { get; init; } = string.Empty;
}
