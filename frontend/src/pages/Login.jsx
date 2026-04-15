import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io";

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
      // Save to localStorage
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
    <div style={{ minHeight:"100vh", background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,-apple-system,sans-serif" }}>
      <div style={{ width:"400px", maxWidth:"90vw" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{ fontSize:"28px", fontWeight:700, marginBottom:"8px" }}>
            <span style={{ color:"#2563eb" }}>Prediction</span>
            <span style={{ color:"#f9fafb" }}> Arena</span>
          </div>
          <p style={{ color:"#6b7280", fontSize:"14px" }}>
            {isLogin ? "Welcome back! Sign in to continue." : "Create an account to start predicting."}
          </p>
        </div>

        {/* Card */}
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:"12px", padding:"32px" }}>
          {/* Tabs */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", background:"#0d1117", borderRadius:"8px", padding:"4px", marginBottom:"24px" }}>
            <button onClick={()=>{ setIsLogin(true); setError(""); }} style={{ padding:"8px", background:isLogin?"#1f2937":"transparent", border:"none", borderRadius:"6px", color:isLogin?"#f9fafb":"#6b7280", fontSize:"14px", fontWeight:500, cursor:"pointer", transition:"all 0.2s" }}>
              Sign In
            </button>
            <button onClick={()=>{ setIsLogin(false); setError(""); }} style={{ padding:"8px", background:!isLogin?"#1f2937":"transparent", border:"none", borderRadius:"6px", color:!isLogin?"#f9fafb":"#6b7280", fontSize:"14px", fontWeight:500, cursor:"pointer", transition:"all 0.2s" }}>
              Register
            </button>
          </div>

          {/* Form */}
          <div style={{ marginBottom:"16px" }}>
            <label style={{ color:"#9ca3af", fontSize:"12px", fontWeight:500, display:"block", marginBottom:"6px" }}>USERNAME</label>
            <input
              value={username}
              onChange={e=>setUsername(e.target.value)}
              placeholder="Enter username"
              style={{ width:"100%", padding:"10px 14px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#f9fafb", fontSize:"14px", boxSizing:"border-box", outline:"none" }}
            />
          </div>

          <div style={{ marginBottom:"24px" }}>
            <label style={{ color:"#9ca3af", fontSize:"12px", fontWeight:500, display:"block", marginBottom:"6px" }}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="Enter password"
              onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
              style={{ width:"100%", padding:"10px 14px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#f9fafb", fontSize:"14px", boxSizing:"border-box", outline:"none" }}
            />
          </div>

          {error && (
            <div style={{ background:"#2d0a0a", border:"1px solid #ef4444", borderRadius:"6px", padding:"10px 14px", marginBottom:"16px" }}>
              <p style={{ color:"#f87171", fontSize:"13px", margin:0 }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width:"100%", padding:"12px", background:loading?"#1f2937":"#2563eb", color:loading?"#6b7280":"#fff", border:"none", borderRadius:"8px", cursor:loading?"not-allowed":"pointer", fontWeight:600, fontSize:"15px", transition:"all 0.2s" }}
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </button>

          <p style={{ textAlign:"center", color:"#6b7280", fontSize:"13px", marginTop:"20px" }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={()=>{ setIsLogin(!isLogin); setError(""); }} style={{ background:"none", border:"none", color:"#2563eb", cursor:"pointer", fontSize:"13px", fontWeight:500 }}>
              {isLogin ? "Register" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}