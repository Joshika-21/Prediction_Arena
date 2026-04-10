// src/api.js
// Environment-aware API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = {
  /**
   * Submit a prediction to the backend
   * @param {string} userId - Player name/ID
   * @param {string} eventId - The prediction question
   * @param {number} predictedValue - Probability (0-1)
   * @returns {Promise<Object>} Server response with savedData
   */
  makePrediction: async (userId, eventId, predictedValue) => {
    try {
      const response = await fetch(`${API_BASE}/api/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          eventId,
          predictedValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Prediction saved to database:', data.savedData.id);
      return data;
    } catch (error) {
      console.error('❌ Failed to save prediction:', error.message);
      throw error;
    }
  },

  /**
   * Fetch leaderboard from backend
   * @returns {Promise<Array>} Array of leaderboard entries
   */
  getLeaderboard: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/leaderboard`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('⚠️ Failed to fetch leaderboard:', error.message);
      return [];
    }
  },

  /**
   * Check backend health
   * @returns {Promise<boolean>} True if backend is reachable
   */
  healthCheck: async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};