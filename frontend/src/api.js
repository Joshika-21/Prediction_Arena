const API_BASE = 'https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io';

export const api = {
  makePrediction: async (userId, eventId, predictedValue) => {
    try {
      const response = await fetch(`${API_BASE}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          eventId: eventId || "event_001",
          prediction: eventId,
          category: "General",
          confidence: predictedValue * 100,
          deadline: "2026-12-31"
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to save prediction:', error.message);
      throw error;
    }
  },

  getLeaderboard: async () => {
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.leaderboard.map(player => ({
        playerName: player.userId,
        score: player.avgBrierScore
      }));
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error.message);
      return [];
    }
  }
};