// ── Packages ──────────────────────────────────────────────
// NEW: Added Microsoft.Azure.Cosmos to query real scores
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Cosmos.Linq;
using Azure.Messaging.ServiceBus;
using Microsoft.AspNetCore.SignalR;
using System.Linq;

var builder = WebApplication.CreateBuilder(args);

// ── CORS ───────────────────────────────────────────────────
// Same as before - allows frontend to call this service
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

// ── NEW: Cosmos DB Client ──────────────────────────────────
// Just like Yewon registered ServiceBusClient, we register CosmosClient
// It reads the connection string from environment variables
builder.Services.AddSingleton(sp =>
{
    var connectionString = Environment.GetEnvironmentVariable("COSMOS_CONNECTION_STRING")
        ?? throw new InvalidOperationException("COSMOS_CONNECTION_STRING is missing.");
    return new CosmosClient(connectionString);
});

builder.Services.AddSingleton(sp =>
{
    var connectionString = builder.Configuration["ServiceBus:ConnectionString"]
        ?? Environment.GetEnvironmentVariable("SERVICE_BUS_CONNECTION_STRING");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        Console.WriteLine("Warning: ServiceBus:ConnectionString is missing, queue listener disabled.");
        return new ServiceBusClient("Endpoint=sb://dummy.servicebus.windows.net/;SharedAccessKeyName=dummy;SharedAccessKey=dHVmZg==");
    }
    return new ServiceBusClient(connectionString);
});

builder.Services.AddSingleton<LeaderboardQueueListener>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<LeaderboardQueueListener>());

var app = builder.Build();
app.UseCors();

// ── Health check endpoint ──────────────────────────────────
app.MapGet("/", () => "Leaderboard Service Running");

// ── NEW: Real leaderboard endpoint ────────────────────────
// OLD: returned hardcoded mock data
// NEW: queries real scores from Cosmos DB
app.MapGet("/leaderboard", async (CosmosClient cosmosClient) =>
{
    try
    {
        var dbName = Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME") ?? "PredictionArenaDB";
        var containerName = Environment.GetEnvironmentVariable("COSMOS_SCORES_CONTAINER") ?? "scores";

        // Step 1: Get the scores container
        var container = cosmosClient.GetContainer(dbName, containerName);

        // Step 2: Query ALL scores from Cosmos DB
        // This replaces the fake Alice/Bob/Charlie data!
        var query = new QueryDefinition("SELECT * FROM c");
        var scores = new List<ScoreDocument>();

        using var feed = container.GetItemQueryIterator<ScoreDocument>(query);
        while (feed.HasMoreResults)
        {
            var response = await feed.ReadNextAsync();
            scores.AddRange(response);
        }

        // Step 3: Group by userId and calculate average Brier score
        // Example: joshika123 has 3 predictions → average them
        var grouped = scores
            .GroupBy(s => s.user_id)
            .Select(g => new UserScore(
                Name: g.Key,
                Score: g.Average(s => s.brier_score),
                TotalPredictions: g.Count()
            ));

        // Step 4: Sort by LOWEST score first (lower Brier = better predictor)
        // This is the fix from OrderByDescending → OrderBy!
        var ranked = grouped
            .OrderBy(u => u.Score)
            .Select((u, index) => new LeaderboardItem(
                Rank: index + 1,
                UserId: u.Name,
                AvgBrierScore: Math.Round(u.Score, 4),
                TotalPredictions: u.TotalPredictions
            ))
            .ToList();

        return Results.Ok(new { leaderboard = ranked });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Leaderboard error: {ex.Message}");
        return Results.Ok(new { leaderboard = new List<LeaderboardItem>() });
    }
});

app.MapHub<LeaderboardHub>("/leaderboardHub");
app.Run();

// ── SignalR Hub (same as before) ───────────────────────────
class LeaderboardHub : Hub
{
    public async Task GetLeaderboard()
    {
        await Clients.Caller.SendAsync("ReceiveLeaderboard", "Use REST endpoint /leaderboard");
    }
}

// ── Queue Listener (same as before) ───────────────────────
class LeaderboardQueueListener : IHostedService, IAsyncDisposable
{
    private readonly ServiceBusProcessor _processor;
    private readonly IHubContext<LeaderboardHub> _hubContext;

    public LeaderboardQueueListener(
        ServiceBusClient client,
        IConfiguration configuration,
        IHubContext<LeaderboardHub> hubContext)
    {
        var queueName = configuration["ServiceBus:QueueName"]
            ?? Environment.GetEnvironmentVariable("SERVICE_BUS_QUEUE_NAME")
            ?? "scores-updated";
        _processor = client.CreateProcessor(queueName, new ServiceBusProcessorOptions());
        _hubContext = hubContext;
        _processor.ProcessMessageAsync += HandleMessageAsync;
        _processor.ProcessErrorAsync += HandleErrorAsync;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try { await _processor.StartProcessingAsync(cancellationToken); }
        catch (Exception ex) { Console.WriteLine($"Queue listener start failed: {ex.Message}"); }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        try { await _processor.StopProcessingAsync(cancellationToken); }
        catch { }
    }

    private async Task HandleMessageAsync(ProcessMessageEventArgs args)
    {
        Console.WriteLine("Score update received from Service Bus");
        await _hubContext.Clients.All.SendAsync("LeaderboardUpdated", "scores-updated");
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

// ── Data Models ────────────────────────────────────────────
// NEW: ScoreDocument matches exactly what's stored in Cosmos DB scores container
// Fields match: user_id, brier_score, event_id from the scoring engine
record ScoreDocument
{
<<<<<<< HEAD
    public string id { get; init; } = "";
    public string user_id { get; init; } = "";
    public double brier_score { get; init; } = 0;
    public string event_id { get; init; } = "";
    public double actual_outcome { get; init; } = 0;
=======
    public static List<LeaderboardItem> GetRankedLeaderboard()
    {
        var scores = GetCurrentScores();

        var ranked = scores
            .GroupBy(s => s.Name)
            .Select(g => new
            {
                Name = g.Key,
                AverageScore = g.Average(x => x.Score)
            })
            .OrderBy(x => x.AverageScore)
            .Select((x, index) => new LeaderboardItem(
                Rank: index + 1,
                Name: x.Name,
                Score: Math.Round(x.AverageScore, 3)))
            .ToList();

        return ranked;
    }

    // test/mock data
    private static List<UserScore> GetCurrentScores()
    {
        return new List<UserScore>
        {
            new UserScore("Alice", 0.12),
            new UserScore("Alice", 0.18),
            new UserScore("Bob", 0.05),
            new UserScore("Bob", 0.09),
            new UserScore("Charlie", 0.20),
            new UserScore("Charlie", 0.16)
        };
    }
>>>>>>> bf385d7 (Updated leaderboard logic and SignalR connection)
}

// Internal model for grouping
record UserScore(string Name, double Score, int TotalPredictions);

// What we return to the frontend - matches what our frontend expects!
record LeaderboardItem(int Rank, string UserId, double AvgBrierScore, int TotalPredictions);