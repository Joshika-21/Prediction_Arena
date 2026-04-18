import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const endpoint = isLogin ? "/login" : "/register";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");
      localStorage.setItem("user", JSON.stringify({ userId: data.userId, username: data.username }));
      onLogin({ userId: data.userId, username: data.username });
      navigate("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,-apple-system,sans-serif" }}>
      <div className="animate-fade-in-up" style={{ width: 420, maxWidth: "90vw" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff" }}>P</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              <span style={{ color: "#f9fafb" }}>Prediction</span>
              <span style={{ color: "#6366f1" }}> Arena</span>
            </div>
          </div>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            {isLogin ? "Welcome back! Sign in to continue." : "Create an account to start predicting."}
          </p>
        </div>

        {/* Card */}
        <div className="modal-content" style={{ padding: 32 }}>
          {/* Tabs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#0a0e17", borderRadius: 10, padding: 4, marginBottom: 24 }}>
            <button onClick={() => { setIsLogin(true); setError(""); }} style={{ padding: 9, background: isLogin ? "#1a2233" : "transparent", border: "none", borderRadius: 8, color: isLogin ? "#f9fafb" : "#6b7280", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}>
              Sign In
            </button>
            <button onClick={() => { setIsLogin(false); setError(""); }} style={{ padding: 9, background: !isLogin ? "#1a2233" : "transparent", border: "none", borderRadius: 8, color: !isLogin ? "#f9fafb" : "#6b7280", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}>
              Register
            </button>
          </div>

          {/* Form */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" className="input-field" />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" onKeyDown={e => e.key === "Enter" && handleSubmit()} className="input-field" />
          </div>

          {error && (
            <div className="animate-fade-in" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ width: "100%", padding: 12, fontSize: 15 }}>
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </button>

          <p style={{ textAlign: "center", color: "#6b7280", fontSize: 13, marginTop: 20 }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setIsLogin(!isLogin); setError(""); }} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {isLogin ? "Register" : "Sign In"}
            </button>
          </p>
        </div>

        <button onClick={() => navigate("/")} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 13 }}>
          ← Back to Markets
        </button>
      </div>
    </div>
  );
}
