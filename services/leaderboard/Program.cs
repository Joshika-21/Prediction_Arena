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

var app = builder.Build();

app.UseCors();

// Server running check
app.MapGet("/", () => "Leaderboard Service Running");

// Leaderboard test endpoint
app.MapGet("/leaderboard", () =>
{
    var users = new List<(string name, double score)>
    {
        ("Alice", 0.12),
        ("Bob", 0.05),
        ("Charlie", 0.20)
    };

    var ranked = users
        .OrderByDescending(u => u.score)
        .Select((u, index) => new
        {
            Rank = index + 1,
            Name = u.name,
            Score = u.score
        });

    return ranked;
});

app.MapHub<LeaderboardHub>("/leaderboardHub");

app.Run();

class LeaderboardHub : Hub
{
    public async Task GetLeaderboard()
    {
        // Mock data for testing
        var users = new List<(string name, double score)>
        {
            ("Alice", 0.12),
            ("Bob", 0.05),
            ("Charlie", 0.20)
        };

        var ranked = users
            .OrderByDescending(u => u.score)
            .Select((u, index) => new
            {
                Rank = index + 1,
                Name = u.name,
                Score = u.score
            });

        await Clients.All.SendAsync("ReceiveLeaderboard", ranked);
    }
}

/*
Server running check:
http://localhost:5062/

Leaderboard test endpoint:
http://localhost:5062/leaderboard

Expected output:
[
  { "rank": 1, "name": "Charlie", "score": 0.2 },
  { "rank": 2, "name": "Alice", "score": 0.12 },
  { "rank": 3, "name": "Bob", "score": 0.05 }
]
*/