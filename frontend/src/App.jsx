import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { api, getRealProbability, enrichEventsWithRealData } from "./api";
import Login from "./pages/Login";
import MyPredictions from "./pages/MyPredictions";
import Admin from "./pages/Admin";
import EventDetail from "./pages/EventDetail";

const CATEGORIES = ["Trending", "Elections", "Politics", "Sports", "Culture", "Crypto", "Climate", "Economics", "Companies", "Financials", "Tech & Science"];
const CATEGORY_ICONS = { Trending:"🔥", Elections:"🗳️", Politics:"🏛️", Sports:"⚽", Culture:"🎭", Crypto:"₿", Climate:"🌍", Economics:"📈", Companies:"🏢", Financials:"💹", "Tech & Science":"🔬" };

const HARDCODED_EVENTS = [
  { id:"h1", title:"Will India win the ICC Champions Trophy 2025?", category:"Sports", deadline:"2025-03-09", baseProb:62 },
  { id:"h2", title:"Will the Mumbai Indians win IPL 2025?", category:"Sports", deadline:"2025-05-25", baseProb:28 },
  { id:"h3", title:"Will Real Madrid win Champions League 2025?", category:"Sports", deadline:"2025-05-31", baseProb:35 },
  { id:"h4", title:"Will the Golden State Warriors make the 2025 playoffs?", category:"Sports", deadline:"2025-04-13", baseProb:45 },
  { id:"h5", title:"Will Novak Djokovic win Wimbledon 2025?", category:"Sports", deadline:"2025-07-13", baseProb:30 },
  { id:"h6", title:"Will Bitcoin exceed $150k by end of 2025?", category:"Crypto", deadline:"2025-12-31", baseProb:38 },
  { id:"h7", title:"Will Ethereum flip Bitcoin in market cap by 2026?", category:"Crypto", deadline:"2026-12-31", baseProb:12 },
  { id:"h8", title:"Will a spot Solana ETF be approved in 2025?", category:"Crypto", deadline:"2025-12-31", baseProb:55 },
  { id:"h9", title:"Will the US enter a recession in 2025?", category:"Economics", deadline:"2025-12-31", baseProb:40 },
  { id:"h10", title:"Will US inflation drop below 2% in 2025?", category:"Economics", deadline:"2025-12-31", baseProb:48 },
  { id:"h11", title:"Will the Fed cut rates at least 3 times in 2025?", category:"Economics", deadline:"2025-12-31", baseProb:35 },
  { id:"h12", title:"Will Kamala Harris run for President in 2028?", category:"Elections", deadline:"2027-12-31", baseProb:52 },
  { id:"h13", title:"Will there be a snap election in the UK in 2025?", category:"Elections", deadline:"2025-12-31", baseProb:18 },
  { id:"h14", title:"Will Modi win a 4th term as India PM?", category:"Elections", deadline:"2029-05-31", baseProb:61 },
  { id:"h15", title:"Will the US ban TikTok in 2025?", category:"Politics", deadline:"2025-12-31", baseProb:44 },
  { id:"h16", title:"Will NATO expand to include Ukraine by 2026?", category:"Politics", deadline:"2026-12-31", baseProb:22 },
  { id:"h17", title:"Will Apple become the first $4T company?", category:"Companies", deadline:"2025-12-31", baseProb:58 },
  { id:"h18", title:"Will Elon Musk remain Twitter/X CEO in 2026?", category:"Companies", deadline:"2026-12-31", baseProb:65 },
  { id:"h19", title:"Will OpenAI go public in 2025?", category:"Companies", deadline:"2025-12-31", baseProb:30 },
  { id:"h20", title:"Will AGI be achieved before 2030?", category:"Tech & Science", deadline:"2029-12-31", baseProb:25 },
  { id:"h21", title:"Will GPT-5 score above 90% on all benchmarks?", category:"Tech & Science", deadline:"2025-12-31", baseProb:70 },
  { id:"h22", title:"Will a human land on Mars before 2030?", category:"Tech & Science", deadline:"2029-12-31", baseProb:15 },
  { id:"h23", title:"Will global CO2 emissions peak before 2025?", category:"Climate", deadline:"2025-12-31", baseProb:42 },
  { id:"h24", title:"Will 2025 be the hottest year on record?", category:"Climate", deadline:"2025-12-31", baseProb:68 },
  { id:"h25", title:"Will the S&P 500 hit 6500 in 2025?", category:"Financials", deadline:"2025-12-31", baseProb:55 },
  { id:"h26", title:"Will gold hit $3500/oz in 2025?", category:"Financials", deadline:"2025-12-31", baseProb:48 },
  { id:"h27", title:"Will Taylor Swift Eras Tour gross $2B total?", category:"Culture", deadline:"2025-12-31", baseProb:72 },
  { id:"h28", title:"Will a new Marvel Avengers film be announced in 2025?", category:"Culture", deadline:"2025-12-31", baseProb:80 },
  { id:"h29", title:"Will Lionel Messi retire from football in 2025?", category:"Sports", deadline:"2025-12-31", baseProb:20 },
  { id:"h30", title:"Will Pakistan qualify for the 2026 FIFA World Cup?", category:"Sports", deadline:"2025-11-30", baseProb:18 },
  { id:"h31", title:"Will the Euro weaken below 1.0 vs USD in 2025?", category:"Financials", deadline:"2025-12-31", baseProb:35 },
  { id:"h32", title:"Will Netflix hit 350M subscribers in 2025?", category:"Companies", deadline:"2025-12-31", baseProb:60 },
];

function generateHistory(base, points=40) {
  const h=[]; let cur=base;
  for(let i=0;i<points;i++){
    cur=Math.max(3,Math.min(97,cur+(Math.random()-0.48)*2));
    h.push(parseFloat(cur.toFixed(1)));
  }
  return h;
}

function LiveModalChart({ history }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas||history.length<2) return;
    const ctx = canvas.getContext("2d");
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    const min=Math.max(0,Math.min(...history)-8);
    const max=Math.min(100,Math.max(...history)+8);
    const range=max-min||1;
    const toX=i=>(i/(history.length-1))*(W-50)+25;
    const toY=v=>H-25-((v-min)/range)*(H-45);
    for(let i=0;i<=4;i++){
      const y=15+(i/4)*(H-40);
      ctx.strokeStyle="#1f2937"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(25,y); ctx.lineTo(W-15,y); ctx.stroke();
      ctx.fillStyle="#4b5563"; ctx.font="11px Inter,sans-serif";
      ctx.fillText((max-(i/4)*range).toFixed(0)+"%",0,y+4);
    }
    const trend=history[history.length-1]>=history[0];
    const lineColor=trend?"#10b981":"#ef4444";
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,lineColor+"25"); grad.addColorStop(1,"transparent");
    ctx.beginPath();
    ctx.moveTo(toX(0),H-25);
    history.forEach((v,i)=>ctx.lineTo(toX(i),toY(v)));
    ctx.lineTo(toX(history.length-1),H-25);
    ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); ctx.strokeStyle=lineColor; ctx.lineWidth=2; ctx.lineJoin="round";
    history.forEach((v,i)=>i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v)));
    ctx.stroke();
    const lx=toX(history.length-1), ly=toY(history[history.length-1]);
    ctx.beginPath(); ctx.arc(lx,ly,4,0,Math.PI*2); ctx.fillStyle=lineColor; ctx.fill();
  },[history]);
  return <canvas ref={canvasRef} width={460} height={150} style={{width:"100%",height:"150px"}}/>;
}

function PredictionModal({ event, onClose, onSubmit, user }) {
  const [confidence, setConfidence] = useState(event.currentProb||50);
  const [name, setName] = useState(user?.username || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState(()=>generateHistory(event.currentProb||50));
  const [currentVal, setCurrentVal] = useState(event.currentProb||50);
  const [dataLabel, setDataLabel] = useState(null);
  const [isRealData, setIsRealData] = useState(false);
  const navigate = useNavigate();

  useEffect(()=>{
    getRealProbability(event).then(d=>{
      if(d&&d.history&&d.history.length>2){
        setHistory(d.history); setCurrentVal(d.prob);
        setDataLabel(d.label); setIsRealData(true);
      }
    }).catch(()=>{});
  },[event.id]);

  useEffect(()=>{
    const t=setInterval(()=>{
      setHistory(prev=>{
        const last=prev[prev.length-1];
        const vol=isRealData?0.3:1.2;
        const next=Math.max(3,Math.min(97,last+(Math.random()-0.48)*vol));
        const r=parseFloat(next.toFixed(1));
        setCurrentVal(r);
        return [...prev.slice(-59),r];
      });
    }, isRealData?5000:1000);
    return ()=>clearInterval(t);
  },[isRealData]);

  const trend=history.length>1?currentVal-history[0]:0;
  const trendUp=trend>=0;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:"#111827",border:"1px solid #374151",borderRadius:"12px",padding:"28px",width:"540px",maxWidth:"95vw",boxShadow:"0 25px 50px rgba(0,0,0,0.6)",position:"relative",maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{position:"absolute",top:"16px",right:"16px",background:"#1f2937",border:"none",color:"#9ca3af",cursor:"pointer",width:"32px",height:"32px",borderRadius:"8px",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>

        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
          <span style={{color:"#9ca3af",fontSize:"13px",fontWeight:500}}>{CATEGORY_ICONS[event.category]} {event.category}</span>
          {isRealData && <span style={{background:"#064e3b",color:"#34d399",padding:"2px 8px",borderRadius:"4px",fontSize:"11px",fontWeight:600}}>LIVE DATA</span>}
        </div>

        <h2 style={{color:"#f9fafb",fontSize:"18px",fontWeight:600,lineHeight:1.4,marginBottom:"4px",paddingRight:"40px"}}>{event.title}</h2>
        <p style={{color:"#6b7280",fontSize:"13px",marginBottom:"20px"}}>Closes {new Date(event.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</p>

        <div style={{display:"flex",alignItems:"baseline",gap:"12px",marginBottom:"4px"}}>
          <span style={{color:trendUp?"#10b981":"#ef4444",fontSize:"32px",fontWeight:700,fontFamily:"monospace"}}>{currentVal.toFixed(1)}%</span>
          <span style={{color:trendUp?"#10b981":"#ef4444",fontSize:"14px",fontWeight:500}}>{trendUp?"▲":"▼"} {Math.abs(trend).toFixed(1)}%</span>
          <span style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"5px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#10b981",display:"inline-block"}}/>
            <span style={{color:"#6b7280",fontSize:"12px"}}>{isRealData?"Real data":"Live"}</span>
          </span>
        </div>
        {dataLabel && <p style={{color:"#6b7280",fontSize:"12px",marginBottom:"12px"}}>{dataLabel}</p>}

        <div style={{background:"#0d1117",borderRadius:"8px",padding:"12px 12px 8px",marginBottom:"24px",border:"1px solid #1f2937"}}>
          <LiveModalChart history={history}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
            <span style={{color:"#374151",fontSize:"11px"}}>Earlier</span>
            <span style={{color:"#374151",fontSize:"11px"}}>Now</span>
          </div>
        </div>

        {success?(
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:"40px",marginBottom:"12px"}}>✅</div>
            <p style={{color:"#10b981",fontSize:"18px",fontWeight:600}}>Prediction Submitted!</p>
            <p style={{color:"#6b7280",marginTop:"8px",fontSize:"14px"}}>You predicted {confidence}% YES</p>
            <div style={{display:"flex",gap:"8px",justifyContent:"center",marginTop:"20px"}}>
              <button onClick={onClose} style={{padding:"10px 24px",background:"#1f2937",color:"#f9fafb",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600,fontSize:"14px"}}>Close</button>
              {user && <button onClick={()=>{onClose();navigate("/my-predictions");}} style={{padding:"10px 24px",background:"#2563eb",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600,fontSize:"14px"}}>View My Predictions</button>}
            </div>
          </div>
        ):(
          <>
            {!user && (
              <div style={{background:"#1e3a5f",border:"1px solid #2563eb",borderRadius:"8px",padding:"12px",marginBottom:"16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{color:"#93c5fd",fontSize:"13px",margin:0}}>Sign in to track your predictions</p>
                <button onClick={()=>{onClose();navigate("/login");}} style={{background:"#2563eb",color:"#fff",border:"none",padding:"6px 14px",borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontWeight:500}}>Sign In</button>
              </div>
            )}

            <div style={{marginBottom:"16px"}}>
              <label style={{color:"#9ca3af",fontSize:"12px",fontWeight:500,display:"block",marginBottom:"6px",letterSpacing:"0.5px"}}>YOUR NAME</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name" style={{width:"100%",padding:"10px 14px",background:"#1f2937",border:"1px solid #374151",borderRadius:"8px",color:"#f9fafb",fontSize:"14px",boxSizing:"border-box",outline:"none"}}/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
              <div style={{background:confidence>50?"#022c22":"#1a2234",border:`1px solid ${confidence>50?"#10b981":"#374151"}`,borderRadius:"8px",padding:"14px",textAlign:"center",transition:"all 0.2s"}}>
                <div style={{color:"#10b981",fontSize:"26px",fontWeight:700}}>{confidence}%</div>
                <div style={{color:"#10b981",fontSize:"12px",fontWeight:600,letterSpacing:"1px",marginTop:"2px"}}>YES</div>
              </div>
              <div style={{background:confidence<50?"#2d0a0a":"#1a2234",border:`1px solid ${confidence<50?"#ef4444":"#374151"}`,borderRadius:"8px",padding:"14px",textAlign:"center",transition:"all 0.2s"}}>
                <div style={{color:"#ef4444",fontSize:"26px",fontWeight:700}}>{100-confidence}%</div>
                <div style={{color:"#ef4444",fontSize:"12px",fontWeight:600,letterSpacing:"1px",marginTop:"2px"}}>NO</div>
              </div>
            </div>

            <input type="range" min="1" max="99" value={confidence} onChange={e=>setConfidence(Number(e.target.value))} style={{width:"100%",accentColor:"#2563eb",marginBottom:"6px",height:"4px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",color:"#6b7280",fontSize:"12px",marginBottom:"16px"}}><span>Unlikely (1%)</span><span>Very likely (99%)</span></div>

            <div style={{background:"#1f2937",borderRadius:"8px",padding:"12px",marginBottom:"16px",textAlign:"center",fontSize:"13px"}}>
              <span style={{color:"#9ca3af"}}>Market: </span>
              <span style={{color:"#f9fafb",fontWeight:600}}>{currentVal.toFixed(1)}% YES</span>
              <span style={{color:"#6b7280"}}> · Your pick: </span>
              <span style={{color:confidence>50?"#10b981":"#ef4444",fontWeight:600}}>{confidence}% YES</span>
            </div>

            <button onClick={()=>{
              if(!name.trim()||loading)return;
              setLoading(true);
              onSubmit(name,event.id,confidence/100)
                .then(()=>setSuccess(true))
                .catch(console.error)
                .finally(()=>setLoading(false));
            }} disabled={loading||!name.trim()} style={{width:"100%",padding:"13px",background:loading||!name.trim()?"#1f2937":"#2563eb",color:loading||!name.trim()?"#6b7280":"#fff",border:"none",borderRadius:"8px",cursor:loading||!name.trim()?"not-allowed":"pointer",fontWeight:600,fontSize:"15px",transition:"all 0.2s"}}>
              {loading?"Submitting...":"Submit Prediction"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, onClick }) {
  const navigate = useNavigate();
  const yesProb=Math.round(event.currentProb||50);
  const noProb=100-yesProb;
  const daysLeft=Math.max(0,Math.ceil((new Date(event.deadline)-new Date())/(1000*60*60*24)));
  // DB events have UUID ids, hardcoded events have h1, h2 etc
  const isDBEvent = event.id && !event.id.startsWith("h") && !event.id.startsWith("odds_") && !event.id.startsWith("poly_");

  const handleClick = () => {
    if(isDBEvent) navigate(`/events/${event.id}`);
    else onClick();
  };

  return (
    <div onClick={handleClick} style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"10px",padding:"18px 20px",cursor:"pointer",transition:"border-color 0.15s, background 0.15s",position:"relative"}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor="#374151";e.currentTarget.style.background="#161f2e";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor="#1f2937";e.currentTarget.style.background="#111827";}}>

      <div style={{position:"absolute",top:"14px",right:"14px"}}>
        {event.status==="resolved"?(
          <span style={{background:event.actual_outcome===1?"#022c22":"#2d0a0a",color:event.actual_outcome===1?"#34d399":"#f87171",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"4px",border:`1px solid ${event.actual_outcome===1?"#10b981":"#ef4444"}`}}>
            {event.actual_outcome===1?"✓ YES":"✗ NO"}
          </span>
        ):event.hasRealData?(
          <span style={{background:"#064e3b",color:"#34d399",fontSize:"11px",fontWeight:600,padding:"2px 7px",borderRadius:"4px"}}>LIVE</span>
        ):null}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"10px",paddingRight:event.status==="resolved"||event.hasRealData?"70px":"0"}}>
        <span style={{color:"#6b7280",fontSize:"13px",fontWeight:500}}>{CATEGORY_ICONS[event.category]} {event.category}</span>
        <span style={{marginLeft:"auto",color:"#4b5563",fontSize:"11px"}}>{daysLeft===0?"Closed":`${daysLeft}d`}</span>
      </div>

      <h3 style={{color:"#e5e7eb",fontSize:"15px",fontWeight:500,lineHeight:1.5,marginBottom:"16px",minHeight:"46px"}}>{event.title}</h3>

      <div style={{marginBottom:"10px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"5px"}}>
          <span style={{color:"#10b981",fontSize:"13px",fontWeight:500}}>Yes</span>
          <span style={{color:"#10b981",fontSize:"14px",fontWeight:700}}>{yesProb}%</span>
        </div>
        <div style={{height:"4px",background:"#1f2937",borderRadius:"2px"}}>
          <div style={{height:"100%",width:`${yesProb}%`,background:"#10b981",borderRadius:"2px",transition:"width 0.4s"}}/>
        </div>
      </div>

      <div style={{marginBottom:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"5px"}}>
          <span style={{color:"#ef4444",fontSize:"13px",fontWeight:500}}>No</span>
          <span style={{color:"#ef4444",fontSize:"14px",fontWeight:700}}>{noProb}%</span>
        </div>
        <div style={{height:"4px",background:"#1f2937",borderRadius:"2px"}}>
          <div style={{height:"100%",width:`${noProb}%`,background:"#ef4444",borderRadius:"2px",transition:"width 0.4s"}}/>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:"12px",borderTop:"1px solid #1f2937"}}>
        <span style={{color:"#4b5563",fontSize:"12px"}}>{event.totalPredictions||0} predictions</span>
        <button style={{background:"#1d4ed8",color:"#fff",border:"none",padding:"6px 16px",borderRadius:"6px",cursor:"pointer",fontSize:"13px",fontWeight:500}}>Predict</button>
      </div>
    </div>
  );
}

function Markets({ user, onLogout }) {
  const [allEvents, setAllEvents] = useState([]);
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(()=>{
    fetchEvents();
    fetchLeaderboard();
    const lb=setInterval(fetchLeaderboard,5000);
    const ev=setInterval(fetchEvents,30000);
    const handleVisibility=()=>{ if(document.visibilityState==='visible') fetchEvents(); };
    document.addEventListener('visibilitychange',handleVisibility);
    return ()=>{ clearInterval(lb); clearInterval(ev); document.removeEventListener('visibilitychange',handleVisibility); };
  },[]);

  const fetchEvents=async()=>{
    try{
      const data=await api.getEvents();
      const dbEvents=data.map(e=>({...e,chartHistory:generateHistory(50),currentProb:50,status:e.status||'active',actual_outcome:e.actual_outcome,totalPredictions:Math.floor(Math.random()*50)+1}));
      const enriched=await enrichEventsWithRealData(dbEvents);
      setAllEvents(enriched);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  };

  const fetchLeaderboard=async()=>{
    try{const d=await api.getLeaderboard();setLeaderboard(d);}catch(e){}
  };

  const handlePredict=async(userId,eventId,prob)=>{
    const ev=allEvents.find(e=>e.id===eventId);
    return api.makePrediction(userId, eventId, prob, ev?.title, ev?.category, ev?.deadline, "yes");
  };

  const filtered=allEvents.filter(e=>{
    const cat=activeCategory==="Trending"||e.category===activeCategory;
    const search=!searchQuery||e.title.toLowerCase().includes(searchQuery.toLowerCase());
    return cat&&search;
  });

  return (
    <div style={{fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif",minHeight:"100vh",background:"#0d1117",color:"#f9fafb"}}>
      {/* Navbar */}
      <div style={{background:"#111827",borderBottom:"1px solid #1f2937",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:"1600px",margin:"0 auto",padding:"0 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"24px",height:"56px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px",flexShrink:0}}>
              <span style={{color:"#2563eb",fontSize:"20px",fontWeight:700}}>Prediction</span>
              <span style={{color:"#f9fafb",fontSize:"20px",fontWeight:700}}>Arena</span>
            </div>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search markets..." style={{flex:1,maxWidth:"360px",padding:"8px 14px",background:"#1f2937",border:"1px solid #374151",borderRadius:"8px",color:"#f9fafb",fontSize:"14px",outline:"none"}}/>
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#10b981",display:"inline-block"}}/>
                <span style={{color:"#10b981",fontSize:"13px",fontWeight:500}}>Live</span>
                <span style={{color:"#6b7280",fontSize:"13px",marginLeft:"2px"}}>{allEvents.length} markets</span>
              </div>
              {user ? (
                <div style={{position:"relative"}}>
                  <button onClick={()=>setUserMenuOpen(!userMenuOpen)} style={{background:"#1f2937",border:"1px solid #374151",color:"#f9fafb",padding:"6px 14px",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:500,display:"flex",alignItems:"center",gap:"6px"}}>
                    👤 {user.username} ▾
                  </button>
                  {userMenuOpen && (
                    <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:"#1f2937",border:"1px solid #374151",borderRadius:"8px",overflow:"hidden",minWidth:"160px",boxShadow:"0 10px 25px rgba(0,0,0,0.4)"}}>
                      <button onClick={()=>{navigate("/my-predictions");setUserMenuOpen(false);}} style={{width:"100%",padding:"10px 16px",background:"none",border:"none",color:"#e5e7eb",fontSize:"13px",cursor:"pointer",textAlign:"left"}}>📊 My Predictions</button>
                      <button onClick={()=>{navigate("/admin");setUserMenuOpen(false);}} style={{width:"100%",padding:"10px 16px",background:"none",border:"none",color:"#e5e7eb",fontSize:"13px",cursor:"pointer",textAlign:"left"}}>⚙️ Admin Panel</button>
                      <div style={{borderTop:"1px solid #374151"}}/>
                      <button onClick={()=>{onLogout();setUserMenuOpen(false);}} style={{width:"100%",padding:"10px 16px",background:"none",border:"none",color:"#ef4444",fontSize:"13px",cursor:"pointer",textAlign:"left"}}>🚪 Sign Out</button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={()=>navigate("/login")} style={{background:"#2563eb",color:"#fff",border:"none",padding:"7px 16px",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:500}}>Sign In</button>
              )}
            </div>
          </div>
        </div>
        <div style={{borderTop:"1px solid #1f2937",overflowX:"auto"}}>
          <div style={{maxWidth:"1600px",margin:"0 auto",padding:"0 24px",display:"flex"}}>
            {CATEGORIES.map(cat=>(
              <button key={cat} onClick={()=>setActiveCategory(cat)} style={{background:"none",border:"none",cursor:"pointer",padding:"10px 16px",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",color:activeCategory===cat?"#f9fafb":"#9ca3af",borderBottom:activeCategory===cat?"2px solid #2563eb":"2px solid transparent",transition:"all 0.15s"}}>
                {CATEGORY_ICONS[cat]} {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:"1600px",margin:"0 auto",padding:"24px",display:"grid",gridTemplateColumns:"1fr 280px",gap:"24px",alignItems:"start"}}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
            <h2 style={{color:"#f9fafb",fontSize:"16px",fontWeight:600}}>{activeCategory==="Trending"?"Trending Markets":`${CATEGORY_ICONS[activeCategory]} ${activeCategory}`}</h2>
            <span style={{color:"#6b7280",fontSize:"13px"}}>{filtered.length} markets</span>
          </div>
          {loading?(
            <div style={{textAlign:"center",padding:"80px",color:"#6b7280",fontSize:"14px"}}>Loading markets...</div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
              {filtered.map(ev=><EventCard key={ev.id} event={ev} onClick={()=>setSelectedEvent(ev)}/>)}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:"16px",position:"sticky",top:"112px"}}>
          <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"10px",padding:"18px"}}>
            <h3 style={{color:"#f9fafb",fontSize:"14px",fontWeight:600,marginBottom:"14px"}}>🏅 Leaderboard</h3>
            {leaderboard.length===0?(
              <p style={{color:"#6b7280",fontSize:"13px",textAlign:"center",padding:"12px 0"}}>No predictions yet</p>
            ):leaderboard.slice(0,8).map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 0",borderBottom:i<Math.min(leaderboard.length,8)-1?"1px solid #1f2937":"none"}}>
                <span style={{color:i===0?"#f59e0b":i===1?"#9ca3af":i===2?"#b45309":"#6b7280",fontSize:"13px",fontWeight:600,width:"20px"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}</span>
                <span style={{color:"#e5e7eb",fontSize:"13px",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.playerName}</span>
                <span style={{color:"#2563eb",fontSize:"13px",fontWeight:600,fontFamily:"monospace"}}>{p.score?.toFixed(3)}</span>
              </div>
            ))}
          </div>

          <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"10px",padding:"18px"}}>
            <h3 style={{color:"#f9fafb",fontSize:"14px",fontWeight:600,marginBottom:"14px"}}>How it works</h3>
            {["Browse prediction markets","Click a card to see live chart","Set your confidence level","Submit your prediction","Get scored with Brier Score"].map((s,i)=>(
              <div key={i} style={{display:"flex",gap:"10px",marginBottom:"10px",alignItems:"flex-start"}}>
                <span style={{background:"#1e3a8a",color:"#93c5fd",borderRadius:"4px",minWidth:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:700}}>{i+1}</span>
                <span style={{color:"#9ca3af",fontSize:"13px",lineHeight:1.5}}>{s}</span>
              </div>
            ))}
          </div>

          <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"10px",padding:"18px"}}>
            <h3 style={{color:"#f9fafb",fontSize:"14px",fontWeight:600,marginBottom:"12px"}}>Stats</h3>
            {[["Markets",allEvents.length],["Categories",CATEGORIES.length-1],["Data Sources","4 APIs"],["Updates","Real-time"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #1f2937"}}>
                <span style={{color:"#9ca3af",fontSize:"13px"}}>{k}</span>
                <span style={{color:"#f9fafb",fontSize:"13px",fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedEvent&&<PredictionModal event={selectedEvent} onClose={()=>setSelectedEvent(null)} onSubmit={handlePredict} user={user}/>}
    </div>
  );
}

const AUTH_API = "https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io";

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
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(6px)"}}>
      <div style={{width:"400px",maxWidth:"90vw",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:"-36px",right:0,background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:"13px",fontWeight:500}}>
          Skip for now →
        </button>
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"26px",fontWeight:700,marginBottom:"6px"}}>
            <span style={{color:"#2563eb"}}>Prediction</span><span style={{color:"#f9fafb"}}> Arena</span>
          </div>
          <p style={{color:"#6b7280",fontSize:"14px",margin:0}}>
            {isLogin ? "Welcome back! Sign in to continue." : "Create an account to start predicting."}
          </p>
        </div>
        <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:"12px",padding:"32px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:"#0d1117",borderRadius:"8px",padding:"4px",marginBottom:"24px"}}>
            <button onClick={()=>{setIsLogin(true);setError("");}} style={{padding:"8px",background:isLogin?"#1f2937":"transparent",border:"none",borderRadius:"6px",color:isLogin?"#f9fafb":"#6b7280",fontSize:"14px",fontWeight:500,cursor:"pointer"}}>Sign In</button>
            <button onClick={()=>{setIsLogin(false);setError("");}} style={{padding:"8px",background:!isLogin?"#1f2937":"transparent",border:"none",borderRadius:"6px",color:!isLogin?"#f9fafb":"#6b7280",fontSize:"14px",fontWeight:500,cursor:"pointer"}}>Register</button>
          </div>
          <div style={{marginBottom:"16px"}}>
            <label style={{color:"#9ca3af",fontSize:"12px",fontWeight:500,display:"block",marginBottom:"6px"}}>USERNAME</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username"
              style={{width:"100%",padding:"10px 14px",background:"#1f2937",border:"1px solid #374151",borderRadius:"8px",color:"#f9fafb",fontSize:"14px",boxSizing:"border-box",outline:"none"}}/>
          </div>
          <div style={{marginBottom:"24px"}}>
            <label style={{color:"#9ca3af",fontSize:"12px",fontWeight:500,display:"block",marginBottom:"6px"}}>PASSWORD</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"
              onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
              style={{width:"100%",padding:"10px 14px",background:"#1f2937",border:"1px solid #374151",borderRadius:"8px",color:"#f9fafb",fontSize:"14px",boxSizing:"border-box",outline:"none"}}/>
          </div>
          {error && (
            <div style={{background:"#2d0a0a",border:"1px solid #ef4444",borderRadius:"6px",padding:"10px 14px",marginBottom:"16px"}}>
              <p style={{color:"#f87171",fontSize:"13px",margin:0}}>{error}</p>
            </div>
          )}
          <button onClick={handleSubmit} disabled={loading}
            style={{width:"100%",padding:"12px",background:loading?"#1f2937":"#2563eb",color:loading?"#6b7280":"#fff",border:"none",borderRadius:"8px",cursor:loading?"not-allowed":"pointer",fontWeight:600,fontSize:"15px"}}>
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </button>
          <p style={{textAlign:"center",color:"#6b7280",fontSize:"13px",marginTop:"20px",marginBottom:0}}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={()=>{setIsLogin(!isLogin);setError("");}} style={{background:"none",border:"none",color:"#2563eb",cursor:"pointer",fontSize:"13px",fontWeight:500}}>
              {isLogin ? "Register" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(()=>{
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
        <Route path="/" element={<Markets user={user} onLogout={handleLogout}/>}/>
        <Route path="/login" element={<Login onLogin={handleLogin}/>}/>
        <Route path="/my-predictions" element={<MyPredictions user={user}/>}/>
        <Route path="/admin" element={<Admin/>}/>
        <Route path="/events/:id" element={<EventDetail user={user}/>}/>
      </Routes>
    </BrowserRouter>
  );
}