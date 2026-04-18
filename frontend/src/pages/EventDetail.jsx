import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, getRealProbability } from "../api";

const API_BASE = import.meta.env.VITE_API_BASE;
const CATEGORY_ICONS = { Trending:"🔥", Elections:"🗳️", Politics:"🏛️", Sports:"⚽", Culture:"🎭", Crypto:"₿", Climate:"🌍", Economics:"📈", Companies:"🏢", Financials:"💹", "Tech & Science":"🔬" };

function generateHistory(base, points=60) {
  const h=[]; let cur=base;
  for(let i=0;i<points;i++){
    cur=Math.max(3,Math.min(97,cur+(Math.random()-0.48)*2));
    h.push(parseFloat(cur.toFixed(1)));
  }
  return h;
}

function BigLiveChart({ history }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas||history.length<2) return;
    const ctx = canvas.getContext("2d");
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    const min=Math.max(0,Math.min(...history)-10);
    const max=Math.min(100,Math.max(...history)+10);
    const range=max-min||1;
    const toX=i=>(i/(history.length-1))*(W-60)+30;
    const toY=v=>H-35-((v-min)/range)*(H-60);

    for(let i=0;i<=5;i++){
      const y=20+(i/5)*(H-55);
      ctx.strokeStyle="#1a2233"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(W-20,y); ctx.stroke();
      ctx.fillStyle="#4b5563"; ctx.font="12px Inter,sans-serif";
      ctx.fillText((max-(i/5)*range).toFixed(0)+"%",0,y+4);
    }

    const trend=history[history.length-1]>=history[0];
    const lineColor=trend?"#10b981":"#ef4444";

    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,lineColor+"20");
    grad.addColorStop(1,"transparent");
    ctx.beginPath();
    ctx.moveTo(toX(0),H-35);
    history.forEach((v,i)=>ctx.lineTo(toX(i),toY(v)));
    ctx.lineTo(toX(history.length-1),H-35);
    ctx.closePath(); ctx.fillStyle=grad; ctx.fill();

    ctx.beginPath(); ctx.strokeStyle=lineColor; ctx.lineWidth=2.5; ctx.lineJoin="round";
    history.forEach((v,i)=>i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v)));
    ctx.stroke();

    const lx=toX(history.length-1), ly=toY(history[history.length-1]);
    ctx.beginPath(); ctx.arc(lx,ly,6,0,Math.PI*2); ctx.fillStyle=lineColor; ctx.fill();
    ctx.beginPath(); ctx.arc(lx,ly,10,0,Math.PI*2); ctx.strokeStyle=lineColor+"40"; ctx.lineWidth=2; ctx.stroke();

    ctx.fillStyle="#4b5563"; ctx.font="12px Inter,sans-serif";
    ctx.fillText("60 ticks ago",30,H-10);
    ctx.fillText("Now",W-40,H-10);
  },[history]);
  return <canvas ref={canvasRef} width={900} height={220} style={{width:"100%",height:"220px"}}/>;
}

export default function EventDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [currentVal, setCurrentVal] = useState(50);
  const [dataLabel, setDataLabel] = useState(null);
  const [isRealData, setIsRealData] = useState(false);
  const [communityStats, setCommunityStats] = useState(null);

  const [selectedSide, setSelectedSide] = useState(null);
  const [confidence, setConfidence] = useState(50);
  const [name, setName] = useState(user?.username || "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const fetchEvent = async () => {
    try {
      const res = await fetch(`${API_BASE}/events/${id}`);
      if(res.ok) {
        const data = await res.json();
        setEvent(data);
        const base = data.yesPercent || 50;
        const h = generateHistory(base);
        setHistory(h);
        setCurrentVal(base);

        getRealProbability(data).then(d=>{
          if(d&&d.prob){
            setHistory(generateHistory(d.prob, 40));
            setCurrentVal(d.prob);
            setDataLabel(d.label);
            setIsRealData(true);
          }
        }).catch(()=>{});

        const statsRes = await fetch(`${API_BASE}/events/${id}/predictions`);
        if(statsRes.ok) {
          const stats = await statsRes.json();
          setCommunityStats(stats);
        }
      }
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    fetchEvent();
  },[id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    const vol = 1.5;
    const t = setInterval(()=>{
      setHistory(prev=>{
        if(prev.length < 2) return prev;
        const last = prev[prev.length-1];
        const next = Math.max(3,Math.min(97,last+(Math.random()-0.48)*vol));
        const r = parseFloat(next.toFixed(1));
        setCurrentVal(r);
        return [...prev.slice(-39), r];
      });
    }, 800);
    return ()=>clearInterval(t);
  },[isRealData]);

  const handleSubmit = async () => {
    if(!selectedSide) { setError("Please select YES or NO first"); return; }
    if(!name.trim()) { setError("Please enter your name"); return; }
    setSubmitting(true);
    setError("");
    try {
      const finalConfidence = selectedSide === "yes" ? confidence : 100 - confidence;
      await api.makePrediction(name, id, finalConfidence/100, event?.title, event?.category, event?.deadline);
      setSuccess(true);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const trend = history.length > 1 ? currentVal - history[0] : 0;
  const trendUp = trend >= 0;

  if(loading) return (
    <div style={{minHeight:"100vh",background:"#0a0e17",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280",fontFamily:"Inter,sans-serif"}}>
      <div style={{ textAlign: "center" }}>
        <div className="skeleton" style={{ width: 200, height: 24, margin: "0 auto 16px" }} />
        <div className="skeleton" style={{ width: 120, height: 16, margin: "0 auto" }} />
      </div>
    </div>
  );

  if(!event) return (
    <div style={{minHeight:"100vh",background:"#0a0e17",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>
      <div style={{textAlign:"center"}} className="animate-fade-in">
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🔍</div>
        <p style={{color:"#6b7280",fontSize:16,marginBottom:16}}>Event not found</p>
        <button onClick={()=>navigate("/")} className="btn-primary" style={{padding:"10px 24px",fontSize:14}}>Go Back</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0a0e17",fontFamily:"Inter,-apple-system,sans-serif",color:"#f9fafb"}}>
      {/* Header */}
      <div className="navbar" style={{ padding: "0 32px" }}>
        <div style={{display:"flex",alignItems:"center",gap:16,height:58}}>
          <button onClick={()=>navigate("/")} className="btn-secondary" style={{padding:"6px 14px",fontSize:13}}>← Back</button>
          <span style={{color:"#6b7280",fontSize:13}}>{CATEGORY_ICONS[event.category]} {event.category}</span>
          {isRealData && <span className="badge badge-live"><span className="live-dot" style={{width:5,height:5}}/> LIVE DATA</span>}
          {event.status === "resolved" && (
            <span className={`badge ${event.actual_outcome===1?"badge-resolved-yes":"badge-resolved-no"}`}>
              {event.actual_outcome===1?"Resolved YES":"Resolved NO"}
            </span>
          )}
        </div>
      </div>

      <div className="animate-fade-in-up" style={{maxWidth:900,margin:"0 auto",padding:"32px 24px"}}>
        <h1 style={{color:"#f9fafb",fontSize:26,fontWeight:700,lineHeight:1.4,marginBottom:8}}>{event.title}</h1>
        <p style={{color:"#4b5563",fontSize:14,marginBottom:28}}>
          Closes {new Date(event.deadline).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
        </p>

        {/* Live price */}
        <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:8}}>
          <span style={{color:trendUp?"#10b981":"#ef4444",fontSize:42,fontWeight:700,fontFamily:"monospace"}}>{currentVal.toFixed(1)}%</span>
          <span style={{color:trendUp?"#10b981":"#ef4444",fontSize:16,fontWeight:500}}>{trendUp?"▲":"▼"} {Math.abs(trend).toFixed(1)}%</span>
          <span style={{display:"flex",alignItems:"center",gap:5,marginLeft:8}}>
            <span className="live-dot"/>
            <span style={{color:"#6b7280",fontSize:13}}>{isRealData?"Real data":"Live"}</span>
          </span>
        </div>
        {dataLabel && <p style={{color:"#6b7280",fontSize:13,marginBottom:16}}>{dataLabel}</p>}

        {/* Big Chart */}
        <div style={{background:"linear-gradient(145deg, #111827, #0f1520)",border:"1px solid #1e2736",borderRadius:14,padding:16,marginBottom:28}}>
          <BigLiveChart history={history}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
          {/* Left: Community Stats */}
          <div>
            <div className="sidebar-card" style={{marginBottom:16}}>
              <h3 style={{color:"#f9fafb",fontSize:15,fontWeight:700,marginBottom:18}}>Market Probabilities</h3>
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{color:"#10b981",fontSize:14,fontWeight:600}}>YES</span>
                  <span style={{color:"#10b981",fontSize:18,fontWeight:700,fontFamily:"monospace"}}>{Math.round(currentVal)}%</span>
                </div>
                <div className="prob-bar">
                  <div className="prob-bar-fill yes" style={{width:`${currentVal}%`}}/>
                </div>
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{color:"#ef4444",fontSize:14,fontWeight:600}}>NO</span>
                  <span style={{color:"#ef4444",fontSize:18,fontWeight:700,fontFamily:"monospace"}}>{100-Math.round(currentVal)}%</span>
                </div>
                <div className="prob-bar">
                  <div className="prob-bar-fill no" style={{width:`${100-currentVal}%`}}/>
                </div>
              </div>
            </div>

            {communityStats && (
              <div className="sidebar-card">
                <h3 style={{color:"#f9fafb",fontSize:15,fontWeight:700,marginBottom:16}}>Community Stats</h3>
                {[
                  ["Total Predictions", communityStats.totalPredictions || 0],
                  ["Avg Confidence", `${communityStats.avgConfidence?.toFixed(1) || 50}%`],
                  ["Yes Leaning", `${communityStats.yesPercent?.toFixed(1) || 50}%`],
                  ["No Leaning", `${communityStats.noPercent?.toFixed(1) || 50}%`],
                ].map(([k,v])=>(
                  <div key={k} className="stat-row">
                    <span style={{color:"#6b7280",fontSize:13}}>{k}</span>
                    <span style={{color:"#f9fafb",fontSize:13,fontWeight:600,fontFamily:"monospace"}}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Prediction form */}
          <div className="sidebar-card">
            {success ? (
              <div className="animate-fade-in-up" style={{textAlign:"center",padding:"32px 0"}}>
                <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(16,185,129,0.1)",border:"2px solid rgba(16,185,129,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24}}>✓</div>
                <p style={{color:"#10b981",fontSize:18,fontWeight:600,marginBottom:8}}>Prediction Submitted!</p>
                <p style={{color:"#6b7280",fontSize:14,marginBottom:8}}>
                  You predicted <strong style={{color:selectedSide==="yes"?"#10b981":"#ef4444"}}>{selectedSide?.toUpperCase()}</strong> with <strong>{confidence}%</strong> confidence
                </p>
                <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:20}}>
                  <button onClick={()=>{setSuccess(false);setSelectedSide(null);setConfidence(50);}} className="btn-secondary" style={{padding:"10px 20px",fontSize:14}}>Predict Again</button>
                  <button onClick={()=>navigate("/my-predictions")} className="btn-primary" style={{padding:"10px 20px",fontSize:14}}>My Predictions</button>
                </div>
              </div>
            ) : (
              <>
                <h3 style={{color:"#f9fafb",fontSize:15,fontWeight:700,marginBottom:22}}>Make Your Prediction</h3>

                <p style={{color:"#6b7280",fontSize:11,fontWeight:600,marginBottom:10,letterSpacing:1,textTransform:"uppercase"}}>Step 1 — Do you think this will happen?</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                  <button onClick={()=>setSelectedSide("yes")} style={{padding:16,background:selectedSide==="yes"?"rgba(16,185,129,0.08)":"#131a2b",border:`2px solid ${selectedSide==="yes"?"rgba(16,185,129,0.4)":"#1e2736"}`,borderRadius:12,cursor:"pointer",transition:"all 0.2s"}}>
                    <div style={{color:"#10b981",fontSize:22,fontWeight:700}}>YES</div>
                    <div style={{color:"#10b981",fontSize:12,marginTop:2,opacity:0.7}}>It will happen</div>
                  </button>
                  <button onClick={()=>setSelectedSide("no")} style={{padding:16,background:selectedSide==="no"?"rgba(239,68,68,0.08)":"#131a2b",border:`2px solid ${selectedSide==="no"?"rgba(239,68,68,0.4)":"#1e2736"}`,borderRadius:12,cursor:"pointer",transition:"all 0.2s"}}>
                    <div style={{color:"#ef4444",fontSize:22,fontWeight:700}}>NO</div>
                    <div style={{color:"#ef4444",fontSize:12,marginTop:2,opacity:0.7}}>It won't happen</div>
                  </button>
                </div>

                {selectedSide && (
                  <div className="animate-fade-in">
                    <p style={{color:"#6b7280",fontSize:11,fontWeight:600,marginBottom:10,letterSpacing:1,textTransform:"uppercase"}}>Step 2 — How confident are you?</p>
                    <div style={{background:"#0a0e17",borderRadius:12,padding:16,marginBottom:16,border:"1px solid #1e2736"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <span style={{color:selectedSide==="yes"?"#10b981":"#ef4444",fontSize:14,fontWeight:600}}>
                          {selectedSide==="yes"?"YES":"NO"} — {confidence}% confident
                        </span>
                        <span style={{color:"#4b5563",fontSize:12}}>
                          {confidence < 40 ? "Not very sure" : confidence < 70 ? "Fairly confident" : "Very confident"}
                        </span>
                      </div>
                      <input type="range" min="1" max="99" value={confidence} onChange={e=>setConfidence(Number(e.target.value))} />
                      <div style={{display:"flex",justifyContent:"space-between",color:"#374151",fontSize:11,marginTop:6}}>
                        <span>Just guessing (1%)</span>
                        <span>Certain (99%)</span>
                      </div>
                    </div>

                    <div style={{background:selectedSide==="yes"?"rgba(16,185,129,0.06)":"rgba(239,68,68,0.06)",border:`1px solid ${selectedSide==="yes"?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.15)"}`,borderRadius:10,padding:12,marginBottom:16,textAlign:"center"}}>
                      <p style={{color:selectedSide==="yes"?"#34d399":"#f87171",fontSize:13,margin:0}}>
                        You predict <strong>{selectedSide.toUpperCase()}</strong> with <strong>{confidence}%</strong> confidence
                      </p>
                    </div>
                  </div>
                )}

                {selectedSide && (
                  <div className="animate-fade-in" style={{marginBottom:16}}>
                    <p style={{color:"#6b7280",fontSize:11,fontWeight:600,marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Step 3 — Your Name</p>
                    <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name" className="input-field" />
                  </div>
                )}

                {error && <p className="animate-fade-in" style={{color:"#f87171",fontSize:13,marginBottom:12,background:"rgba(239,68,68,0.06)",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,0.15)"}}>{error}</p>}

                <button onClick={handleSubmit} disabled={submitting||!selectedSide||!name.trim()} className="btn-primary" style={{width:"100%",padding:13,fontSize:15}}>
                  {submitting?"Submitting...":!selectedSide?"Select YES or NO first":"Submit Prediction"}
                </button>

                {!user && (
                  <p style={{color:"#4b5563",fontSize:12,textAlign:"center",marginTop:12}}>
                    <button onClick={()=>navigate("/login")} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontSize:12,fontWeight:600}}>Sign in</button> to track your prediction history
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
