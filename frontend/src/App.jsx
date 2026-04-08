import { useState, useEffect } from "react";
import { api } from "./api";

const colors = {
  primaryBg: "linear-gradient(135deg, #0a0e27, #1a1a3e, #0f1b4c)",
  cardBg: "#141428",
  button: "#00d9ff",
  accent: "#ff006e",
  text: "#ffffff",
  textMuted: "#b0b0d0",
  green: "#00ff41",
  red: "#ff4444",
  border: "#2a2a5e"
};

export default function App() {
  const [playerName, setPlayerName] = useState("");
  const [question, setQuestion] = useState("");
  const [probability, setProbability] = useState("");
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]); 

  //Leaderboard polling
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await api.getLeaderboard();
        setLeaderboard(data); 
      } catch (err) {
        console.error("Leaderboard fetch failed:", err);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }
    if (probability === "" || probability < 0 || probability > 1) {
      setError("Probability must be between 0 and 1");
      return;
    }

    setLoading(true);

    try {
      const result = await api.makePrediction(
        playerName,
        question,
        Number(probability)
      );

      console.log("Prediction saved:", result);

      setHistory(prev => [
        ...prev,
        {
          playerName,
          question,
          probability: Number(probability),
          saved: true
        }
      ]);

      setQuestion("");
      setProbability("");
    } catch (err) {
      console.error("Error:", err);
      setError(`Error: ${err.message}`);

      setHistory(prev => [
        ...prev,
        {
          playerName,
          question,
          probability: Number(probability),
          saved: false
        }
      ]);

      setQuestion("");
      setProbability("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'Space Grotesk', 'Courier New', monospace",
      minHeight: "100vh",
      padding: "30px 20px",
      background: colors.primaryBg,
      color: colors.text
    }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>

        {/* Title */}
        <h1 style={{
          textAlign: "center",
          color: colors.accent,
          marginBottom: "40px",
          fontSize: "2.5rem",
          margin: "0 0 40px 0",
          fontWeight: "bold",
          letterSpacing: "2px",
          textShadow: "0 0 10px rgba(255, 0, 110, 0.8), 0 0 20px rgba(255, 0, 110, 0.5)"
        }}>
           PREDICTION ARENA
        </h1>

        {/* User Profile*/}
        <div style={{
          background: colors.cardBg,
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "30px",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 0 10px rgba(0, 217, 255, 0.3), inset 0 0 10px rgba(0, 217, 255, 0.1)"
        }}>
          <label style={{
            display: "block",
            color: colors.textMuted,
            marginBottom: "8px",
            fontSize: "12px",
            fontWeight: "bold"
          }}>
            👤 YOUR NAME
          </label>

          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              background: "#0a0e1a",
              color: colors.text,
              boxSizing: "border-box",
              fontSize: "14px"
            }}
          />

          {playerName && (
            <p style={{
              color: colors.green,
              margin: "8px 0 0 0",
              fontSize: "12px",
              textShadow: "0 0 8px rgba(0, 255, 65, 0.6)"
            }}>
              ✓ {playerName}
            </p>
          )}
        </div>

        {/* Prediction Form */}
        <form onSubmit={handleSubmit} style={{
          background: colors.cardBg,
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "30px",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 0 10px rgba(0, 217, 255, 0.3), inset 0 0 10px rgba(0, 217, 255, 0.1)"
        }}>
          <h2 style={{
            color: colors.textMuted,
            fontSize: "16px",
            margin: "0 0 20px 0",
            fontWeight: "bold"
          }}>
            📉 MAKE YOUR PREDICTION
          </h2>

          {error && (
            <div style={{
              background: colors.red + "30",
              border: `1px solid ${colors.red}`,
              color: colors.red,
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "15px",
              fontSize: "12px",
              boxShadow: "0 0 10px rgba(255, 68, 68, 0.3)"
            }}>
              {error}
            </div>
          )}

          <label style={{
            display: "block",
            color: colors.textMuted,
            marginBottom: "6px",
            fontSize: "12px",
            fontWeight: "bold"
          }}>
            Question
          </label>

          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What is your prediction?"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              background: "#0a0e1a",
              color: colors.text,
              boxSizing: "border-box",
              marginBottom: "15px",
              fontSize: "14px"
            }}
          />

          <label style={{
            display: "block",
            color: colors.textMuted,
            marginBottom: "6px",
            fontSize: "12px",
            fontWeight: "bold"
          }}>
            Probability (0 - 1)
          </label>

          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            placeholder="How confident are you?"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              background: "#0a0e1a",
              color: colors.text,
              boxSizing: "border-box",
              marginBottom: "15px",
              fontSize: "14px"
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? colors.textMuted : colors.button,
              color: "#000",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              opacity: loading ? 0.6 : 1,
              boxShadow: loading ? "none" : "0 0 20px rgba(0, 217, 255, 0.5)"
            }}
          >
            {loading ? "SUBMITTING..." : "SUBMIT PREDICTION"}
          </button>
        </form>

        {/* Prediction History */}
        <div>
          <h2 style={{
            color: colors.accent,
            fontSize: "16px",
            margin: "0 0 15px 0",
            fontWeight: "bold",
            textShadow: "0 0 10px rgba(255, 0, 110, 0.5)"
          }}>
            📝 HISTORY ({history.length})
          </h2>

          {history.length === 0 ? (
            <p style={{
              color: colors.textMuted,
              textAlign: "center",
              padding: "20px",
              background: colors.cardBg,
              borderRadius: "8px",
              border: `1px solid ${colors.border}`
            }}>
              No predictions yet. Make your first prediction above!
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {history.map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    background: colors.cardBg,
                    padding: "12px",
                    marginBottom: "10px",
                    borderRadius: "8px",
                    border: `1px solid ${item.saved ? colors.border : colors.red}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: item.saved 
                      ? "0 0 8px rgba(0, 217, 255, 0.2)" 
                      : "0 0 8px rgba(255, 68, 68, 0.3)"
                  }}
                >
                  <div>
                    <p style={{
                      margin: 0,
                      color: colors.text,
                      fontSize: "14px",
                      fontWeight: "bold"
                    }}>
                      {item.question}
                    </p>
                    <p style={{
                      margin: "4px 0 0 0",
                      color: colors.textMuted,
                      fontSize: "12px"
                    }}>
                      {item.playerName}
                      {!item.saved && " (offline)"}
                    </p>
                  </div>
                  <p style={{
                    margin: 0,
                    color: colors.button,
                    fontWeight: "bold",
                    fontSize: "14px",
                    textShadow: "0 0 8px rgba(0, 217, 255, 0.6)"
                  }}>
                    {(item.probability * 100).toFixed(0)}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Leaderboard */}
        <div style={{
          marginTop: "30px",
          background: colors.cardBg,
          padding: "20px",
          borderRadius: "12px",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 0 10px rgba(0, 217, 255, 0.3), inset 0 0 10px rgba(0, 217, 255, 0.1)"
        }}>
          <h2 style={{ 
            color: colors.accent,
            textShadow: "0 0 10px rgba(255, 0, 110, 0.5)"
          }}>
            🏅 Leaderboard
          </h2>

          {leaderboard.length === 0 ? (
            <p style={{ color: colors.textMuted }}>No data yet</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {leaderboard.map((user, idx) => (
                <li key={idx} style={{ 
                  marginBottom: "8px",
                  color: colors.text
                }}>
                  <strong>{user.playerName}</strong> — {user.score}
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}