import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="page">
      <div className="hero">
        <h1>Welcome to Prediction Arena 🎯</h1>
        <p>
          Predict real world events, compete with friends,
          and improve your forecasting skills!
        </p>
        <div className="hero-buttons">
          <Link to="/" className="btn-primary">
            Browse Markets
          </Link>
          <Link to="/my-predictions" className="btn-secondary">
            My Predictions
          </Link>
        </div>
      </div>
      <div className="features">
        <div className="feature-card">
          <h3>🎯 Make Predictions</h3>
          <p>Predict real world events with a confidence percentage</p>
        </div>
        <div className="feature-card">
          <h3>📊 Brier Score</h3>
          <p>Get scored mathematically on how accurate you are</p>
        </div>
        <div className="feature-card">
          <h3>🏆 Compete</h3>
          <p>Climb the leaderboard and prove your forecasting skills</p>
        </div>
      </div>
    </div>
  )
}

export default Home