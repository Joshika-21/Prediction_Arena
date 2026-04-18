import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE;
const CATEGORY_ICONS = { Trending:"🔥", Elections:"🗳️", Politics:"🏛️", Sports:"⚽", Culture:"🎭", Crypto:"₿", Climate:"🌍", Economics:"📈", Companies:"🏢", Financials:"💹", "Tech & Science":"🔬" };

export default function MyPredictions({ user }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    const fetchPredictions = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/${user.username}/predictions`);
        const data = await res.json();
        setPredictions(data.predictions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPredictions();
  }, [user, navigate]);

  const resolved = predictions.filter(p => p.status === "resolved");
  const pending = predictions.filter(p => p.status === "pending");
  const displayed = activeTab === "all" ? predictions : activeTab === "resolved" ? resolved : pending;

  const avgBrier = resolved.length > 0
    ? (resolved.reduce((sum, p) => sum + (p.brierScore || 0), 0) / resolved.length).toFixed(4)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", fontFamily: "Inter,-apple-system,sans-serif" }}>
      {/* Header */}
      <div className="navbar" style={{ padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, height: 58 }}>
          <button onClick={() => navigate("/")} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }}>
            ← Back
          </button>
          <h1 style={{ color: "#f9fafb", fontSize: 18, fontWeight: 700 }}>My Predictions</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{user?.username?.[0]?.toUpperCase()}</div>
            <span style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>@{user?.username}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 32px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            ["Total Predictions", predictions.length, "#6366f1", "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02))"],
            ["Resolved", resolved.length, "#10b981", "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))"],
            ["Avg Brier Score", avgBrier || "N/A", "#f59e0b", "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))"]
          ].map(([label, value, color, bg]) => (
            <div key={label} style={{ background: bg, border: "1px solid #1e2736", borderRadius: 14, padding: 22, textAlign: "center" }}>
              <div style={{ color, fontSize: 30, fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
              <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1e2736", marginBottom: 22 }}>
          {[["all", "All", predictions.length], ["pending", "Pending", pending.length], ["resolved", "Resolved", resolved.length]].map(([tab, label, count]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`category-tab ${activeTab === tab ? "active" : ""}`} style={{ color: activeTab === tab ? "#f9fafb" : "#6b7280", display: "flex", alignItems: "center", gap: 6, padding: "10px 18px" }}>
              {label} <span style={{ background: activeTab === tab ? "rgba(99,102,241,0.15)" : "#1a2233", color: activeTab === tab ? "#a5b4fc" : "#6b7280", padding: "1px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{count}</span>
            </button>
          ))}
        </div>

        {/* Predictions list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-card" style={{ height: 90 }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="animate-fade-in" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📭</div>
            <p style={{ color: "#9ca3af", fontSize: 16, fontWeight: 500, marginBottom: 4 }}>No predictions yet</p>
            <p style={{ color: "#4b5563", fontSize: 14, marginBottom: 20 }}>Start making predictions to see them here</p>
            <button onClick={() => navigate("/")} className="btn-primary" style={{ padding: "10px 28px", fontSize: 14 }}>Browse Markets</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {displayed.map((p, i) => {
              const isYes = p.confidence >= 50;
              const displayConf = isYes ? Math.round(p.confidence) : Math.round(100 - p.confidence);
              return (
                <div key={i} className="event-card animate-fade-in" style={{ animationDelay: `${i * 0.04}s`, display: "flex", alignItems: "center", gap: 16, cursor: "default" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: "#6b7280", fontSize: 12 }}>{CATEGORY_ICONS[p.category]} {p.category}</span>
                      <span className={`badge ${p.status === "resolved" ? "badge-resolved-yes" : "badge-live"}`} style={p.status !== "resolved" ? { background: "rgba(99,102,241,0.1)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" } : {}}>
                        {p.status === "resolved" ? "Resolved" : "Pending"}
                      </span>
                    </div>
                    <p style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{p.prediction}</p>
                    <p style={{ color: "#4b5563", fontSize: 12 }}>
                      Submitted {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>

                  <div style={{ textAlign: "center", minWidth: 70 }}>
                    <div style={{ color: isYes ? "#10b981" : "#ef4444", fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>{displayConf}%</div>
                    <div style={{ color: "#4b5563", fontSize: 11, fontWeight: 500 }}>{isYes ? "YES" : "NO"}</div>
                  </div>

                  {p.status === "resolved" && p.brierScore !== null && (
                    <div style={{ textAlign: "center", minWidth: 80, borderLeft: "1px solid #1e2736", paddingLeft: 16 }}>
                      <div style={{ color: "#6366f1", fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>{p.brierScore?.toFixed(4)}</div>
                      <div style={{ color: "#4b5563", fontSize: 11, fontWeight: 500 }}>Brier Score</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
