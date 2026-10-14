using Application;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Domain.Entities.System.Users;
using Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace UnitTests.TestSupport;

/// <summary>
/// DI thật của Application + Infrastructure trên SQLite trong bộ nhớ, <c>DEMO_MODE=true</c> nên dữ liệu mẫu
/// <c>demo-data.json</c> được nạp như khi chạy thật (theo mẫu <c>CmsTestHost</c> của dự án 01).
/// Đồng hồ giả: 12:00 thứ Tư 14/10/2026 giờ Việt Nam (ca sáng hôm nay đã chốt lúc 11:45, chưa tới khung giờ khuyến mãi KM01).
/// Người dùng hiện tại đổi được qua <see cref="SignInAsync"/>.
/// </summary>
public sealed class PosTestHost : IAsyncDisposable
{
    public const string DemoPassword = "Demo@123";

    /// <summary>05:00 UTC = 12:00 giờ Việt Nam.</summary>
    public static readonly DateTimeOffset Start = new(2026, 10, 14, 5, 0, 0, TimeSpan.Zero);

    private readonly SqliteConnection _keepAlive;
    private readonly ServiceProvider _services;

    private PosTestHost(SqliteConnection keepAlive, ServiceProvider services, FakeTimeProvider time, TestCurrentUser currentUser)
    {
        _keepAlive = keepAlive;
        _services = services;
        Time = time;
        CurrentUser = currentUser;
    }

    public FakeTimeProvider Time { get; }

    public TestCurrentUser CurrentUser { get; }

    public static async Task<PosTestHost> StartAsync(DateTimeOffset? start = null)
    {
        var time = new FakeTimeProvider(start ?? Start);
        var connectionString = $"Data Source=pos-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";

        // Giữ một kết nối mở để DB SQLite trong bộ nhớ tồn tại suốt bài test.
        var keepAlive = new SqliteConnection(connectionString);
        await keepAlive.OpenAsync();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Provider"] = "Sqlite",
                ["Database:ConnectionString"] = connectionString,
                ["Jwt:Key"] = new string('k', 48),
                ["Jwt:Issuer"] = "unit-test",
                ["Jwt:Audience"] = "unit-test",
                ["Demo:Enabled"] = "true",
                ["Demo:Password"] = DemoPassword
            })
            .Build();

        var currentUser = new TestCurrentUser();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<TimeProvider>(time);
        services.AddSingleton<IHostEnvironment>(new TestHostEnvironment());

        // Đăng ký trước AddInfrastructure: bản quét tự động dùng TryAdd nên giữ bản giả này.
        services.AddSingleton<ICurrentUserService>(currentUser);
        services.AddApplication();
        services.AddInfrastructure(configuration);
        var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });

        await provider.InitializeDatabaseAsync();
        return new PosTestHost(keepAlive, provider, time, currentUser);
    }

    public async Task<T> RunAsync<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    public async Task RunAsync(Func<IServiceProvider, Task> action)
    {
        await using var scope = _services.CreateAsyncScope();
        await action(scope.ServiceProvider);
    }

    /// <summary>Lấy service trong scope mới (như một request) rồi gọi.</summary>
    public Task<T> CallAsync<TService, T>(Func<TService, Task<T>> action)
        where TService : notnull =>
        RunAsync(sp => action(sp.GetRequiredService<TService>()));

    public Task CallAsync<TService>(Func<TService, Task> action)
        where TService : notnull =>
        RunAsync(sp => action(sp.GetRequiredService<TService>()));

    /// <summary>Truy vấn chỉ đọc một bảng qua repository.</summary>
    public Task<T> QueryAsync<TEntity, T>(Func<IQueryable<TEntity>, Task<T>> query)
        where TEntity : Domain.Base.BaseEntity =>
        RunAsync(sp => query(sp.GetRequiredService<IGenericRepository<TEntity>>().QueryNoTracking()));

    /// <summary>Đặt người dùng hiện tại là tài khoản demo <paramref name="username"/>; null là khách.</summary>
    public async Task<Guid?> SignInAsync(string? username)
    {
        if (username is null)
        {
            CurrentUser.Set(null, null);
            return null;
        }

        var userId = await QueryAsync<User, Guid>(q => q.Where(u => u.Username == username).Select(u => u.Id).SingleAsync());
        CurrentUser.Set(userId, username);
        return userId;
    }

    public async ValueTask DisposeAsync()
    {
        await _services.DisposeAsync();
        await _keepAlive.DisposeAsync();
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "UnitTests";
        public string ContentRootPath { get; set; } = Path.Combine(AppContext.BaseDirectory, "pos-test-root");
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

/// <summary>Người dùng hiện tại giả, đổi được giữa các bước test.</summary>
public sealed class TestCurrentUser : ICurrentUserService
{
    public Guid? UserId { get; private set; }
    public string? Username { get; private set; }
    public Guid? SessionId => null;
    public bool IsAuthenticated => UserId.HasValue;
    public string? IpAddress => "127.0.0.1";

    public void Set(Guid? userId, string? username)
    {
        UserId = userId;
        Username = username;
    }
}
