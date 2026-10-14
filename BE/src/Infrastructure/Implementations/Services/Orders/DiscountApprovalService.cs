using System.Collections.Concurrent;
using System.Security.Cryptography;
using Application.Common.Exceptions;
using Application.Constants;
using Application.DTOs.Orders;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Auth;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Roles;
using Domain.Common;
using Domain.Entities.Pos;
using Domain.Entities.System.Users;
using Infrastructure.Implementations.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

/// <summary>
/// Xác nhận giảm giá vượt hạn mức (FR-15, 07 §2.5): kiểm tra mật khẩu quản lý như đăng nhập (vẫn đếm sai mật khẩu, BR-SYS-03)
/// nhưng không tạo phiên, không ghi LastLoginAt. Token giữ trong bộ nhớ tiến trình 5 phút, dùng một lần.
/// </summary>
public sealed class DiscountApprovalService(
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    IPermissionService permissionService,
    TimeProvider timeProvider) : IDiscountApprovalService
{
    public const string NoPermissionMessage = "Tài khoản không có quyền xác nhận giảm giá";
    public const string InvalidTokenMessage = "Mã xác nhận của quản lý không hợp lệ, xác nhận lại";

    private static readonly ConcurrentDictionary<string, Entry> Tokens = new(StringComparer.Ordinal);

    public async Task<DiscountApprovalDto> ApproveAsync(DiscountApprovalRequest request, CancellationToken ct = default)
    {
        var username = User.NormalizeUsername(request.Username);
        var user = await users.Query().FirstOrDefaultAsync(u => u.Username == username, ct);
        var now = timeProvider.GetUtcNow().UtcDateTime;

        // Sai tên hoặc mật khẩu trả 400 (không dùng 401 để FE không làm mới token của thu ngân).
        if (user is null)
            throw new DomainException(AuthService.InvalidCredentialsMessage);
        if (user.IsLockedOut(now))
            throw new DomainException(LockedOutMessage(user, now));

        if (!passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            user.RegisterFailedLogin(now);
            await unitOfWork.SaveChangesAsync(ct);
            throw new DomainException(user.IsLockedOut(now) ? LockedOutMessage(user, now) : AuthService.InvalidCredentialsMessage);
        }

        if (!user.IsActive)
            throw new DomainException(AuthService.AccountLockedMessage);

        if (!await permissionService.HasPermissionAsync(user.Id, ProjectPermissions.Orders.DiscountOverride, ct))
            throw new ForbiddenException(NoPermissionMessage);

        Prune(now);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var expiresAt = now.Add(PosRules.DiscountApprovalLifetime);
        Tokens[token] = new Entry(user.Id, user.Username, expiresAt);

        return new DiscountApprovalDto
        {
            Token = token,
            ApprovedById = user.Id,
            ApprovedByName = user.Username,
            ExpiresAt = expiresAt
        };
    }

    public (Guid Id, string Username)? Consume(string? token)
    {
        if (string.IsNullOrWhiteSpace(token) || !Tokens.TryRemove(token.Trim(), out var entry))
            return null;

        return entry.ExpiresAt > timeProvider.GetUtcNow().UtcDateTime ? (entry.UserId, entry.Username) : null;
    }

    private static void Prune(DateTime now)
    {
        foreach (var (key, entry) in Tokens)
        {
            if (entry.ExpiresAt <= now)
                Tokens.TryRemove(key, out _);
        }
    }

    private static string LockedOutMessage(User user, DateTime now)
    {
        var minutes = Math.Max(1, (int)Math.Ceiling((user.LockoutEndAt!.Value - now).TotalMinutes));
        return $"Tài khoản tạm khóa đăng nhập, thử lại sau {minutes} phút";
    }

    private sealed record Entry(Guid UserId, string Username, DateTime ExpiresAt);
}
