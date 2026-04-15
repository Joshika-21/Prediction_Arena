import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, getRealProbability } from "../api";

const API_BASE = "https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io";
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

    // Grid lines
    for(let i=0;i<=5;i++){
      const y=20+(i/5)*(H-55);
      ctx.strokeStyle="#1f2937"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(W-20,y); ctx.stroke();
      ctx.fillStyle="#6b7280"; ctx.font="12px Inter,sans-serif";
      ctx.fillText((max-(i/5)*range).toFixed(0)+"%",0,y+4);
    }

    const trend=history[history.length-1]>=history[0];
    const lineColor=trend?"#10b981":"#ef4444";

    // Fill gradient
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,lineColor+"30");
    grad.addColorStop(1,"transparent");
    ctx.beginPath();
    ctx.moveTo(toX(0),H-35);
    history.forEach((v,i)=>ctx.lineTo(toX(i),toY(v)));
    ctx.lineTo(toX(history.length-1),H-35);
    ctx.closePath(); ctx.fillStyle=grad; ctx.fill();

    // Line
    ctx.beginPath(); ctx.strokeStyle=lineColor; ctx.lineWidth=2.5; ctx.lineJoin="round";
    history.forEach((v,i)=>i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v)));
    ctx.stroke();

    // End dot with pulse
    const lx=toX(history.length-1), ly=toY(history[history.length-1]);
    ctx.beginPath(); ctx.arc(lx,ly,6,0,Math.PI*2); ctx.fillStyle=lineColor; ctx.fill();
    ctx.beginPath(); ctx.arc(lx,ly,10,0,Math.PI*2); ctx.strokeStyle=lineColor+"55"; ctx.lineWidth=2; ctx.stroke();

    // Time labels
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

  // Prediction state
  const [selectedSide, setSelectedSide] = useState(null); // "yes" or "no"
  const [confidence, setConfidence] = useState(50);
  const [name, setName] = useState(user?.username || "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{
    fetchEvent();
  },[id]);

  // Live chart ticker
  useEffect(()=>{
    const vol = 1.5;
    const interval = 800;
    const t = setInterval(()=>{
      setHistory(prev=>{
        if(prev.length < 2) return prev;
        const last = prev[prev.length-1];
        const next = Math.max(3,Math.min(97,last+(Math.random()-0.48)*vol));
        const r = parseFloat(next.toFixed(1));
        setCurrentVal(r);
        return [...prev.slice(-39), r];
      });
    }, interval);
    return ()=>clearInterval(t);
  },[isRealData]);

  const fetchEvent = async () => {
    try {
      // Try fetching from DB first
      const res = await fetch(`${API_BASE}/events/${id}`);
      if(res.ok) {
        const data = await res.json();
        setEvent(data);
        const base = data.yesPercent || 50;
        const h = generateHistory(base);
        setHistory(h);
        setCurrentVal(base);

        // Try to get real data
        getRealProbability(data).then(d=>{
          if(d&&d.prob){
            setHistory(generateHistory(d.prob, 40));
            setCurrentVal(d.prob);
            setDataLabel(d.label);
            setIsRealData(true);
          }
        }).catch(()=>{});

        // Get community stats
        const statsRes = await fetch(`${API_BASE}/events/${id}/predictions`);
        if(statsRes.ok) {
          const stats = await statsRes.json();
          setCommunityStats(stats);
        }
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if(!selectedSide) { setError("Please select YES or NO first"); return; }
    if(!name.trim()) { setError("Please enter your name"); return; }
    setSubmitting(true);
    setError("");
    try {
      // Convert to confidence value
      // If YES: confidence is the % probability YES happens
      // If NO: confidence is (100 - confidence) since user is saying NO with X% confidence
      const finalConfidence = selectedSide === "yes" ? confidence : 100 - confidence;
      await api.makePrediction(name, id, finalConfidence/100, event?.title, event?.category, event?.deadline);
      setSuccess(true);
    } catch(e) {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const trend = history.length > 1 ? currentVal - history[0] : 0;
  const trendUp = trend >= 0;

  if(loading) return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280",fontFamily:"Inter,sans-serif"}}>
      Loading event...
    </div>
  );

  if(!event) return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <p style={{color:"#6b7280",fontSize:"16px",marginBottom:"16px"}}>Event not found</p>
        <button onClick={()=>navigate("/")} style={{background:"#2563eb",color:"#fff",border:"none",padding:"10px 24px",borderRadius:"8px",cursor:"pointer"}}>Go Back</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0d1117",fontFamily:"Inter,-apple-system,sans-serif",color:"#f9fafb"}}>
      {/* Header */}
      <div style={{background:"#111827",borderBottom:"1px solid #1f2937",padding:"16px 32px",display:"flex",alignItems:"center",gap:"16px",position:"sticky",top:0,zIndex:100}}>
        <button onClick={()=>navigate("/")} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:"14px",display:"flex",alignItems:"center",gap:"4px"}}>
          ← Back
        </button>
        <span style={{color:"#6b7280",fontSize:"13px"}}>{CATEGORY_ICONS[event.category]} {event.category}</span>
        {isRealData && <span style={{background:"#064e3b",color:"#34d399",padding:"2px 8px",borderRadius:"4px",fontSize:"11px",fontWeight:600}}>LIVE DATA</span>}
        {event.status === "resolved" && (
          <span style={{background:event.actual_outcome===1?"#022c22":"#2d0a0a",color:event.actual_outcome===1?"#34d399":"#f87171",padding:"3px 10px",borderRadius:"4px",fontSize:"12px",fontWeight:600,border:`1px solid ${event.actual_outcome===1?"#10b981":"#ef4444"}`}}>
            {event.actual_outcome===1?"✓ Resolved YES":"✗ Resolved NO"}
          </span>
        )}
      </div>

      <div style={{maxWidth:"900px",margin:"0 auto",padding:"32px 24px"}}>
        {/* Title */}
        <h1 style={{color:"#f9fafb",fontSize:"24px",fontWeight:700,lineHeight:1.4,marginBottom:"8px"}}>{event.title}</h1>
        <p style={{color:"#6b7280",fontSize:"14px",marginBottom:"24px"}}>
          Closes {new Date(event.deadline).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
        </p>

        {/* Live price */}
        <div style={{display:"flex",alignItems:"baseline",gap:"12px",marginBottom:"8px"}}>
          <span style={{color:trendUp?"#10b981":"#ef4444",fontSize:"40px",fontWeight:700,fontFamily:"monospace"}}>{currentVal.toFixed(1)}%</span>
          <span style={{color:trendUp?"#10b981":"#ef4444",fontSize:"16px",fontWeight:500}}>{trendUp?"▲":"▼"} {Math.abs(trend).toFixed(1)}%</span>
          <span style={{display:"flex",alignItems:"center",gap:"5px",marginLeft:"8px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#10b981",display:"inline-block"}}/>
            <span style={{color:"#6b7280",fontSize:"13px"}}>{isRealData?"Real data":"Live"}</span>
          </span>
        </div>
        {dataLabel && <p style={{color:"#6b7280",fontSize:"13px",marginBottom:"16px"}}>{dataLabel}</p>}

        {/* Big Chart */}
        <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"12px",padding:"16px",marginBottom:"24px"}}>
          <BigLiveChart history={history}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px"}}>
          {/* Left: Community Stats + YES/NO bars */}
          <div>
            <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"12px",padding:"20px",marginBottom:"16px"}}>
              <h3 style={{color:"#f9fafb",fontSize:"15px",fontWeight:600,marginBottom:"16px"}}>Market Probabilities</h3>
              <div style={{marginBottom:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                  <span style={{color:"#10b981",fontSize:"15px",fontWeight:600}}>YES</span>
                  <span style={{color:"#10b981",fontSize:"18px",fontWeight:700}}>{Math.round(currentVal)}%</span>
                </div>
                <div style={{height:"8px",background:"#1f2937",borderRadius:"4px"}}>
                  <div style={{height:"100%",width:`${currentVal}%`,background:"#10b981",borderRadius:"4px",transition:"width 0.5s"}}/>
                </div>
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                  <span style={{color:"#ef4444",fontSize:"15px",fontWeight:600}}>NO</span>
                  <span style={{color:"#ef4444",fontSize:"18px",fontWeight:700}}>{100-Math.round(currentVal)}%</span>
                </div>
                <div style={{height:"8px",background:"#1f2937",borderRadius:"4px"}}>
                  <div style={{height:"100%",width:`${100-currentVal}%`,background:"#ef4444",borderRadius:"4px",transition:"width 0.5s"}}/>
                </div>
              </div>
            </div>

            {communityStats && (
              <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"12px",padding:"20px"}}>
                <h3 style={{color:"#f9fafb",fontSize:"15px",fontWeight:600,marginBottom:"16px"}}>Community Stats</h3>
                {[
                  ["Total Predictions", communityStats.totalPredictions || 0],
                  ["Avg Confidence", `${communityStats.avgConfidence?.toFixed(1) || 50}%`],
                  ["Yes Leaning", `${communityStats.yesPercent?.toFixed(1) || 50}%`],
                  ["No Leaning", `${communityStats.noPercent?.toFixed(1) || 50}%`],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1f2937"}}>
                    <span style={{color:"#9ca3af",fontSize:"13px"}}>{k}</span>
                    <span style={{color:"#f9fafb",fontSize:"13px",fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Prediction form */}
          <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"12px",padding:"20px"}}>
            {success ? (
              <div style={{textAlign:"center",padding:"32px 0"}}>
                <div style={{fontSize:"48px",marginBottom:"16px"}}>✅</div>
                <p style={{color:"#10b981",fontSize:"18px",fontWeight:600,marginBottom:"8px"}}>Prediction Submitted!</p>
                <p style={{color:"#6b7280",fontSize:"14px",marginBottom:"8px"}}>
                  You predicted <strong style={{color:selectedSide==="yes"?"#10b981":"#ef4444"}}>{selectedSide?.toUpperCase()}</strong> with <strong>{confidence}%</strong> confidence
                </p>
                <div style={{display:"flex",gap:"8px",justifyContent:"center",marginTop:"20px"}}>
                  <button onClick={()=>{setSuccess(false);setSelectedSide(null);setConfidence(50);}} style={{padding:"10px 20px",background:"#1f2937",color:"#f9fafb",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"14px"}}>Predict Again</button>
                  <button onClick={()=>navigate("/my-predictions")} style={{padding:"10px 20px",background:"#2563eb",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"14px",fontWeight:500}}>My Predictions</button>
                </div>
              </div>
            ) : (
              <>
                <h3 style={{color:"#f9fafb",fontSize:"15px",fontWeight:600,marginBottom:"20px"}}>Make Your Prediction</h3>

                {/* Step 1: YES or NO */}
                <p style={{color:"#9ca3af",fontSize:"12px",fontWeight:500,marginBottom:"10px",letterSpacing:"0.5px"}}>STEP 1 — DO YOU THINK THIS WILL HAPPEN?</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
                  <button
                    onClick={()=>setSelectedSide("yes")}
                    style={{padding:"16px",background:selectedSide==="yes"?"#022c22":"#1f2937",border:`2px solid ${selectedSide==="yes"?"#10b981":"#374151"}`,borderRadius:"10px",cursor:"pointer",transition:"all 0.2s"}}
                  >
                    <div style={{color:"#10b981",fontSize:"22px",fontWeight:700}}>YES</div>
                    <div style={{color:"#10b981",fontSize:"12px",marginTop:"2px"}}>It will happen</div>
                  </button>
                  <button
                    onClick={()=>setSelectedSide("no")}
                    style={{padding:"16px",background:selectedSide==="no"?"#2d0a0a":"#1f2937",border:`2px solid ${selectedSide==="no"?"#ef4444":"#374151"}`,borderRadius:"10px",cursor:"pointer",transition:"all 0.2s"}}
                  >
                    <div style={{color:"#ef4444",fontSize:"22px",fontWeight:700}}>NO</div>
                    <div style={{color:"#ef4444",fontSize:"12px",marginTop:"2px"}}>It won't happen</div>
                  </button>
                </div>

                {/* Step 2: Confidence — only shows after YES/NO selected */}
                {selectedSide && (
                  <div style={{animation:"fadeIn 0.3s ease"}}>
                    <p style={{color:"#9ca3af",fontSize:"12px",fontWeight:500,marginBottom:"10px",letterSpacing:"0.5px"}}>
                      STEP 2 — HOW CONFIDENT ARE YOU?
                    </p>
                    <div style={{background:"#0d1117",borderRadius:"10px",padding:"16px",marginBottom:"16px",border:"1px solid #1f2937"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                        <span style={{color:selectedSide==="yes"?"#10b981":"#ef4444",fontSize:"14px",fontWeight:600}}>
                          {selectedSide==="yes"?"YES":"NO"} — {confidence}% confident
                        </span>
                        <span style={{color:"#6b7280",fontSize:"12px"}}>
                          {confidence < 40 ? "Not very sure" : confidence < 70 ? "Fairly confident" : "Very confident"}
                        </span>
                      </div>
                      <input
                        type="range" min="1" max="99" value={confidence}
                        onChange={e=>setConfidence(Number(e.target.value))}
                        style={{width:"100%",accentColor:selectedSide==="yes"?"#10b981":"#ef4444",height:"4px"}}
                      />
                      <div style={{display:"flex",justifyContent:"space-between",color:"#4b5563",fontSize:"11px",marginTop:"6px"}}>
                        <span>Just guessing (1%)</span>
                        <span>Absolutely certain (99%)</span>
                      </div>
                    </div>

                    {/* Summary */}
                    <div style={{background:selectedSide==="yes"?"#022c22":"#2d0a0a",border:`1px solid ${selectedSide==="yes"?"#10b981":"#ef4444"}`,borderRadius:"8px",padding:"12px",marginBottom:"16px",textAlign:"center"}}>
                      <p style={{color:selectedSide==="yes"?"#34d399":"#f87171",fontSize:"13px",margin:0}}>
                        You predict <strong>{selectedSide.toUpperCase()}</strong> with <strong>{confidence}%</strong> confidence
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 3: Name */}
                {selectedSide && (
                  <div style={{marginBottom:"16px"}}>
                    <p style={{color:"#9ca3af",fontSize:"12px",fontWeight:500,marginBottom:"8px",letterSpacing:"0.5px"}}>STEP 3 — YOUR NAME</p>
                    <input
                      value={name}
                      onChange={e=>setName(e.target.value)}
                      placeholder="Enter your name"
                      style={{width:"100%",padding:"10px 14px",background:"#1f2937",border:"1px solid #374151",borderRadius:"8px",color:"#f9fafb",fontSize:"14px",boxSizing:"border-box",outline:"none"}}
                    />
                  </div>
                )}

                {error && <p style={{color:"#ef4444",fontSize:"13px",marginBottom:"12px"}}>{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting||!selectedSide||!name.trim()}
                  style={{width:"100%",padding:"13px",background:submitting||!selectedSide||!name.trim()?"#1f2937":"#2563eb",color:submitting||!selectedSide||!name.trim()?"#6b7280":"#fff",border:"none",borderRadius:"8px",cursor:submitting||!selectedSide||!name.trim()?"not-allowed":"pointer",fontWeight:600,fontSize:"15px",transition:"all 0.2s"}}
                >
                  {submitting?"Submitting...":!selectedSide?"Select YES or NO first":"Submit Prediction"}
                </button>

                {!user && (
                  <p style={{color:"#6b7280",fontSize:"12px",textAlign:"center",marginTop:"12px"}}>
                    <button onClick={()=>navigate("/login")} style={{background:"none",border:"none",color:"#2563eb",cursor:"pointer",fontSize:"12px"}}>Sign in</button> to track your prediction history
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}