import { useState, useEffect } from 'react'
import axios from 'axios'
import API_BASE_URL from '../services/api'

function Leaderboard() {
    const [players, setPlayers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchLeaderboard()
        // Poll every 10 seconds automatically
        const interval = setInterval(() => {
            fetchLeaderboard()
        }, 10000)
        // Cleanup when user leaves the page
        return () => clearInterval(interval)
    }, [])
    const fetchLeaderboard = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/leaderboard`)
            setPlayers(response.data.leaderboard)
        } catch (err) {
            setError("Failed to load leaderboard!")
        } finally {
            setLoading(false)
        }
    }
    if (loading) return <div classNmae = "page"><h1>Loading... ⏳</h1></div>
    if (error) return <div className = "page"><h1>{error}</h1></div>
    return (
        <div className = "page">
            <h1>Leaderboard  🏆</h1>
            <p>Lower Brier Score = Better Predictor!</p>
            <div className = "leaderboard">
                <div className = "leaderboard-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>Abg Brier Score</span>
                    <span>Predictions</span>
                </div>
                {players.map(player => (
                    <div key = {player.rank} className = "leaderboard-row">
                        <span classNmae = "rank">
                            {player.rank === 1 ? "🥇" : 
                            player.rank === 2 ? "🥈" : 
                            player.rank === 3 ? "🥉" :
                            '#${player.rank}'}
                        </span>
                        <span className = "player-name"> {player.userId}</span>
                        <span className = "score"> {player.avgBrierScore}</span>
                        <span className = "poredictions">{player.totalPredictions}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
export default Leaderboard