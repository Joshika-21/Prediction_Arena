using Azure.Messaging.ServiceBus;
using Microsoft.AspNetCore.SignalR;
using System.Linq;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed(_ => true)
            .AllowCredentials();
    });
});

builder.Services.AddSignalR();

builder.Services.AddSingleton(sp =>
{
    var connectionString = builder.Configuration["ServiceBus:ConnectionString"];
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("ServiceBus:ConnectionString is missing.");
    }

    return new ServiceBusClient(connectionString);
});

builder.Services.AddSingleton<LeaderboardQueueListener>();
builder.Services.AddHostedService(sp=>sp.GetRequiredService<LeaderboardQueueListener>());

var app = builder.Build();

app.UseCors();

// Server running check
app.MapGet("/", () => "Leaderboard Service Running");

// Leaderboard test endpoint
app.MapGet("/leaderboard", () =>
{
    var ranked = LeaderboardData.GetRankedLeaderboard();
    return ranked;
});
    

app.MapHub<LeaderboardHub>("/leaderboardHub");

app.Run();

class LeaderboardHub : Hub
{
    public async Task GetLeaderboard()
    {
        var ranked = LeaderboardData.GetRankedLeaderboard();
        await Clients.All.SendAsync("ReceiveLeaderboard", ranked);
    }
}

class LeaderboardQueueListener : IHostedService, IAsyncDisposable
{
    private readonly ServiceBusProcessor _processor;
    private readonly IHubContext<LeaderboardHub> _hubContext;

    public LeaderboardQueueListener(
        ServiceBusClient client,
        IConfiguration configuration,
        IHubContext<LeaderboardHub> hubContext)
    {
        var queueName = configuration["ServiceBus:QueueName"] ?? "scores-updated";

        _processor = client.CreateProcessor(queueName, new ServiceBusProcessorOptions());
        _hubContext = hubContext;

        _processor.ProcessMessageAsync += HandleMessageAsync;
        _processor.ProcessErrorAsync += HandleErrorAsync;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await _processor.StartProcessingAsync(cancellationToken);
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        await _processor.StopProcessingAsync(cancellationToken);
    }

    private async Task HandleMessageAsync(ProcessMessageEventArgs args)
    {
        // Push mock leaderboard
        var ranked = LeaderboardData.GetRankedLeaderboard();

        await _hubContext.Clients.All.SendAsync("ReceiveLeaderboard", ranked);

        await args.CompleteMessageAsync(args.Message);
    }

    private Task HandleErrorAsync(ProcessErrorEventArgs args)
    {
        Console.WriteLine($"Service Bus error: {args.Exception.Message}");
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        await _processor.DisposeAsync();
    }
}

static class LeaderboardData
{
    public static List<LeaderboardItem> GetRankedLeaderboard()
    {
        var users = GetCurrentScores();

        return users
            .OrderByDescending(u => u.Score)
            .Select((u, index) => new LeaderboardItem(
                Rank: index + 1,
                Name: u.Name,
                Score: u.Score))
            .ToList();
    }

    // test/mock data
    private static List<UserScore> GetCurrentScores()
    {
        return new List<UserScore>
        {
            new UserScore("Alice", 0.12),
            new UserScore("Bob", 0.05),
            new UserScore("Charlie", 0.20)
        };
    }
}

record UserScore(string Name, double Score);
record LeaderboardItem(int Rank, string Name, double Score);