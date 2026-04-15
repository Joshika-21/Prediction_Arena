import { useState, useEffect } from 'react'

const API_BASE = "https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io"

function Leaderboard() {
    const [players, setPlayers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchLeaderboard()
        const interval = setInterval(fetchLeaderboard, 10000)
        return () => clearInterval(interval)
    }, [])

    const fetchLeaderboard = async () => {
        try {
            const response = await fetch(`${API_BASE}/leaderboard`)
            const data = await response.json()
            setPlayers(data.leaderboard || data)
            setError(null)
        } catch (err) {
            setError("Failed to load leaderboard!")
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="page"><h1>Loading... ⏳</h1></div>
    if (error) return <div className="page"><h1>{error}</h1></div>

    return (
        <div className="page">
            <h1>Leaderboard 🏆</h1>
            <p>Lower Brier Score = Better Predictor!</p>
            <div className="leaderboard">
                <div className="leaderboard-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>Avg Brier Score</span>
                    <span>Predictions</span>
                </div>
                {players.map(player => (
                    <div key={player.rank} className="leaderboard-row">
                        <span className="rank">
                            {player.rank === 1 ? '🥇' :
                             player.rank === 2 ? '🥈' :
                             player.rank === 3 ? '🥉' :
                             `#${player.rank}`}
                        </span>
                        <span className="player-name">{player.userId}</span>
                        <span className="score">{player.avgBrierScore?.toFixed(4)}</span>
                        <span className="predictions">{player.totalPredictions}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Leaderboard