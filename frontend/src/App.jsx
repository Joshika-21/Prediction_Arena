import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { api, getRealProbability, enrichEventsWithRealData } from "./api";
import Login from "./pages/Login";
import MyPredictions from "./pages/MyPredictions";
import Admin from "./pages/Admin";
import EventDetail from "./pages/EventDetail";

const CATEGORIES = ["Trending", "Elections", "Politics", "Sports", "Culture", "Crypto", "Climate", "Economics", "Companies", "Financials", "Tech & Science"];
const CATEGORY_ICONS = { Trending:"🔥", Elections:"🗳️", Politics:"🏛️", Sports:"⚽", Culture:"🎭", Crypto:"₿", Climate:"🌍", Economics:"📈", Companies:"🏢", Financials:"💹", "Tech & Science":"🔬" };

function generateHistory(base, points=40) {
  const h=[]; let cur=base;
  for(let i=0;i<points;i++){
    cur=Math.max(3,Math.min(97,cur+(Math.random()-0.48)*2));
    h.push(parseFloat(cur.toFixed(1)));
  }
  return h;
}

/* ── Mini Sparkline for Cards ──────────────────────────── */
function MiniSparkline({ data, color = "#6366f1", width = 80, height = 28 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const min = Math.min(...data) - 2;
    const max = Math.max(...data) + 2;
    const range = max - min || 1;
    const toX = i => (i / (data.length - 1)) * W;
    const toY = v => H - ((v - min) / range) * H;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + "20");
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.moveTo(toX(0), H);
    data.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(data.length - 1), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    data.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
    ctx.stroke();
  }, [data, color]);
  return <canvas ref={canvasRef} width={width * 2} height={height * 2} style={{ width, height }} />;
}

/* ── Live Chart for Modal ──────────────────────────────── */
function LiveModalChart({ history }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const min = Math.max(0, Math.min(...history) - 8);
    const max = Math.min(100, Math.max(...history) + 8);
    const range = max - min || 1;
    const toX = i => (i / (history.length - 1)) * (W - 50) + 25;
    const toY = v => H - 25 - ((v - min) / range) * (H - 45);

    // Grid
    for (let i = 0; i <= 4; i++) {
      const y = 15 + (i / 4) * (H - 40);
      ctx.strokeStyle = "#1a2233";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(25, y); ctx.lineTo(W - 15, y); ctx.stroke();
      ctx.fillStyle = "#4b5563";
      ctx.font = "11px Inter,sans-serif";
      ctx.fillText((max - (i / 4) * range).toFixed(0) + "%", 0, y + 4);
    }

    const trend = history[history.length - 1] >= history[0];
    const lineColor = trend ? "#10b981" : "#ef4444";

    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, lineColor + "18");
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.moveTo(toX(0), H - 25);
    history.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(history.length - 1), H - 25);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath(); ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = "round";
    history.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
    ctx.stroke();

    // Endpoint
    const lx = toX(history.length - 1), ly = toY(history[history.length - 1]);
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fillStyle = lineColor; ctx.fill();
    ctx.beginPath(); ctx.arc(lx, ly, 7, 0, Math.PI * 2); ctx.strokeStyle = lineColor + "40"; ctx.lineWidth = 2; ctx.stroke();
  }, [history]);
  return <canvas ref={canvasRef} width={460} height={150} style={{ width: "100%", height: "150px" }} />;
}

/* ── Skeleton Card ─────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ width: "60px", height: "14px", marginBottom: 12 }} />
      <div className="skeleton" style={{ width: "100%", height: "18px", marginBottom: 8 }} />
      <div className="skeleton" style={{ width: "75%", height: "18px", marginBottom: 20 }} />
      <div className="skeleton" style={{ width: "100%", height: "6px", marginBottom: 12 }} />
      <div className="skeleton" style={{ width: "100%", height: "6px", marginBottom: 16 }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="skeleton" style={{ width: "80px", height: "14px" }} />
        <div className="skeleton" style={{ width: "70px", height: "30px", borderRadius: 8 }} />
      </div>
    </div>
  );
}

/* ── Prediction Modal ──────────────────────────────────── */
function PredictionModal({ event, onClose, onSubmit, user }) {
  const [confidence, setConfidence] = useState(event.currentProb || 50);
  const [name, setName] = useState(user?.username || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState(() => generateHistory(event.currentProb || 50));
  const [currentVal, setCurrentVal] = useState(event.currentProb || 50);
  const [dataLabel, setDataLabel] = useState(null);
  const [isRealData, setIsRealData] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getRealProbability(event).then(d => {
      if (d && d.history && d.history.length > 2) {
        setHistory(d.history); setCurrentVal(d.prob);
        setDataLabel(d.label); setIsRealData(true);
      }
    }).catch(() => {});
  }, [event]);

  useEffect(() => {
    const t = setInterval(() => {
      setHistory(prev => {
        const last = prev[prev.length - 1];
        const vol = isRealData ? 0.3 : 1.2;
        const next = Math.max(3, Math.min(97, last + (Math.random() - 0.48) * vol));
        const r = parseFloat(next.toFixed(1));
        setCurrentVal(r);
        return [...prev.slice(-59), r];
      });
    }, isRealData ? 5000 : 1000);
    return () => clearInterval(t);
  }, [isRealData]);

  const trend = history.length > 1 ? currentVal - history[0] : 0;
  const trendUp = trend >= 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ padding: 28, width: 540, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="btn-secondary" style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, borderRadius: 8 }}>✕</button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 500 }}>{CATEGORY_ICONS[event.category]} {event.category}</span>
          {isRealData && <span className="badge badge-live">LIVE DATA</span>}
        </div>

        <h2 style={{ color: "#f9fafb", fontSize: 18, fontWeight: 600, lineHeight: 1.4, marginBottom: 4, paddingRight: 40 }}>{event.title}</h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Closes {new Date(event.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <span style={{ color: trendUp ? "#10b981" : "#ef4444", fontSize: 32, fontWeight: 700, fontFamily: "monospace" }}>{currentVal.toFixed(1)}%</span>
          <span style={{ color: trendUp ? "#10b981" : "#ef4444", fontSize: 14, fontWeight: 500 }}>{trendUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <span className="live-dot" />
            <span style={{ color: "#6b7280", fontSize: 12 }}>{isRealData ? "Real data" : "Live"}</span>
          </span>
        </div>
        {dataLabel && <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>{dataLabel}</p>}

        <div style={{ background: "#0a0e17", borderRadius: 10, padding: "12px 12px 8px", marginBottom: 24, border: "1px solid #1e2736" }}>
          <LiveModalChart history={history} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ color: "#2a3548", fontSize: 11 }}>Earlier</span>
            <span style={{ color: "#2a3548", fontSize: 11 }}>Now</span>
          </div>
        </div>

        {success ? (
          <div className="animate-fade-in-up" style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "2px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>✓</div>
            <p style={{ color: "#10b981", fontSize: 18, fontWeight: 600 }}>Prediction Submitted!</p>
            <p style={{ color: "#6b7280", marginTop: 8, fontSize: 14 }}>You predicted {confidence}% YES</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
              <button onClick={onClose} className="btn-secondary" style={{ padding: "10px 24px", fontSize: 14, fontWeight: 600 }}>Close</button>
              {user && <button onClick={() => { onClose(); navigate("/my-predictions"); }} className="btn-primary" style={{ padding: "10px 24px", fontSize: 14 }}>View My Predictions</button>}
            </div>
          </div>
        ) : (
          <>
            {!user && (
              <div style={{ background: "rgba(79,70,229,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ color: "#a5b4fc", fontSize: 13, margin: 0 }}>Sign in to track your predictions</p>
                <button onClick={() => { onClose(); navigate("/login"); }} className="btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>Sign In</button>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Your Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" className="input-field" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ background: confidence > 50 ? "rgba(16,185,129,0.08)" : "#131a2b", border: `1px solid ${confidence > 50 ? "rgba(16,185,129,0.25)" : "#1e2736"}`, borderRadius: 10, padding: 14, textAlign: "center", transition: "all 0.3s" }}>
                <div style={{ color: "#10b981", fontSize: 26, fontWeight: 700 }}>{confidence}%</div>
                <div style={{ color: "#10b981", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, marginTop: 2 }}>YES</div>
              </div>
              <div style={{ background: confidence < 50 ? "rgba(239,68,68,0.08)" : "#131a2b", border: `1px solid ${confidence < 50 ? "rgba(239,68,68,0.25)" : "#1e2736"}`, borderRadius: 10, padding: 14, textAlign: "center", transition: "all 0.3s" }}>
                <div style={{ color: "#ef4444", fontSize: 26, fontWeight: 700 }}>{100 - confidence}%</div>
                <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, marginTop: 2 }}>NO</div>
              </div>
            </div>

            <input type="range" min="1" max="99" value={confidence} onChange={e => setConfidence(Number(e.target.value))} style={{ marginBottom: 6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", color: "#4b5563", fontSize: 12, marginBottom: 16 }}><span>Unlikely (1%)</span><span>Very likely (99%)</span></div>

            <div style={{ background: "#131a2b", borderRadius: 10, padding: 12, marginBottom: 16, textAlign: "center", fontSize: 13, border: "1px solid #1e2736" }}>
              <span style={{ color: "#9ca3af" }}>Market: </span>
              <span style={{ color: "#f9fafb", fontWeight: 600 }}>{currentVal.toFixed(1)}% YES</span>
              <span style={{ color: "#4b5563" }}> · Your pick: </span>
              <span style={{ color: confidence > 50 ? "#10b981" : "#ef4444", fontWeight: 600 }}>{confidence}% YES</span>
            </div>

            <button onClick={() => {
              if (!name.trim() || loading) return;
              setLoading(true);
              onSubmit(name, event.id, confidence / 100)
                .then(() => setSuccess(true))
                .catch(console.error)
                .finally(() => setLoading(false));
            }} disabled={loading || !name.trim()} className="btn-primary" style={{ width: "100%", padding: 13, fontSize: 15 }}>
              {loading ? "Submitting..." : "Submit Prediction"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Event Card ────────────────────────────────────────── */
function EventCard({ event, onClick, index }) {
  const navigate = useNavigate();
  const yesProb = Math.round(event.currentProb || 50);
  const noProb = 100 - yesProb;
  const daysLeft = Math.max(0, Math.ceil((new Date(event.deadline) - new Date()) / (1000 * 60 * 60 * 24)));
  const isDBEvent = event.id && !event.id.startsWith("h") && !event.id.startsWith("odds_") && !event.id.startsWith("poly_");
  const sparkData = event.chartHistory || generateHistory(yesProb, 20);

  const handleClick = () => {
    if (isDBEvent) navigate(`/events/${event.id}`);
    else onClick();
  };

  return (
    <div onClick={handleClick} className="event-card" style={{ animationDelay: `${(index || 0) * 0.04}s` }}>
      {/* Top row: category + badges */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>{CATEGORY_ICONS[event.category]} {event.category}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {event.status === "resolved" ? (
            <span className={`badge ${event.actual_outcome === 1 ? "badge-resolved-yes" : "badge-resolved-no"}`}>
              {event.actual_outcome === 1 ? "YES" : "NO"}
            </span>
          ) : event.hasRealData ? (
            <span className="badge badge-live"><span className="live-dot" style={{ width: 5, height: 5 }} /> LIVE</span>
          ) : null}
          <span style={{ color: "#4b5563", fontSize: 11, fontWeight: 500 }}>{daysLeft === 0 ? "Closed" : `${daysLeft}d`}</span>
        </div>
      </div>

      {/* Title */}
      <h3 style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 500, lineHeight: 1.55, marginBottom: 16, minHeight: 44, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{event.title}</h3>

      {/* Probability + Sparkline */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
            <span style={{ color: "#10b981", fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>{yesProb}%</span>
            <span style={{ color: "#10b981", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>YES</span>
          </div>
          <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{noProb}% <span style={{ fontSize: 11, letterSpacing: 0.5 }}>NO</span></span>
        </div>
        <MiniSparkline data={sparkData} color={yesProb >= 50 ? "#10b981" : "#ef4444"} />
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
        <div style={{ height: 4, flex: yesProb, background: "linear-gradient(90deg, #059669, #10b981)", borderRadius: "2px 0 0 2px", transition: "flex 0.6s" }} />
        <div style={{ height: 4, flex: noProb, background: "linear-gradient(90deg, #dc2626, #ef4444)", borderRadius: "0 2px 2px 0", transition: "flex 0.6s" }} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #1e2736" }}>
        <span style={{ color: "#4b5563", fontSize: 12 }}>{event.totalPredictions || 0} predictions</span>
        <span className="btn-primary" style={{ padding: "5px 14px", fontSize: 12, borderRadius: 8 }}>Predict</span>
      </div>
    </div>
  );
}

/* ── Markets (Home) ────────────────────────────────────── */
function Markets({ user, onLogout }) {
  const [allEvents, setAllEvents] = useState([]);
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
    fetchLeaderboard();
    const lb = setInterval(fetchLeaderboard, 5000);
    const ev = setInterval(fetchEvents, 30000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchEvents(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(lb); clearInterval(ev); document.removeEventListener('visibilitychange', handleVisibility); };
  }, []);

  const fetchEvents = async () => {
    try {
      const data = await api.getEvents();
      const dbEvents = data.map(e => ({ ...e, chartHistory: generateHistory(e.yesPercent || e.baseProb || 50, 20), currentProb: e.yesPercent || e.baseProb || 50, status: e.status || 'active', actual_outcome: e.actual_outcome, totalPredictions: e.totalPredictions || Math.floor(Math.random() * 50) + 1 }));
      const enriched = await enrichEventsWithRealData(dbEvents);
      setAllEvents(enriched);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchLeaderboard = async () => {
    try { const d = await api.getLeaderboard(); setLeaderboard(d); } catch (e) { console.error('Leaderboard fetch failed:', e); }
  };

  const handlePredict = async (userId, eventId, prob) => {
    const ev = allEvents.find(e => e.id === eventId);
    return api.makePrediction(userId, eventId, prob, ev?.title, ev?.category, ev?.deadline, "yes");
  };

  const filtered = allEvents.filter(e => {
    const cat = activeCategory === "Trending" || e.category === activeCategory;
    const search = !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase());
    return cat && search;
  });

  return (
    <div style={{ fontFamily: "Inter,-apple-system,BlinkMacSystemFont,sans-serif", minHeight: "100vh", background: "#0a0e17", color: "#f9fafb" }}>
      {/* ── Navbar ──────────────────────────────────────── */}
      <div className="navbar">
        <div className="navbar-inner" style={{ maxWidth: 1600, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, height: 58 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>P</div>
              <div>
                <span style={{ color: "#f9fafb", fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Prediction</span>
                <span style={{ color: "#6366f1", fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}> Arena</span>
              </div>
            </div>

            {/* Search */}
            <div style={{ flex: 1, maxWidth: 380, position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#4b5563", fontSize: 14 }}>⌕</span>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search markets..." className="search-input" style={{ width: "100%", padding: "9px 14px 9px 32px" }} />
            </div>

            {/* Right side */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="live-dot" />
                <span style={{ color: "#10b981", fontSize: 13, fontWeight: 600 }}>Live</span>
                <span style={{ color: "#4b5563", fontSize: 13 }}>{allEvents.length} markets</span>
              </div>
              {user ? (
                <div style={{ position: "relative" }}>
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="btn-secondary" style={{ padding: "7px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{user.username[0].toUpperCase()}</div>
                    {user.username}
                    <span style={{ color: "#4b5563", fontSize: 10, marginLeft: 2 }}>▼</span>
                  </button>
                  {userMenuOpen && (
                    <div className="dropdown-menu">
                      <button onClick={() => { navigate("/my-predictions"); setUserMenuOpen(false); }} className="dropdown-item">📊 My Predictions</button>
                      <button onClick={() => { navigate("/admin"); setUserMenuOpen(false); }} className="dropdown-item">⚙️ Admin Panel</button>
                      <div style={{ borderTop: "1px solid #2a3548" }} />
                      <button onClick={() => { onLogout(); setUserMenuOpen(false); }} className="dropdown-item danger">Sign Out</button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => navigate("/login")} className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>Sign In</button>
              )}
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ borderTop: "1px solid rgba(30,39,54,0.6)" }}>
          <div className="category-scroll" style={{ maxWidth: 1600, margin: "0 auto", padding: "0 24px", display: "flex", overflowX: "auto" }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`category-tab ${activeCategory === cat ? "active" : ""}`} style={{ color: activeCategory === cat ? "#f9fafb" : "#6b7280" }}>
                {CATEGORY_ICONS[cat]} {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div className="content-area main-grid" style={{ maxWidth: 1600, margin: "0 auto", padding: 24, display: "grid", gridTemplateColumns: "1fr 300px", gap: 28, alignItems: "start" }}>
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ color: "#f9fafb", fontSize: 17, fontWeight: 700 }}>
              {activeCategory === "Trending" ? "Trending Markets" : `${CATEGORY_ICONS[activeCategory]} ${activeCategory}`}
            </h2>
            <span style={{ color: "#4b5563", fontSize: 13, fontWeight: 500 }}>{filtered.length} markets</span>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="event-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 14 }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🔍</div>
              <p style={{ color: "#6b7280", fontSize: 15 }}>No markets found</p>
              <p style={{ color: "#4b5563", fontSize: 13, marginTop: 4 }}>Try a different category or search term</p>
            </div>
          ) : (
            <div className="event-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 14 }}>
              {filtered.map((ev, i) => <EventCard key={ev.id} event={ev} index={i} onClick={() => setSelectedEvent(ev)} />)}
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────── */}
        <div className="sidebar" style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 116 }}>
          {/* Leaderboard */}
          <div className="sidebar-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ color: "#f9fafb", fontSize: 14, fontWeight: 700 }}>Leaderboard</h3>
              <span style={{ color: "#6366f1", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>TOP {Math.min(leaderboard.length, 8)}</span>
            </div>
            {leaderboard.length === 0 ? (
              <p style={{ color: "#4b5563", fontSize: 13, textAlign: "center", padding: "16px 0" }}>No predictions scored yet</p>
            ) : leaderboard.slice(0, 8).map((p, i) => (
              <div key={i} className="lb-row">
                <span style={{ fontSize: 14, width: 24, textAlign: "center" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={{ color: "#4b5563", fontSize: 13, fontWeight: 600 }}>{i + 1}</span>}</span>
                <span style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.playerName}</span>
                <span style={{ color: "#6366f1", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{p.score?.toFixed(3)}</span>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="sidebar-card">
            <h3 style={{ color: "#f9fafb", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>How it works</h3>
            {[
              ["Browse markets", "Find prediction questions across categories"],
              ["Make a call", "Set your YES/NO confidence percentage"],
              ["Get scored", "Brier Score rewards accurate predictions"]
            ].map(([title, desc], i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 2 ? 14 : 0, alignItems: "flex-start" }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#a5b4fc", flexShrink: 0 }}>{i + 1}</div>
                <div>
                  <div style={{ color: "#d1d5db", fontSize: 13, fontWeight: 500 }}>{title}</div>
                  <div style={{ color: "#4b5563", fontSize: 12, marginTop: 1 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="sidebar-card">
            <h3 style={{ color: "#f9fafb", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Platform Stats</h3>
            {[
              ["Active Markets", allEvents.filter(e => e.status !== "resolved").length],
              ["Resolved", allEvents.filter(e => e.status === "resolved").length],
              ["Categories", CATEGORIES.length - 1],
              ["Data Sources", "4 APIs"]
            ].map(([k, v]) => (
              <div key={k} className="stat-row">
                <span style={{ color: "#6b7280", fontSize: 13 }}>{k}</span>
                <span style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedEvent && <PredictionModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onSubmit={handlePredict} user={user} />}
    </div>
  );
}

/* ── Auth Modal ────────────────────────────────────────── */
const AUTH_API = import.meta.env.VITE_API_BASE;

function AuthModal({ onLogin, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) { setError("Please fill in all fields"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${AUTH_API}${isLogin ? "/login" : "/register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");
      localStorage.setItem("user", JSON.stringify({ userId: data.userId, username: data.username }));
      onLogin({ userId: data.userId, username: data.username });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div style={{ width: 420, maxWidth: "90vw", position: "relative" }} className="animate-fade-in-up">
        <button onClick={onClose} style={{ position: "absolute", top: -40, right: 0, background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
          Skip for now →
        </button>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff" }}>P</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              <span style={{ color: "#f9fafb" }}>Prediction</span>
              <span style={{ color: "#6366f1" }}> Arena</span>
            </div>
          </div>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            {isLogin ? "Welcome back! Sign in to continue." : "Create an account to start predicting."}
          </p>
        </div>
        <div className="modal-content" style={{ padding: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#0a0e17", borderRadius: 10, padding: 4, marginBottom: 24 }}>
            <button onClick={() => { setIsLogin(true); setError(""); }} style={{ padding: 9, background: isLogin ? "#1a2233" : "transparent", border: "none", borderRadius: 8, color: isLogin ? "#f9fafb" : "#6b7280", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}>Sign In</button>
            <button onClick={() => { setIsLogin(false); setError(""); }} style={{ padding: 9, background: !isLogin ? "#1a2233" : "transparent", border: "none", borderRadius: 8, color: !isLogin ? "#f9fafb" : "#6b7280", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}>Register</button>
          </div>
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
          <p style={{ textAlign: "center", color: "#6b7280", fontSize: 13, marginTop: 20, marginBottom: 0 }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setIsLogin(!isLogin); setError(""); }} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {isLogin ? "Register" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── App Root ──────────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(() => !localStorage.getItem("user"));

  const handleLogin = (userData) => {
    setUser(userData);
    setShowAuthModal(false);
  };
  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setShowAuthModal(true);
  };

  return (
    <BrowserRouter>
      {showAuthModal && !user && (
        <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} />
      )}
      <Routes>
        <Route path="/" element={<Markets user={user} onLogout={handleLogout} />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/my-predictions" element={<MyPredictions user={user} />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/events/:id" element={<EventDetail user={user} />} />
      </Routes>
    </BrowserRouter>
  );
}
