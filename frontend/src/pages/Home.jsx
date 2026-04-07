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
            <a href="/events" className="btn-primary">
              Browse Events
            </a>
            <a href="/leaderboard" className="btn-secondary">
              View Leaderboard
            </a>
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