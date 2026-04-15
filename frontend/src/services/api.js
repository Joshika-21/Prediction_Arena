const API_BASE_URL = "https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io"

export const apiService = {
  getEvents: async () => {
    const res = await fetch(`${API_BASE_URL}/events`)
    if (!res.ok) throw new Error('Failed to fetch events')
    return res.json()
  },

  getEvent: async (eventId) => {
    const res = await fetch(`${API_BASE_URL}/events/${eventId}`)
    if (!res.ok) throw new Error('Failed to fetch event')
    return res.json()
  },

  makePrediction: async (userId, eventId, prediction, category, confidence, deadline) => {
    const res = await fetch(`${API_BASE_URL}/predictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventId, prediction, category, confidence, deadline })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.detail || 'Prediction failed')
    }
    return res.json()
  },

  getLeaderboard: async () => {
    const res = await fetch(`${API_BASE_URL}/leaderboard`)
    if (!res.ok) throw new Error('Failed to fetch leaderboard')
    const data = await res.json()
    return data.leaderboard || data
  },

  getUserPredictions: async (username) => {
    const res = await fetch(`${API_BASE_URL}/users/${username}/predictions`)
    if (!res.ok) throw new Error('Failed to fetch user predictions')
    return res.json()
  },

  login: async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.detail || 'Login failed')
    }
    return res.json()
  },

  register: async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.detail || 'Registration failed')
    }
    return res.json()
  }
}

export default API_BASE_URL