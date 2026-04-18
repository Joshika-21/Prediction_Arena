import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE;
const CATEGORY_ICONS = { Elections:"🗳️", Politics:"🏛️", Sports:"⚽", Culture:"🎭", Crypto:"₿", Climate:"🌍", Economics:"📈", Companies:"🏢", Financials:"💹", "Tech & Science":"🔬" };
const CATEGORIES = ["Crypto","Economics","Sports","Elections","Politics","Tech & Science","Climate","Financials","Companies","Culture"];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState({});
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("resolve");
  // New event form
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Crypto");
  const [newDescription, setNewDescription] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authed) fetchEvents();
  }, [authed]);

  const handleAdminLogin = async () => {
    if (!password.trim()) { setPwError("Please enter a password"); return; }
    setPwLoading(true);
    setPwError("");
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");
      setAdminToken(data.token);
      setAuthed(true);
    } catch (err) {
      setPwError(err.message || "Wrong password");
    } finally {
      setPwLoading(false);
    }
  };

  const adminHeaders = () => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${adminToken}`
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/events`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleResolve = async (eventId, outcome) => {
    setResolving(prev => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/resolve-event`,
        {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({ event_id: eventId, actual_outcome: outcome })
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to resolve");
      }
      const data = await res.json();
      setMessage(`Event resolved! Scored ${data.scored_users || 0} users.`);
      fetchEvents();
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessage(`Failed to resolve event: ${err.message}`);
    } finally {
      setResolving(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDeadline) {
      setMessage("Please fill in all fields");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          description: newDescription || newTitle,
          deadline: newDeadline
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create");
      }
      const data = await res.json();
      setMessage(`Event created! ID: ${data.eventId?.slice(0,8)}`);
      setNewTitle(""); setNewDescription(""); setNewDeadline("");
      fetchEvents();
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessage(`Failed to create event: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (!authed) {
    return (
      <div style={{ minHeight:"100vh", background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,-apple-system,sans-serif" }}>
        <div style={{ width:"380px", background:"#111827", border:"1px solid #1f2937", borderRadius:"12px", padding:"32px" }}>
          <h2 style={{ color:"#f9fafb", fontSize:"20px", fontWeight:600, marginBottom:"4px" }}>Admin Panel</h2>
          <p style={{ color:"#6b7280", fontSize:"13px", marginBottom:"24px" }}>Enter admin password to continue</p>
          <input
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") handleAdminLogin(); }}
            placeholder="Admin password"
            style={{ width:"100%", padding:"10px 14px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#f9fafb", fontSize:"14px", boxSizing:"border-box", outline:"none", marginBottom:"12px" }}
          />
          {pwError && <p style={{ color:"#ef4444", fontSize:"13px", marginBottom:"12px" }}>{pwError}</p>}
          <button onClick={handleAdminLogin} disabled={pwLoading}
            style={{ width:"100%", padding:"11px", background:pwLoading?"#1f2937":"#2563eb", color:pwLoading?"#6b7280":"#fff", border:"none", borderRadius:"8px", cursor:pwLoading?"not-allowed":"pointer", fontWeight:600, fontSize:"14px" }}>
            {pwLoading ? "Authenticating..." : "Access Admin Panel"}
          </button>
          <button onClick={()=>navigate("/")} style={{ width:"100%", padding:"11px", background:"none", color:"#6b7280", border:"none", cursor:"pointer", fontSize:"13px", marginTop:"8px" }}>
            ← Back to Markets
          </button>
        </div>
      </div>
    );
  }

  const activeEvents = events.filter(e => e.status === "active");
  const resolvedEvents = events.filter(e => e.status === "resolved");

  return (
    <div style={{ minHeight:"100vh", background:"#0d1117", fontFamily:"Inter,-apple-system,sans-serif" }}>
      <div style={{ background:"#111827", borderBottom:"1px solid #1f2937", padding:"16px 32px", display:"flex", alignItems:"center", gap:"16px" }}>
        <button onClick={()=>navigate("/")} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:"14px" }}>← Back</button>
        <h1 style={{ color:"#f9fafb", fontSize:"18px", fontWeight:600 }}>Admin Panel</h1>
        <span style={{ background:"#064e3b", color:"#34d399", padding:"2px 10px", borderRadius:"4px", fontSize:"12px", fontWeight:600 }}>AUTHENTICATED</span>
      </div>

      {message && (
        <div style={{ background:message.startsWith("Event")?"#022c22":"#2d0a0a", borderBottom:`1px solid ${message.startsWith("Event")?"#10b981":"#ef4444"}`, padding:"12px 32px" }}>
          <p style={{ color:message.startsWith("Event")?"#34d399":"#f87171", fontSize:"14px", margin:0 }}>{message}</p>
        </div>
      )}

      <div style={{ maxWidth:"1000px", margin:"0 auto", padding:"24px 32px" }}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"24px" }}>
          {[["Total Events",events.length,"#f9fafb"],["Active",activeEvents.length,"#10b981"],["Resolved",resolvedEvents.length,"#6b7280"]].map(([l,v,c])=>(
            <div key={l} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:"10px", padding:"20px", textAlign:"center" }}>
              <div style={{ color:c, fontSize:"28px", fontWeight:700 }}>{v}</div>
              <div style={{ color:"#6b7280", fontSize:"13px", marginTop:"4px" }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #1f2937", marginBottom:"20px" }}>
          {[["resolve","Resolve Events"],["create","Create Event"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{ background:"none", border:"none", borderBottom:activeTab===tab?"2px solid #2563eb":"2px solid transparent", padding:"10px 20px", color:activeTab===tab?"#f9fafb":"#6b7280", fontSize:"14px", fontWeight:500, cursor:"pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Resolve Events Tab */}
        {activeTab === "resolve" && (
          <div>
            <h3 style={{ color:"#f9fafb", fontSize:"15px", fontWeight:600, marginBottom:"16px" }}>
              Active Events — Click YES or NO to resolve
            </h3>
            {loading ? (
              <p style={{ color:"#6b7280", fontSize:"14px" }}>Loading events...</p>
            ) : activeEvents.length === 0 ? (
              <p style={{ color:"#6b7280", fontSize:"14px" }}>No active events to resolve.</p>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {activeEvents.map(event => (
                  <div key={event.id} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:"10px", padding:"18px", display:"flex", alignItems:"center", gap:"16px" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#6b7280", fontSize:"12px", marginBottom:"4px" }}>
                        {CATEGORY_ICONS[event.category]} {event.category} · Closes {new Date(event.deadline).toLocaleDateString()}
                      </div>
                      <p style={{ color:"#e5e7eb", fontSize:"14px", fontWeight:500, margin:0 }}>{event.title}</p>
                    </div>
                    <div style={{ display:"flex", gap:"8px", flexShrink:0 }}>
                      <button
                        onClick={()=>handleResolve(event.id, 1)}
                        disabled={resolving[event.id]}
                        style={{ padding:"8px 20px", background:"#022c22", border:"1px solid #10b981", color:"#34d399", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:600 }}
                      >
                        {resolving[event.id] ? "..." : "YES"}
                      </button>
                      <button
                        onClick={()=>handleResolve(event.id, 0)}
                        disabled={resolving[event.id]}
                        style={{ padding:"8px 20px", background:"#2d0a0a", border:"1px solid #ef4444", color:"#f87171", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:600 }}
                      >
                        {resolving[event.id] ? "..." : "NO"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resolvedEvents.length > 0 && (
              <div style={{ marginTop:"32px" }}>
                <h3 style={{ color:"#6b7280", fontSize:"15px", fontWeight:600, marginBottom:"16px" }}>Resolved Events</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  {resolvedEvents.map(event => (
                    <div key={event.id} style={{ background:"#0d1117", border:"1px solid #1f2937", borderRadius:"10px", padding:"18px", display:"flex", alignItems:"center", gap:"16px", opacity:0.7 }}>
                      <div style={{ flex:1 }}>
                        <p style={{ color:"#9ca3af", fontSize:"14px", margin:0 }}>{event.title}</p>
                      </div>
                      <span style={{ background:event.actual_outcome===1?"#022c22":"#2d0a0a", color:event.actual_outcome===1?"#34d399":"#f87171", padding:"4px 12px", borderRadius:"4px", fontSize:"12px", fontWeight:600 }}>
                        {event.actual_outcome===1?"YES":"NO"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Event Tab */}
        {activeTab === "create" && (
          <div style={{ maxWidth:"600px" }}>
            <h3 style={{ color:"#f9fafb", fontSize:"15px", fontWeight:600, marginBottom:"20px" }}>Create New Event</h3>

            <div style={{ marginBottom:"16px" }}>
              <label style={{ color:"#9ca3af", fontSize:"12px", fontWeight:500, display:"block", marginBottom:"6px" }}>QUESTION TITLE</label>
              <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Will Bitcoin exceed $100k by end of 2026?" style={{ width:"100%", padding:"10px 14px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#f9fafb", fontSize:"14px", boxSizing:"border-box", outline:"none" }}/>
            </div>

            <div style={{ marginBottom:"16px" }}>
              <label style={{ color:"#9ca3af", fontSize:"12px", fontWeight:500, display:"block", marginBottom:"6px" }}>CATEGORY</label>
              <select value={newCategory} onChange={e=>setNewCategory(e.target.value)} style={{ width:"100%", padding:"10px 14px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#f9fafb", fontSize:"14px", outline:"none" }}>
                {CATEGORIES.map(c=><option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:"16px" }}>
              <label style={{ color:"#9ca3af", fontSize:"12px", fontWeight:500, display:"block", marginBottom:"6px" }}>DESCRIPTION (optional)</label>
              <input value={newDescription} onChange={e=>setNewDescription(e.target.value)} placeholder="Brief description of the event" style={{ width:"100%", padding:"10px 14px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#f9fafb", fontSize:"14px", boxSizing:"border-box", outline:"none" }}/>
            </div>

            <div style={{ marginBottom:"24px" }}>
              <label style={{ color:"#9ca3af", fontSize:"12px", fontWeight:500, display:"block", marginBottom:"6px" }}>DEADLINE</label>
              <input type="date" value={newDeadline} onChange={e=>setNewDeadline(e.target.value)} style={{ width:"100%", padding:"10px 14px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#f9fafb", fontSize:"14px", outline:"none" }}/>
            </div>

            <button onClick={handleCreate} disabled={creating} style={{ padding:"12px 32px", background:creating?"#1f2937":"#2563eb", color:creating?"#6b7280":"#fff", border:"none", borderRadius:"8px", cursor:creating?"not-allowed":"pointer", fontWeight:600, fontSize:"14px" }}>
              {creating ? "Creating..." : "Create Event"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
