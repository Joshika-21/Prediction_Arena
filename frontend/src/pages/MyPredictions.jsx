import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io";
const CATEGORY_ICONS = { Trending:"🔥", Elections:"🗳️", Politics:"🏛️", Sports:"⚽", Culture:"🎭", Crypto:"₿", Climate:"🌍", Economics:"📈", Companies:"🏢", Financials:"💹", "Tech & Science":"🔬" };

export default function MyPredictions({ user }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchPredictions();
  }, [user]);

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

  const resolved = predictions.filter(p => p.status === "resolved");
  const pending = predictions.filter(p => p.status === "pending");
  const displayed = activeTab === "all" ? predictions : activeTab === "resolved" ? resolved : pending;

  const avgBrier = resolved.length > 0
    ? (resolved.reduce((sum, p) => sum + (p.brierScore || 0), 0) / resolved.length).toFixed(4)
    : null;

  return (
    <div style={{ minHeight:"100vh", background:"#0d1117", fontFamily:"Inter,-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#111827", borderBottom:"1px solid #1f2937", padding:"16px 32px", display:"flex", alignItems:"center", gap:"16px" }}>
        <button onClick={()=>navigate("/")} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:"14px", display:"flex", alignItems:"center", gap:"6px" }}>
          ← Back
        </button>
        <h1 style={{ color:"#f9fafb", fontSize:"18px", fontWeight:600 }}>My Predictions</h1>
        <span style={{ color:"#6b7280", fontSize:"13px" }}>@{user?.username}</span>
      </div>

      <div style={{ maxWidth:"1000px", margin:"0 auto", padding:"24px 32px" }}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"24px" }}>
          {[
            ["Total Predictions", predictions.length, "#f9fafb"],
            ["Resolved", resolved.length, "#10b981"],
            ["Avg Brier Score", avgBrier || "N/A", "#2563eb"]
          ].map(([label, value, color]) => (
            <div key={label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:"10px", padding:"20px", textAlign:"center" }}>
              <div style={{ color, fontSize:"28px", fontWeight:700, fontFamily:"monospace" }}>{value}</div>
              <div style={{ color:"#6b7280", fontSize:"13px", marginTop:"4px" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:"0", borderBottom:"1px solid #1f2937", marginBottom:"20px" }}>
          {[["all","All",predictions.length],["pending","Pending",pending.length],["resolved","Resolved",resolved.length]].map(([tab,label,count])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{ background:"none", border:"none", borderBottom:activeTab===tab?"2px solid #2563eb":"2px solid transparent", padding:"10px 20px", color:activeTab===tab?"#f9fafb":"#6b7280", fontSize:"14px", fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}>
              {label} <span style={{ background:"#1f2937", color:"#9ca3af", padding:"1px 7px", borderRadius:"10px", fontSize:"12px" }}>{count}</span>
            </button>
          ))}
        </div>

        {/* Predictions list */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px", color:"#6b7280", fontSize:"14px" }}>Loading predictions...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px", color:"#6b7280" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>📭</div>
            <p style={{ fontSize:"14px" }}>No predictions yet. Go make some!</p>
            <button onClick={()=>navigate("/")} style={{ marginTop:"16px", padding:"10px 24px", background:"#2563eb", color:"#fff", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"14px", fontWeight:500 }}>Browse Markets</button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {displayed.map((p, i) => (
              <div key={i} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:"10px", padding:"20px", display:"flex", alignItems:"center", gap:"16px" }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}>
                    <span style={{ color:"#6b7280", fontSize:"12px" }}>{CATEGORY_ICONS[p.category]} {p.category}</span>
                    <span style={{ background:p.status==="resolved"?"#064e3b":"#1e3a5f", color:p.status==="resolved"?"#34d399":"#93c5fd", fontSize:"11px", fontWeight:600, padding:"2px 8px", borderRadius:"4px" }}>
                      {p.status==="resolved"?"Resolved":"Pending"}
                    </span>
                  </div>
                  <p style={{ color:"#e5e7eb", fontSize:"14px", fontWeight:500, marginBottom:"4px" }}>{p.prediction}</p>
                  <p style={{ color:"#6b7280", fontSize:"12px" }}>
                    Submitted {new Date(p.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                  </p>
                </div>

                <div style={{ textAlign:"center", minWidth:"80px" }}>
                  {(() => {
                    const isYes = p.confidence >= 50;
                    const displayConf = isYes ? Math.round(p.confidence) : Math.round(100 - p.confidence);
                    return (
                      <>
                        <div style={{ color: isYes ? "#10b981" : "#ef4444", fontSize:"20px", fontWeight:700 }}>{displayConf}%</div>
                        <div style={{ color:"#6b7280", fontSize:"11px" }}>{isYes ? "YES" : "NO"} prediction</div>
                      </>
                    );
                  })()}
                </div>

                {p.status === "resolved" && p.brierScore !== null && (
                  <div style={{ textAlign:"center", minWidth:"80px", borderLeft:"1px solid #1f2937", paddingLeft:"16px" }}>
                    <div style={{ color:"#2563eb", fontSize:"20px", fontWeight:700, fontFamily:"monospace" }}>{p.brierScore?.toFixed(4)}</div>
                    <div style={{ color:"#6b7280", fontSize:"11px" }}>Brier Score</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}