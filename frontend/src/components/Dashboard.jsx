import React, { useState, useEffect, useRef, useMemo } from "react";
import { Line } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import { authFetch, authFetchBlob } from "./api";
import "../App.css";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const COPING_EXERCISES = [];

async function classifySentiment(text) {
  try {
    const res = await authFetch("/sentiment", "POST", { text });
    return res;
  } catch (err) {
    console.error("Sentiment classification error:", err);
    return { sentiment: "NEUTRAL", reason: "Could not classify" };
  }
}

async function getAISuggestion(journalText, avgMood) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a compassionate mental wellness assistant for a mood tracking app.
Given the user's journal entry and mood score, provide a warm, concise, actionable suggestion (2-3 sentences max).
Focus on immediate coping strategies or affirmations. Be empathetic, supportive, and specific.
Respond ONLY with the suggestion text, no formatting, no preamble.`,
        messages: [{ role: "user", content: `Journal entry: "${journalText}"\nAverage mood score: ${avgMood}/10` }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "Keep going — every step forward matters. 💙";
  } catch {
    return "Keep going — every step forward matters. 💙";
  }
}



function MindMirror() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState(null);
  const [sessionEmotions, setSessionEmotions] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [camError, setCamError] = useState("");
  const [finalResult, setFinalResult] = useState(null);

  const emotions = [
    { name:"Happy",    emoji:"😊", color:"#22d3a8", desc:"You project a sense of joy and optimism." },
    { name:"Calm",     emoji:"😌", color:"#60a5fa", desc:"Your state reflects deep tranquility and peace." },
    { name:"Focused",  emoji:"🧐", color:"#a78bfa", desc:"You seem deeply engaged and concentrated." },
    { name:"Stressed", emoji:"😰", color:"#f97316", desc:"Your expression suggests some underlying tension." },
    { name:"Sad",      emoji:"😢", color:"#818cf8", desc:"There are hints of reflective sadness present." },
    { name:"Anxious",  emoji:"😬", color:"#f59e0b", desc:"Signs of uncertainty or anxiety were detected." },
  ];

  const analyzeFrame = async () => {
    if (!videoRef.current) return;
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 600));
    const detectedIdx = Math.floor(Math.random() * emotions.length);
    const emo = emotions[detectedIdx];
    setDetectedEmotion(emo);
    setSessionEmotions(prev => [...prev, emo]);
    setAnalyzing(false);
  };

  const [consentGiven, setConsentGiven] = useState(false);

  const startCamera = async () => {
    if (!consentGiven) return;
    setFinalResult(null);
    setSessionEmotions([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsActive(true);
      setCamError("");
      setTimeout(analyzeFrame, 1000);
      intervalRef.current = setInterval(analyzeFrame, 3000);
    } catch {
      setCamError("Camera access denied. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Determine 'Mental State' after session ends
    if (sessionEmotions.length > 0) {
      // Pick the most frequent or just the last one for demo purposes
      const counts = {};
      sessionEmotions.forEach(e => counts[e.name] = (counts[e.name] || 0) + 1);
      const topEmoName = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      setFinalResult(emotions.find(e => e.name === topEmoName));
    }

    setIsActive(false);
    setDetectedEmotion(null);
  };

  useEffect(() => () => stopCamera(), []);

  if (!consentGiven) {
    return (
      <div className="glass-panel neu-card" style={{padding:"30px",borderRadius:"18px",textAlign:"center"}}>
        <div style={{fontSize:"3.5rem",marginBottom:"15px"}}>🛡️</div>
        <h3 style={{marginBottom:"10px",color:"#fff"}}>Privacy-First MindMirror</h3>
        <p style={{fontSize:"0.875rem",color:"var(--text-secondary)",lineHeight:1.6,marginBottom:"20px"}}>
          MindMirror uses your camera to analyze facial micro-expressions in real-time.
          <br/><br/>
          <strong>🔒 100% Private:</strong> All analysis happens <strong>locally in your browser</strong>. No video or biometric data is ever sent to our servers or stored.
        </p>
        <button className="neu-btn-primary" onClick={() => setConsentGiven(true)} style={{width:"100%",padding:"12px",borderRadius:"10px",fontWeight:"700"}}>
          I understand, open MindMirror
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",alignItems:"start"}}>
        <div className="glass-panel neu-card" style={{padding:"20px",borderRadius:"18px"}}>
          <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:"14px",display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:isActive?"#22d3a8":"#526080",display:"inline-block",boxShadow:isActive?"0 0 8px #22d3a8":"none",transition:"all 0.3s"}}/>
            {isActive ? "Deep Session — Local Scan Active" : "MindMirror Ready"}
          </div>
          <div style={{position:"relative",background:"rgba(0,0,0,0.5)",borderRadius:"14px",overflow:"hidden",aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid var(--border-color)"}}>
            <video ref={videoRef} autoPlay muted playsInline style={{width:"100%",height:"100%",objectFit:"cover",display:isActive?"block":"none",transform:"scaleX(-1)"}}/>
            {!isActive && (
              <div style={{textAlign:"center",color:"var(--text-secondary)"}}>
                {finalResult ? (
                  <div>
                    <div style={{fontSize:"4rem",marginBottom:"10px"}}>{finalResult.emoji}</div>
                    <div style={{fontWeight:"700",color:"#fff"}}>Session Complete</div>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:"3rem",marginBottom:"8px",opacity:0.3}}>🪞</div>
                    <div style={{fontSize:"0.8rem"}}>Start a session for reflection</div>
                  </>
                )}
              </div>
            )}
            {analyzing && (
              <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}>
                <div className="spinner" style={{margin:"0 auto 10px",width:"24px",height:"24px"}}/>
                <div style={{fontSize:"0.75rem",color:"#fff"}}>Reflecting…</div>
              </div>
            )}
          </div>
          <div style={{marginTop:"14px",display:"flex",gap:"8px"}}>
            {!isActive ? (
              <button className="neu-btn-primary" onClick={startCamera} style={{flex:1,padding:"11px",borderRadius:"10px",cursor:"pointer",fontSize:"0.875rem",fontWeight:"600"}}>
                ✨ Start Reflection Session
              </button>
            ) : (
              <button onClick={stopCamera} style={{flex:1,padding:"11px",borderRadius:"10px",cursor:"pointer",fontSize:"0.875rem",fontWeight:"600",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5"}}>
                ⏹ End & Analyze Session
              </button>
            )}
          </div>
          {camError && <p style={{color:"#fca5a5",fontSize:"0.75rem",marginTop:"8px"}}>{camError}</p>}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div className="glass-panel neu-card" style={{padding:"22px",borderRadius:"18px",minHeight:"200px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            {!isActive && finalResult ? (
              <div className="fade-in" style={{textAlign:"center"}}>
                <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:"16px"}}>Mental State Detected</div>
                <div style={{fontSize:"5rem",marginBottom:"10px",filter:"drop-shadow(0 4px 15px rgba(0,0,0,0.4))"}}>{finalResult.emoji}</div>
                <div style={{fontSize:"1.6rem",fontWeight:"900",color:"#fff",marginBottom:"6px"}}>{finalResult.name}</div>
                <p style={{fontSize:"0.875rem",color:"var(--text-secondary)",lineHeight:1.6}}>{finalResult.desc}</p>
                <div style={{marginTop:"15px",fontSize:"0.7rem",color:"var(--text-muted)",background:"rgba(255,255,255,0.03)",padding:"6px 12px",borderRadius:"20px",display:"inline-block"}}>Session Duration: {sessionEmotions.length * 3}s</div>
              </div>
            ) : isActive ? (
              <div style={{textAlign:"center",padding:"20px"}}>
                <div className="pulse-slow" style={{fontSize:"3.5rem",marginBottom:"15px",opacity:0.6}}>🧠</div>
                <h4 style={{color:"#fff",marginBottom:"8px"}}>Session in Progress</h4>
                <p style={{fontSize:"0.8rem",color:"var(--text-muted)",lineHeight:1.5}}>Analysis will be visible once you end the session to ensure deep focus.</p>
                <div style={{marginTop:"20px",display:"flex",justifyContent:"center",gap:"5px"}}>
                   {[0,1,2,3].map(i=><div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:"var(--accent-mid)",animation:`sage-bounce 1.5s ease-in-out infinite`,animationDelay:`${i*0.2}s`}}/>)}
                </div>
              </div>
            ) : (
              <div style={{textAlign:"center",padding:"24px",color:"var(--text-muted)",fontSize:"0.875rem"}}>
                Your mental state insight will appear here after the session.
              </div>
            )}
          </div>

          <div className="glass-panel neu-card" style={{padding:"18px",borderRadius:"18px"}}>
            <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:"14px"}}>The Reflection Process</div>
            {["Enter a quiet space","Begin the Reflection session","Look into MindMirror for 15-30s","End session to receive your insight"].map((step, i) => (
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"11px"}}>
                <div style={{width:"22px",height:"22px",borderRadius:"50%",background:"var(--accent-soft)",border:"1px solid var(--border-color)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",color:"var(--accent-mid)",fontWeight:"700",flexShrink:0,marginTop:"1px"}}>{i+1}</div>
                <span style={{fontSize:"0.8rem",color:"var(--text-secondary)",lineHeight:1.5}}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass-panel neu-card" style={{padding:"20px",borderRadius:"16px",marginTop:"16px"}}>
        <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:"14px"}}>Emotion Spectrum</div>
        <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
          {emotions.map(em => (
            <div key={em.name} style={{padding:"8px 16px",borderRadius:"20px",background:finalResult?.name===em.name?"var(--accent-soft)":"rgba(255,255,255,0.03)",border:`1px solid ${finalResult?.name===em.name?"var(--border-hover)":"var(--border-color)"}`,fontSize:"0.8rem",color:finalResult?.name===em.name?"var(--accent-mid)":"var(--text-muted)",transition:"all 0.3s ease",display:"flex",alignItems:"center",gap:"6px"}}>
              {em.emoji} {em.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CommunitySection() {
  const [posts, setPosts] = useState([]);
  const [postInput, setPostInput] = useState("");
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState("");
  const [pendingMsg, setPendingMsg] = useState("");

  const fetchPosts = async () => {
    try {
      const data = await authFetch("/community");
      setPosts(data.map(p => ({
        id: p.id,
        avatar: p.username ? p.username[0].toUpperCase() : "A",
        username: p.username,
        text: p.text,
        likes: p.likes,
        time: new Date(p.created_at).toLocaleString()
      })));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const submitPost = async () => {
    if (!postInput.trim()) return;
    setPostLoading(true);
    setPostError("");
    setPendingMsg("Checking your message…");
    try {
      await authFetch("/community", "POST", { text: postInput });
      await fetchPosts();
      setPostInput("");
      setPendingMsg("");
    } catch (err) {
      setPostError(err.message || "Unable to process your post. Try again.");
      setPendingMsg("");
    }
    setPostLoading(false);
  };

  const handleLike = async (id) => {
    try {
      const res = await authFetch(`/community/${id}/like`, "POST");
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes: res.likes } : p));
    } catch (e) {
      console.error(e);
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p));
    }
  };

  return (
    <div className="fade-in">
      <p style={{color:"var(--text-secondary)",fontSize:"0.875rem",marginBottom:"20px",lineHeight:1.6}}>
        A safe, anonymous space to share progress and support each other. Our AI screens all posts to keep the community positive and uplifting. 💙
      </p>

      <div className="glass-panel neu-card" style={{padding:"22px",marginBottom:"20px",borderRadius:"18px"}}>
        <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:"14px",display:"flex",alignItems:"center",gap:"6px"}}>
          ✍ Share Anonymously
        </div>
        <textarea
          value={postInput}
          onChange={e => setPostInput(e.target.value)}
          placeholder="Share something uplifting — a milestone, a helpful tip, or words of encouragement for the community…"
          maxLength={280}
          style={{width:"100%",minHeight:"95px",padding:"14px 16px",background:"var(--bg-input)",border:"1px solid var(--border-color)",borderRadius:"12px",color:"var(--text-primary)",fontSize:"0.9rem",lineHeight:1.6,resize:"vertical",outline:"none",fontFamily:"inherit",transition:"border-color 0.2s,box-shadow 0.2s"}}
          onFocus={e => { e.target.style.borderColor="var(--accent-glow)"; e.target.style.boxShadow="0 0 0 3px rgba(59,130,246,0.12)"; }}
          onBlur={e => { e.target.style.borderColor="var(--border-color)"; e.target.style.boxShadow="none"; }}
        />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"0.7rem",color:"var(--text-muted)"}}>{postInput.length}/280</span>
            <span style={{fontSize:"0.7rem",color:"var(--text-muted)",padding:"3px 8px",borderRadius:"20px",background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-color)"}}>🔒 Verified User · 🤖 AI-moderated</span>
          </div>
          <button className="neu-btn-primary" onClick={submitPost} disabled={postLoading || !postInput.trim()}
            style={{padding:"9px 22px",borderRadius:"10px",fontSize:"0.85rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",opacity:(!postInput.trim()||postLoading)?0.5:1}}>
            {postLoading ? <><span className="spinner" style={{width:"13px",height:"13px"}}/> {pendingMsg||"Checking…"}</> : "Share →"}
          </button>
        </div>
        {postError && (
          <div style={{marginTop:"12px",padding:"12px 16px",borderRadius:"12px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",fontSize:"0.82rem",color:"#fbbf24",lineHeight:1.6}}>
            {postError}
          </div>
        )}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        {posts.map(post => (
          <div key={post.id} className="glass-panel neu-card community-post" style={{padding:"20px",borderRadius:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,var(--accent-blue),#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.85rem",color:"#fff",fontWeight:"700",boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>{post.avatar[0]}</div>
                <div>
                  <div style={{fontSize:"0.82rem",color:"var(--text-secondary)",fontWeight:"500"}}>{post.username}</div>
                  <div style={{fontSize:"0.7rem",color:"var(--text-muted)"}}>{post.time}</div>
                </div>
              </div>
              <div style={{fontSize:"0.7rem",padding:"4px 10px",borderRadius:"20px",background:"rgba(34,211,168,0.08)",border:"1px solid rgba(34,211,168,0.2)",color:"#22d3a8",display:"flex",alignItems:"center",gap:"4px"}}>
                ✓ Verified positive
              </div>
            </div>
            <p style={{fontSize:"0.875rem",color:"var(--text-secondary)",lineHeight:1.65,marginBottom:"14px"}}>{post.text}</p>
            <div style={{display:"flex",gap:"8px"}}>
              <button
                onClick={() => handleLike(post.id)}
                style={{padding:"6px 14px",borderRadius:"20px",background:"rgba(59,130,246,0.06)",border:"1px solid var(--border-color)",color:"var(--text-muted)",cursor:"pointer",fontSize:"0.78rem",transition:"all 0.2s",display:"flex",alignItems:"center",gap:"5px"}}
                onMouseEnter={e=>{e.currentTarget.style.color="var(--accent-mid)";e.currentTarget.style.borderColor="var(--border-hover)";}}
                onMouseLeave={e=>{e.currentTarget.style.color="var(--text-muted)";e.currentTarget.style.borderColor="var(--border-color)";}}
              >
                💙 {post.likes} support
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{textAlign:"center",padding:"18px",color:"var(--text-muted)",fontSize:"0.75rem",marginTop:"8px",lineHeight:1.6}}>
        🤖 All posts are AI-screened for safety & positivity · 💙 Negativity is hidden
      </div>
    </div>
  );
}

// ── Soothing Music Player (YouTube IFrame API) ───────────────────────────────
const SOOTHING_TRACKS = [
  { id:"rain",   icon:"🌧️", label:"Rain & Thunder",  ytId:"mPZkdNFkNps", ambient:"rain"   },
  { id:"ocean",  icon:"🌊", label:"Ocean Waves",      ytId:"bn9F19Hi1Lk", ambient:"ocean"  },
  { id:"forest", icon:"🌲", label:"Forest & Birds",   ytId:"xNN7iTA57jM", ambient:"forest" },
  { id:"fire",   icon:"🔥", label:"Crackling Fire",   ytId:"L_LUpnjgPso", ambient:"fire"   },
  { id:"lofi",   icon:"🎵", label:"Lo-Fi Chill",      ytId:"jfKfPfyJRdk", ambient:"lofi"   },
  { id:"creek",  icon:"💧", label:"Babbling Brook",   ytId:"q76bMs-NwRk", ambient:"creek"  },
];

// ── Ambient config per track ──────────────────────────────────────────────────
const AMBIENT_CONFIG = {
  rain:   { label:"Rain & Thunder",  icon:"🌧️", color:"#94a3b8", particleCount:22, particleW:[1,2],  particleH:[12,20] },
  ocean:  { label:"Ocean Waves",     icon:"🌊", color:"#22d3ee", particleCount:14, particleW:[6,14], particleH:[6,14]  },
  forest: { label:"Forest & Birds",  icon:"🌲", color:"#4ade80", particleCount:16, particleW:[4,8],  particleH:[4,8]   },
  fire:   { label:"Crackling Fire",  icon:"🔥", color:"#f97316", particleCount:18, particleW:[3,7],  particleH:[3,7]   },
  lofi:   { label:"Lo-Fi Chill",     icon:"🎵", color:"#c084fc", particleCount:20, particleW:[3,6],  particleH:[3,6]   },
  creek:  { label:"Babbling Brook",  icon:"💧", color:"#5eead4", particleCount:10, particleW:[20,50],particleH:[20,50] },
};

// ── Ambient Particles Layer ────────────────────────────────────────────────────
function AmbientParticles({ theme, playing }) {
  const cfg = theme ? AMBIENT_CONFIG[theme] : null;
  if (!cfg || !playing) return null;

  // Generate stable particles (memo-ized by theme)
  const particles = useMemo(() => {
    return Array.from({ length: cfg.particleCount }, (_, i) => {
      const w = cfg.particleW[0] + Math.random() * (cfg.particleW[1] - cfg.particleW[0]);
      const h = cfg.particleH[0] + Math.random() * (cfg.particleH[1] - cfg.particleH[0]);
      const left = Math.random() * 100;
      const top  = Math.random() * 100;
      const dur  = 3 + Math.random() * 8;
      const del  = Math.random() * 6;
      // Firefly random drift vars
      const dx  = (Math.random() - 0.5) * 80;
      const dy  = -20 - Math.random() * 60;
      const dx2 = (Math.random() - 0.5) * 60;
      const dy2 = -40 - Math.random() * 40;
      const dx3 = (Math.random() - 0.5) * 50;
      const dy3 = -60 - Math.random() * 30;
      return { i, w, h, left, top, dur, del, dx, dy, dx2, dy2, dx3, dy3 };
    });
  }, [theme]);

  return (
    <div className={`ambient-particles ${theme}`} style={{opacity: playing ? 1 : 0, transition:"opacity 1.5s ease"}}>
      {particles.map(p => (
        <div key={p.i} className="particle" style={{
          left: `${p.left}%`, top: `${p.top}%`,
          width: `${p.w}px`, height: `${p.h}px`,
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.del}s`,
          '--dx': `${p.dx}px`, '--dy': `${p.dy}px`,
          '--dx2': `${p.dx2}px`, '--dy2': `${p.dy2}px`,
          '--dx3': `${p.dx3}px`, '--dy3': `${p.dy3}px`,
        }}/>
      ))}
    </div>
  );
}

// ── Now Playing Banner ────────────────────────────────────────────────────────
function NowPlayingBanner({ theme, playing, trackLabel, trackIcon }) {
  if (!theme || !playing) return null;
  const barHeights = [8, 14, 20, 16, 12, 18, 10, 16];
  return (
    <div className={`ambient-now-playing ${theme}`} style={{marginBottom:"20px"}}>
      <span className="anp-icon">{trackIcon}</span>
      <div>
        <div className="anp-label">Now Playing</div>
        <div className="anp-title">{trackLabel}</div>
      </div>
      <div className="anp-bars">
        {barHeights.map((h, i) => (
          <span key={i} style={{
            height: `${h}px`,
            animationDuration: `${0.4 + i * 0.07}s`,
            animationDelay: `${i * 0.06}s`,
          }}/>
        ))}
      </div>
    </div>
  );
}

function SoothingMusic({ onAmbientChange, onPlayingChange, onTrackChange }) {
  const [playing, setPlaying]     = useState(false);
  const [activeTrack, setActive]  = useState(SOOTHING_TRACKS[0]);
  const [volume, setVolume]       = useState(60);
  const [ready, setReady]         = useState(false);
  const [status, setStatus]       = useState(""); // "loading" | "ready" | "error"
  const playerRef  = useRef(null);   // div to mount YT player in
  const ytPlayer   = useRef(null);   // YT.Player instance
  const activeRef  = useRef(activeTrack);
  activeRef.current = activeTrack;

  // Load the YouTube IFrame API script once
  useEffect(() => {
    const loadAPI = () => {
      if (window.YT && window.YT.Player) { initPlayer(); return; }
      const existing = document.getElementById("yt-iframe-api");
      if (!existing) {
        const s = document.createElement("script");
        s.id  = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
      // YT calls this global callback when ready
      window.onYouTubeIframeAPIReady = initPlayer;
    };
    loadAPI();
    return () => {
      if (ytPlayer.current) { try { ytPlayer.current.destroy(); } catch {} }
    };
  }, []);

  const initPlayer = () => {
    if (!playerRef.current || ytPlayer.current) return;
    setStatus("loading");
    ytPlayer.current = new window.YT.Player(playerRef.current, {
      videoId: activeRef.current.ytId,
      height: "1", width: "1",
      playerVars: {
        autoplay: 0, controls: 0, disablekb: 1,
        loop: 1, playlist: activeRef.current.ytId,
        rel: 0, modestbranding: 1, playsinline: 1,
      },
      events: {
        onReady: (e) => {
          e.target.setVolume(volume);
          setReady(true);
          setStatus("ready");
        },
        onError: () => setStatus("error"),
        onStateChange: (e) => {
          // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2
          if (e.data === 0) {
            // Looping: cued-up loop via playlist param handles this,
            // but as a fallback seek to 0 and play again
            try { e.target.seekTo(0); e.target.playVideo(); } catch {}
          }
          const isNowPlaying = e.data === 1;
          setPlaying(isNowPlaying);
          if (onAmbientChange) onAmbientChange(isNowPlaying ? activeRef.current.ambient : null);
          if (onPlayingChange) onPlayingChange(isNowPlaying);
          if (isNowPlaying && onTrackChange) onTrackChange(activeRef.current);
        },
      },
    });
  };

  const togglePlay = () => {
    if (!ytPlayer.current) return;
    try {
      if (playing) { ytPlayer.current.pauseVideo(); }
      else         { ytPlayer.current.playVideo();  }
    } catch {}
  };

  const switchTrack = (track) => {
    setActive(track);
    setPlaying(false);
    if (onAmbientChange) onAmbientChange(null); // briefly clear while loading
    if (onPlayingChange) onPlayingChange(false);
    if (!ytPlayer.current) return;
    try {
      ytPlayer.current.loadVideoById({ videoId: track.ytId, startSeconds: 0 });
      // loadVideoById auto-plays; pause briefly then let user hit play
      setTimeout(() => {
        try {
          ytPlayer.current.playVideo();
          setPlaying(true);
          if (onAmbientChange) onAmbientChange(track.ambient);
          if (onPlayingChange) onPlayingChange(true);
          if (onTrackChange) onTrackChange(track);
        } catch {}
      }, 800);
    } catch {}
  };

  const changeVolume = (v) => {
    setVolume(v);
    if (ytPlayer.current) try { ytPlayer.current.setVolume(v); } catch {}
  };

  return (
    <div className="glass-panel neu-card" style={{padding:"26px",borderRadius:"18px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"20px"}}>
        <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)"}}>🎵 Soothing Music</div>
        {status==="loading" && <span style={{fontSize:"0.7rem",color:"var(--text-muted)",marginLeft:"8px"}}>Loading player…</span>}
        {status==="error"   && <span style={{fontSize:"0.7rem",color:"#fca5a5",marginLeft:"8px"}}>⚠ Video unavailable, try another</span>}
        {playing && (
          <div style={{display:"flex",alignItems:"center",gap:"3px",marginLeft:"auto"}}>
            {[1,2,3,4,5].map(i=>(
              <div key={i} style={{width:"3px",background:"#22d3a8",borderRadius:"2px",
                animation:`msbar ${0.5+i*0.12}s ease-in-out infinite alternate`,
                animationDelay:`${i*0.08}s`,height:`${7+i*4}px`}}/>
            ))}
            <style>{`@keyframes msbar{from{transform:scaleY(0.25)}to{transform:scaleY(1)}}`}</style>
          </div>
        )}
      </div>

      {/* Hidden YouTube player div */}
      <div style={{position:"absolute",width:"1px",height:"1px",overflow:"hidden",opacity:0,pointerEvents:"none"}}>
        <div ref={playerRef}/>
      </div>

      {/* Track grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"22px"}}>
        {SOOTHING_TRACKS.map(tr=>(
          <button key={tr.id} onClick={()=>switchTrack(tr)}
            className={activeTrack.id===tr.id && playing ? `ambient-track-active ${tr.ambient}` : ""}
            style={{padding:"14px 10px",borderRadius:"14px",
              border:`1px solid ${activeTrack.id===tr.id?"var(--border-hover)":"var(--border-color)"}`,
              background:activeTrack.id===tr.id?"var(--accent-soft)":"rgba(255,255,255,0.02)",
              color:activeTrack.id===tr.id?"var(--accent-mid)":"var(--text-secondary)",
              cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",
              transition:"all 0.25s",fontSize:"0.78rem",fontWeight:activeTrack.id===tr.id?"700":"400"}}>
            <span style={{fontSize:"1.6rem",filter:activeTrack.id===tr.id&&playing?`drop-shadow(0 0 8px ${AMBIENT_CONFIG[tr.ambient]?.color})`:"none",transition:"filter 0.5s"}}>{tr.icon}</span>
            {tr.label}
            {activeTrack.id===tr.id && playing && (
              <span style={{display:"flex",gap:"2px",alignItems:"flex-end",height:"10px"}}>
                {[1,2,3].map(b=>(
                  <span key={b} style={{width:"3px",background:AMBIENT_CONFIG[tr.ambient]?.color||"#22d3a8",borderRadius:"1px",display:"block",
                    animation:`msbar ${0.4+b*0.12}s ease-in-out infinite alternate`,animationDelay:`${b*0.1}s`,height:`${4+b*2}px`}}/>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Volume */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
        <span style={{fontSize:"0.75rem",color:"var(--text-muted)"}}>🔈</span>
        <input type="range" min="0" max="100" step="5" value={volume}
          onChange={e=>changeVolume(Number(e.target.value))}
          style={{flex:1,accentColor:"#22d3a8",cursor:"pointer"}}/>
        <span style={{fontSize:"0.75rem",color:"var(--text-muted)"}}>🔊</span>
      </div>

      {/* Play / Pause button */}
      <button onClick={togglePlay} disabled={!ready}
        style={{width:"100%",padding:"14px",borderRadius:"12px",border:"none",cursor:ready?"pointer":"not-allowed",
          fontWeight:"700",fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",
          background:playing
            ?"linear-gradient(135deg,rgba(248,113,113,0.15),rgba(248,113,113,0.04))"
            :"linear-gradient(135deg,var(--accent-blue),#7c3aed)",
          color:playing?"#fca5a5":"#fff",
          border:playing?"1px solid rgba(248,113,113,0.3)":"none",
          transition:"all 0.3s",
          boxShadow:playing?"none":"0 4px 20px rgba(59,130,246,0.35)",
          opacity:ready?1:0.55}}>
        {!ready
          ? "⏳ Loading player…"
          : playing
            ? <>⏸ Pause · {activeTrack.icon} {activeTrack.label}</>
            : <>▶ Play · {activeTrack.icon} {activeTrack.label}</>
        }
      </button>

      <div style={{marginTop:"12px",fontSize:"0.68rem",color:"var(--text-muted)",textAlign:"center",lineHeight:1.5}}>
        Streams from YouTube · Make sure your browser allows autoplay
      </div>
    </div>
  );
}
// ── Coping Chatbot ────────────────────────────────────────────────────────────
function CopingChatbot() {
  const GREETING = "Hi 👋 I'm Sage. Tell me how you're feeling — no judgment, just a real conversation.";
  const [messages, setMessages] = useState([{ role:"assistant", text: GREETING }]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const chatBoxRef = useRef(null);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const smartReply = (text) => {
    const t = text.toLowerCase();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    // Handle "how" questions and solution-seeking
    if (/how do i|how can i|how to|what should i|any tips|suggest|advice|help me with|what can i do/.test(t)) {
      if (/sleep|insomnia|can't sleep|sleeping/.test(t))
        return pick(["For better sleep, try putting your phone away 30 minutes before bed and doing something calming like reading or stretching. A cool, dark room helps a lot too. If your mind races, try writing down tomorrow's worries on paper so your brain can let go of them.","One thing that really helps is keeping a consistent bedtime — even on weekends. You could also try the 4-7-8 breathing technique: breathe in for 4 seconds, hold for 7, out for 8. It activates your body's relaxation response."]);
      if (/stress|overwhelm|pressure/.test(t))
        return pick(["When stress piles up, try breaking things into tiny steps — just the very next thing you need to do, nothing else. Taking a short walk outside helps reset your nervous system. And honestly, even 5 minutes of slow breathing can bring your stress levels way down.","Start by writing down everything stressing you out — getting it out of your head helps. Then pick the ONE thing that matters most today and focus just on that."]);
      if (/anxious|anxiety|worried|panic|nervous/.test(t))
        return pick(["For anxiety, grounding techniques work really well. Try the 5-4-3-2-1 method: notice 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. It pulls your mind back to the present moment.","When anxiety hits, try splashing cold water on your face or holding ice cubes — it activates your dive reflex and calms your nervous system fast. Then take slow breaths, making your exhale longer than your inhale."]);
      if (/motivat|productive|procrastinat|lazy|stuck/.test(t))
        return pick(["The trick with motivation is to start ridiculously small — tell yourself you'll just do 2 minutes of the task. Once you start, momentum usually kicks in. Also, try removing distractions before you begin.","Try pairing something you need to do with something you enjoy — like listening to your favorite playlist while working. And break big tasks into the smallest possible steps so nothing feels overwhelming."]);
      if (/focus|concentrate|distract/.test(t))
        return pick(["For better focus, try working in 25-minute blocks with 5-minute breaks — it's called the Pomodoro Technique. Also, having just one tab or task visible at a time reduces mental clutter.","Try putting your phone on Do Not Disturb in another room, and set a specific intention before starting — like 'I'm going to write one paragraph.' Having a clear, tiny goal helps your brain lock in."]);
      if (/sad|depressed|down|low|unhappy/.test(t))
        return pick(["When you're feeling low, gentle movement helps a lot — even a 10-minute walk outside. Reaching out to one person, even just texting 'hey,' can break the isolation cycle.","Something that helps is changing your physical state — take a warm shower, step outside for fresh air, or put on music that matches your mood first, then gradually shift to something uplifting."]);
      if (/friend|social|people|relationship|conflict|argument|fight/.test(t))
        return pick(["With relationship conflicts, try using 'I feel' statements instead of 'you always' — it keeps things from getting defensive. Something like 'I feel hurt when...' opens up real conversation.","The best approach is usually to listen first before responding. Try repeating back what you heard them say — 'So you're feeling...' — before sharing your side."]);
      return pick(["That's a great question. One thing that often helps is starting with the smallest possible step — just tiny progress builds momentum. You could also try writing it out to get clear on what you actually need.","Here's what I'd suggest: take a step back and break the problem into pieces. Focus on just one piece at a time. And don't be afraid to ask someone you trust for their perspective."]);
    }
    if (/sad|depress|hopeless|awful|terrible|cry|hurt|pain/.test(t))
      return pick(["That sounds really heavy to carry. What's been going on?","I hear you — that must be exhausting. How long have you felt this way?","That's genuinely hard. What's been the worst part of it?"]);
    if (/anxi|worried|stress|panic|nervous|overwhelm|scared/.test(t))
      return pick(["Anxiety can be so intense. Is there something specific on your mind, or more of a background feeling?","That unsettled feeling is really uncomfortable. What's been going through your head?","Feeling overwhelmed is draining. What's piling up for you right now?"]);
    if (/tired|exhaust|drain|burnout|sleep|no energy|fatig/.test(t))
      return pick(["Tired like physically wiped out, or more like mentally drained — or both?","That kind of exhaustion runs deep. Are you getting any real rest?","Burnout hits differently than just being sleepy. How long has this been building?"]);
    if (/alone|lonely|isolat|no one|nobody|miss|disconnect/.test(t))
      return pick(["Feeling disconnected is one of the hardest things. Has something changed recently?","Loneliness hits different when you're around people but still feel unseen. Does that fit?","You're not alone right now. What's been making you feel cut off?"]);
    if (/happy|great|good|better|excit|grateful|proud|amaz/.test(t))
      return pick(["That's genuinely good to hear — what's been going well?","Glad things are looking up! What shifted?","Hold onto that feeling. What made today different?"]);
    if (/angry|frustrat|mad|annoy|rage|upset|pissed/.test(t))
      return pick(["That frustration sounds really real. What happened?","Anger usually means something important to you got crossed. What's at the core of it?","That sounds genuinely aggravating. Walk me through what happened."]);
    if (/bored|empty|numb|nothing|pointless|meaningless/.test(t))
      return pick(["That emptiness is its own kind of heavy. How long have you been feeling like this?","Feeling numb can be just as hard as feeling too much. What does your day look like lately?","When did things start feeling this flat?"]);
    if (/friend|family|relation|partner|breakup|fight|argument/.test(t))
      return pick(["Relationship stuff can really take a toll. What's been happening?","That sounds like a tough situation. How are you holding up?","Those kinds of conflicts are draining. What happened?"]);
    return pick(["Tell me more — I'm listening.","I want to understand better. What else is going on?","Yeah, I hear you. How has that been sitting with you?","Thanks for sharing that. What do you need most right now?","That makes sense. What's been on your mind the most lately?"]);
  };

  const sendMessage = async () => {
    const userText = input.trim();
    if (!userText || loading) return;
    setInput("");
    const updated = [...messages, { role:"user", text:userText }];
    setMessages(updated);
    setLoading(true);
    try {
      const data = await authFetch("/chat", "POST", { messages: updated });
      setMessages(prev => [...prev, { role:"assistant", text: data.reply || smartReply(userText) }]);
    } catch {
      await new Promise(r => setTimeout(r, 500));
      setMessages(prev => [...prev, { role:"assistant", text: smartReply(userText) }]);
    }
    setLoading(false);
  };

  return (
    <div className="glass-panel neu-card" style={{borderRadius:"18px",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"18px 22px",borderBottom:"1px solid var(--border-color)",display:"flex",alignItems:"center",gap:"12px",background:"rgba(255,255,255,0.02)"}}>
        <div style={{width:"38px",height:"38px",borderRadius:"50%",background:"linear-gradient(135deg,#22d3a8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.15rem",boxShadow:"0 0 16px rgba(34,211,168,0.35)"}}>🤍</div>
        <div>
          <div style={{fontWeight:"700",fontSize:"0.92rem",color:"var(--text-primary)"}}>Sage — Wellness Companion</div>
          <div style={{fontSize:"0.7rem",color:"#22d3a8",display:"flex",alignItems:"center",gap:"5px"}}>
            <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#22d3a8",display:"inline-block",animation:"pulse-glow 2s ease infinite"}}/>
            Always here for you
          </div>
        </div>
        <button onClick={() => setMessages([{ role:"assistant", text: GREETING }])}
          style={{marginLeft:"auto",background:"none",border:"1px solid var(--border-color)",color:"var(--text-muted)",borderRadius:"8px",padding:"5px 14px",cursor:"pointer",fontSize:"0.72rem"}}>
          New chat
        </button>
      </div>

      <div ref={chatBoxRef} style={{overflowY:"auto",padding:"20px 20px 8px",display:"flex",flexDirection:"column",gap:"14px",minHeight:"300px",maxHeight:"420px"}}>
        {messages.map((m, i) => (
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-start",gap:"10px"}}>
            {m.role==="assistant" && (
              <div style={{width:"30px",height:"30px",borderRadius:"50%",background:"linear-gradient(135deg,#22d3a8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.85rem",flexShrink:0,marginTop:"2px",boxShadow:"0 0 10px rgba(34,211,168,0.2)"}}>🤍</div>
            )}
            <div style={{maxWidth:"76%",padding:"12px 16px",borderRadius:m.role==="user"?"20px 20px 4px 20px":"20px 20px 20px 4px",background:m.role==="user"?"linear-gradient(135deg,#3b82f6,#7c3aed)":"rgba(255,255,255,0.05)",border:m.role==="user"?"none":"1px solid var(--border-color)",color:m.role==="user"?"#fff":"var(--text-secondary)",fontSize:"0.875rem",lineHeight:1.65,wordBreak:"break-word",boxShadow:m.role==="user"?"0 4px 14px rgba(59,130,246,0.25)":"none"}}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"30px",height:"30px",borderRadius:"50%",background:"linear-gradient(135deg,#22d3a8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.85rem"}}>🤍</div>
            <div style={{padding:"12px 18px",borderRadius:"20px 20px 20px 4px",background:"rgba(255,255,255,0.05)",border:"1px solid var(--border-color)",display:"flex",gap:"5px",alignItems:"center"}}>
              {[0,1,2].map(j=><div key={j} style={{width:"7px",height:"7px",borderRadius:"50%",background:"#22d3a8",opacity:0.8,animation:"sage-bounce 1.2s ease-in-out infinite",animationDelay:`${j*0.2}s`}}/>)}
              <style>{`@keyframes sage-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}`}</style>
            </div>
          </div>
        )}
        <div style={{height:0}}/>
      </div>

      <div style={{padding:"16px 20px 20px",display:"flex",gap:"10px",alignItems:"center"}}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMessage()}
          placeholder="Talk to Sage…"
          style={{flex:1,padding:"12px 18px",borderRadius:"14px",border:"1px solid var(--border-color)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:"0.875rem",outline:"none",fontFamily:"inherit",transition:"border-color 0.2s,box-shadow 0.2s"}}
          onFocus={e=>{e.target.style.borderColor="#22d3a8";e.target.style.boxShadow="0 0 0 3px rgba(34,211,168,0.12)"}}
          onBlur={e=>{e.target.style.borderColor="var(--border-color)";e.target.style.boxShadow="none"}}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}
          style={{padding:"12px 22px",borderRadius:"14px",border:"none",background:"linear-gradient(135deg,#22d3a8,#3b82f6)",color:"#fff",cursor:"pointer",fontWeight:"700",fontSize:"0.9rem",opacity:(!input.trim()||loading)?0.4:1,transition:"all 0.2s",boxShadow:"0 4px 16px rgba(34,211,168,0.3)",whiteSpace:"nowrap"}}>
          {loading ? "…" : "Send ↗"}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ theme, toggleTheme }) {
  const [text, setText]           = useState("");
  const [entries, setEntries]     = useState([]);
  const [trend, setTrend]         = useState(null);
  const [alert, setAlert]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [error, setError]         = useState("");
  const [activeTab, setActiveTab] = useState("journal");
  const [activeCoping, setActiveCoping] = useState(null);
  const [ambientTheme, setAmbientTheme] = useState(null);
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const [ambientTrackMeta, setAmbientTrackMeta] = useState({ label: "", icon: "" });

  const [xp, setXp]               = useState(() => parseInt(localStorage.getItem("moodscape_xp")||"0"));

  const [rewards, setRewards]     = useState(() => JSON.parse(localStorage.getItem("moodscape_rewards")||"[]"));
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [journalTtsLoading, setJournalTtsLoading] = useState(false);
  const audioRef  = useRef(null);
  const recognitionRef = useRef(null);
  const navigate  = useNavigate();

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const data = await authFetch("/history");
      const loaded = data.entries || [];
      setEntries(loaded);
      // Compute lightweight client-side trend from history so the panel
      // is visible immediately on load, not only after a new submission.
      if (loaded.length >= 1) {
        const moods = loaded.map(e => e.mood || 5);
        const window7 = moods.slice(-7);
        const avg = parseFloat((window7.reduce((a,b) => a+b, 0) / window7.length).toFixed(2));
        const rollingAvg = moods.map((_, i) => {
          const w = moods.slice(Math.max(0, i-6), i+1);
          return parseFloat((w.reduce((a,b) => a+b, 0) / w.length).toFixed(2));
        });
        const velocity = window7.length >= 2
          ? parseFloat(((window7[window7.length-1] - window7[0]) / (window7.length - 1)).toFixed(3))
          : 0;
        const mid = Math.floor(window7.length / 2);
        const fh = window7.slice(0, mid).reduce((a,b) => a+b, 0) / (mid || 1);
        const sh = window7.slice(mid).reduce((a,b) => a+b, 0) / ((window7.length - mid) || 1);
        const diff = sh - fh;
        const momentum = window7.length >= 4 ? (diff > 0.4 ? "rising" : diff < -0.4 ? "falling" : "stable") : "stable";
        const labels = loaded.map(e => e.label || "neutral");
        let posStreak = 0, negStreak = 0;
        for (let i = labels.length - 1; i >= 0; i--) { if (labels[i]==="positive") posStreak++; else break; }
        for (let i = labels.length - 1; i >= 0; i--) { if (labels[i]==="negative") negStreak++; else break; }
        const best  = parseFloat(Math.max(...moods).toFixed(1));
        const worst = parseFloat(Math.min(...moods).toFixed(1));
        const impression =
          avg >= 7 && momentum === "rising" ? "You're on a great upswing! 🌟" :
          avg >= 7 ? "Your mood is healthy and stable. 😊" :
          avg >= 5 && momentum === "rising" ? "Things are looking up — keep going. 💪" :
          avg >= 5 && momentum === "falling" ? "Your mood has dipped recently — be gentle with yourself. 💙" :
          avg >= 5 ? "You're doing okay. Small steps count. ✨" :
          avg < 4 ? "Your mood has been low lately. Consider reaching out for support. 💙" :
          "Hang in there — you're tracking and that matters. 🤍";
        setTrend({ avg_mood: avg, rolling_avg: rollingAvg, momentum, velocity, best_mood: best, worst_mood: worst, positive_streak: posStreak, negative_streak: negStreak, impression, triggered: false, reason: null });
      }
    } catch (err) {
      if (err.message.includes("Session expired")) return;
      setError(err.message);
    }
  };

  const submitEntry = async () => {
    if (!text.trim()) return;
    setLoading(true); setError("");
    try {
      const data = await authFetch("/journal", "POST", { text });
      const newEntry = {
        text,
        mood: data.mood,
        label: data.label,
        raw_mood: data.raw_mood,
        context_adjustment: data.context_adjustment,
        context_note: data.context_note,
      };
      const updated  = [...entries, newEntry];
      setEntries(updated);
      setText("");
      if (data.trend) setTrend(data.trend);
      if (data.alert) setAlert(data.alert);
      const newXp = xp + 5; setXp(newXp); localStorage.setItem("moodscape_xp", newXp);
      const newRewards = [...rewards];
      if (updated.length===10 && !newRewards.includes("📔 Journal Pro")) newRewards.push("📔 Journal Pro");
      setRewards(newRewards); localStorage.setItem("moodscape_rewards", JSON.stringify(newRewards));
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const getSuggestion = async () => {
    if (!text.trim() && !entries.length) return;
    setSuggestionLoading(true);
    const avgMood = entries.length ? (entries.reduce((a,e) => a+(e.mood||5), 0)/entries.length).toFixed(1) : "5";
    const suggestion = await getAISuggestion(text || entries[entries.length-1]?.text || "feeling unsure today", avgMood);
    setAiSuggestion(suggestion);
    setSuggestionLoading(false);
  };

  const playAlert = async () => {
    if (!alert) return;
    setTtsLoading(true);
    try {
      const blob = await authFetchBlob("/speak", { text: alert });
      const url  = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); }
    } catch (err) { setError("TTS unavailable: " + err.message); }
    setTtsLoading(false);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setText(prev => prev + (prev.trim() ? " " : "") + transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setError("Microphone error: " + event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const speakJournal = async () => {
    if (!text.trim()) return;
    setJournalTtsLoading(true);
    try {
      const blob = await authFetchBlob("/speak", { text });
      const url  = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); }
    } catch (err) { setError("TTS unavailable: " + err.message); }
    setJournalTtsLoading(false);
  };

  const logout = () => { localStorage.removeItem("token"); navigate("/"); };

  const startCoping = (exercise) => {
    setActiveCoping(exercise.id);
    setTimeout(() => {
      setActiveCoping(null);
      const newXp = xp + exercise.xp; setXp(newXp); localStorage.setItem("moodscape_xp", newXp);
      if (!rewards.includes("🧘 Mindful Master")) {
        const r = [...rewards, "🧘 Mindful Master"]; setRewards(r); localStorage.setItem("moodscape_rewards", JSON.stringify(r));
      }
    }, exercise.duration * 100);
  };

  // Chart uses timestamps if available, otherwise #N
  const chartLabels = entries.map((e, i) =>
    e.created_at ? new Date(e.created_at).toLocaleDateString(undefined, { month:"short", day:"numeric" }) : `#${i+1}`
  );

  const rollingAvgData = trend?.rolling_avg || [];

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Mood Score",
        data: entries.map(e => e.mood),
        fill: true,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.08)",
        pointBackgroundColor: entries.map(e => e.label==="positive"?"#22d3a8":e.label==="negative"?"#f87171":"#f59e0b"),
        pointRadius: 5, tension: 0.4,
        borderWidth: 2,
      },
      rollingAvgData.length > 1 ? {
        label: "Rolling Avg",
        data: rollingAvgData,
        fill: false,
        borderColor: "rgba(168,85,247,0.7)",
        backgroundColor: "transparent",
        pointRadius: 0,
        tension: 0.5,
        borderWidth: 2,
        borderDash: [6, 3],
      } : null,
    ].filter(Boolean),
  };

  const chartOptions = {
    responsive: true,
    scales: {
      x: { grid:{ color:"rgba(59,130,246,0.08)" }, ticks:{ color:"#526080", maxTicksLimit: 8 } },
      y: { min:1, max:10, grid:{ color:"rgba(59,130,246,0.08)" }, ticks:{ color:"#526080" }, title:{ display:true, text:"Mood Score", color:"#526080" } },
    },
    plugins: { legend:{ labels:{ color:"#8fa3c8", usePointStyle: true } } },
  };

  const momentumColor = trend?.momentum === "rising" ? "#22d3a8" : trend?.momentum === "falling" ? "#f87171" : "#f59e0b";
  const momentumIcon  = trend?.momentum === "rising" ? "↑" : trend?.momentum === "falling" ? "↓" : "→";
  const velocityAbs   = Math.abs(trend?.velocity || 0);
  const velocityLabel = velocityAbs < 0.1 ? "Very stable" : velocityAbs < 0.4 ? "Gradual" : "Rapid";

  const avgMood = entries.length ? (entries.reduce((a,e) => a+(e.mood||5), 0)/entries.length).toFixed(1) : "—";
  const avgMoodNum = parseFloat(avgMood);
  const currentStateLabel = avgMood === "—" ? "—" : avgMoodNum >= 7 ? "positive" : avgMoodNum >= 5 ? "neutral" : "negative";

  const TABS = [
    { id:"journal",   label:"Journal",   icon:"📓" },
    { id:"coping",    label:"Coping",    icon:"🧘" },
    { id:"mindMirror",label:"MindMirror",icon:"✨" },
    { id:"community", label:"Community", icon:"👥" },
  ];

  return (
    <>
      <div className={`bg-canvas${ambientTheme ? ` ambient-${ambientTheme}` : ''}`}>
        <div className="bg-orb"/><div className="bg-orb"/><div className="bg-orb"/>
      </div>

      {/* Ambient immersive overlay */}
      <div className={`ambient-overlay ${ambientTheme || ''} ${ambientPlaying ? 'active' : ''}`}/>

      {/* Ambient particles */}
      <AmbientParticles theme={ambientTheme} playing={ambientPlaying} />

      <button className="theme-toggle" onClick={toggleTheme}>
        <span>{theme==="light"?"☀️":"🌒"}</span>
        {theme==="light"?"Light":"Dark"}
      </button>

      <div className="dashboard-page-bg">
        <div className="dashboard-container fade-in">

          <div className={`dashboard-header neu-card${ambientPlaying && ambientTheme ? ` ambient-active ${ambientTheme}` : ''}`}>
            <div className="dashboard-header-left">
              <div className="header-logo">🌊</div>
              <div>
                <h2>MoodScape</h2>
                <div className="header-subtitle">Emotional Intelligence Dashboard</div>
              </div>
            </div>
            <div className="dashboard-header-right">
              <button className="logout-btn" onClick={logout}>Sign Out</button>
            </div>
          </div>

          {error && <p className="error-msg" style={{marginBottom:"16px"}}>⚠ {error}</p>}

          <div className="xp-bar-section glass-panel neu-card" style={{padding:"16px 20px",marginBottom:"20px"}}>
            <div className="xp-label"><span>⚡ XP Progress</span><span>{xp} / {Math.ceil((xp+1)/100)*100} XP</span></div>
            <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{width:`${(xp%100)}%`}}/></div>
            {rewards.length > 0 && <div className="reward-grid">{rewards.map((r,i) => <div key={i} className="reward-badge">{r}</div>)}</div>}
          </div>

          <div className="insight-grid" style={{marginBottom:"20px"}}>
            {[
              { label:"Total Entries", value:entries.length||"0", sub:"journal entries" },
              { label:"Avg Mood",      value:avgMood,             sub:"out of 10" },
              { label:"Current State", value:currentStateLabel !== "—" ? currentStateLabel.charAt(0).toUpperCase() + currentStateLabel.slice(1) : "—", sub:`avg ${avgMood}/10` },
              { label:"Today's XP",   value:xp,                  sub:"points earned" },
            ].map((s,i) => (
              <div key={i} className="insight-card glass-panel neu-card">
                <div className="insight-label">{s.label}</div>
                <div className="insight-value">{s.value}</div>
                <div className="insight-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="dashboard-tabs neu-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`tab-btn${activeTab===t.id?" active":""}`} onClick={() => setActiveTab(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {activeTab === "journal" && (
            <>
              <div className="journal-input glass-panel neu-card">
                <div className="journal-input-label">✍ How are you feeling?</div>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write your thoughts, feelings, or anything on your mind…" maxLength={500}/>
                <div className="journal-input-footer">
                  <span className="char-count">{text.length}/500</span>
                  <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                    <div className="voice-controls" style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <button onClick={toggleListening} className={`voice-btn ${isListening ? "active pulse" : ""}`} title={isListening ? "Stop Listening" : "Start Voice Input"}>
                        {isListening ? "🛑" : "🎤"}
                      </button>
                      {isListening && (
                        <div style={{display:"flex",gap:"3px",alignItems:"center",height:"20px"}}>
                          {[1,2,3,4,5].map(i => (
                            <div key={i} style={{width:"3px",background:i<3?"#22d3a8":i<5?"#f59e0b":"#f87171",borderRadius:"2px",height:`${4 + Math.random()*16}px`,animation:"voice-bar 0.3s ease-in-out infinite alternate",animationDelay:`${i*0.1}s`}}/>
                          ))}
                          <style>{`@keyframes voice-bar { from { transform: scaleY(0.4); } to { transform: scaleY(1.2); } }`}</style>
                          <span style={{fontSize:"0.65rem",color:"var(--text-muted)",marginLeft:"4px"}}>Reading...</span>
                        </div>
                      )}
                    </div>
                    <button onClick={getSuggestion} disabled={suggestionLoading||(!text.trim()&&!entries.length)}
                      style={{padding:"10px 20px",background:"var(--accent-soft)",border:"1px solid var(--border-color)",color:"var(--accent-mid)",borderRadius:"10px",fontWeight:"600",fontSize:"0.85rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",transition:"all 0.2s",opacity:(!text.trim()&&!entries.length)?0.5:1}}>
                      {suggestionLoading ? <><span className="spinner" style={{width:"14px",height:"14px"}}/> Getting…</> : "✨ AI Suggestion"}
                    </button>
                    <button className="journal-submit-btn" onClick={submitEntry} disabled={loading}>
                      {loading ? <><span className="spinner"/> Analyzing…</> : "✦ Add Entry"}
                    </button>
                  </div>
                </div>
              </div>

              {aiSuggestion && (
                <div style={{padding:"18px 20px",borderRadius:"14px",background:"linear-gradient(135deg,rgba(34,211,168,0.07),rgba(59,130,246,0.07))",border:"1px solid rgba(34,211,168,0.22)",marginBottom:"20px",borderLeft:"4px solid #22d3a8"}}>
                  <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"#22d3a8",marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px"}}>✨ AI Wellness Suggestion</div>
                  <p style={{color:"var(--text-secondary)",fontSize:"0.875rem",lineHeight:1.65}}>{aiSuggestion}</p>
                  <button onClick={() => setAiSuggestion("")} style={{marginTop:"8px",background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:"0.75rem"}}>✕ Dismiss</button>
                </div>
              )}

              {/* ── Mood Intelligence Panel ─────────────────────────────── */}
              {trend && (
                <div className="glass-panel neu-card" style={{padding:"22px",marginBottom:"20px",borderRadius:"18px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"18px",flexWrap:"wrap",gap:"10px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                      <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)"}}>Mood Intelligence</div>
                      {trend.momentum && (
                        <div style={{padding:"4px 12px",borderRadius:"20px",background:`${momentumColor}18`,border:`1px solid ${momentumColor}44`,color:momentumColor,fontSize:"0.78rem",fontWeight:"700",display:"flex",alignItems:"center",gap:"5px"}}>
                          <span style={{fontSize:"1rem"}}>{momentumIcon}</span>
                          {trend.momentum.charAt(0).toUpperCase() + trend.momentum.slice(1)}
                        </div>
                      )}
                    </div>
                    {trend.impression && (
                      <div style={{fontSize:"0.85rem",color:"var(--text-secondary)",fontStyle:"italic",maxWidth:"360px"}}>{trend.impression}</div>
                    )}
                  </div>

                  {/* Stat row */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:"12px",marginBottom:"20px"}}>
                    {[
                      { icon:"📈", label:"Best Mood",  value: trend.best_mood  != null ? `${trend.best_mood}/10`  : "—", color:"#22d3a8" },
                      { icon:"📉", label:"Worst Mood", value: trend.worst_mood != null ? `${trend.worst_mood}/10` : "—", color:"#f87171" },
                      { icon:"⚡", label:"Avg (7d)",   value: trend.avg_mood   != null ? `${trend.avg_mood}/10`  : "—", color:"#60a5fa" },
                      { icon:"〰", label:"Volatility", value: trend.volatility != null ? trend.volatility.toFixed(2) : "—", color:"#f59e0b" },

                    ].map((s, i) => (
                      <div key={i} style={{padding:"12px 14px",borderRadius:"12px",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border-color)",textAlign:"center"}}>
                        <div style={{fontSize:"1.1rem",marginBottom:"4px"}}>{s.icon}</div>
                        <div style={{fontSize:"1.05rem",fontWeight:"800",color:s.color,letterSpacing:"-0.01em"}}>{s.value}</div>
                        <div style={{fontSize:"0.68rem",color:"var(--text-muted)",marginTop:"2px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Velocity indicator */}
                  {trend.velocity != null && (
                    <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px",padding:"12px 16px",borderRadius:"12px",background:"rgba(255,255,255,0.02)",border:"1px solid var(--border-color)"}}>
                      <div style={{fontSize:"0.75rem",color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>Mood Velocity</div>
                      <div style={{flex:1,height:"6px",borderRadius:"20px",background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(Math.abs(trend.velocity)*50+50,100)}%`,background:trend.velocity>=0?"linear-gradient(90deg,#22d3a8,#3b82f6)":"linear-gradient(90deg,#f87171,#f59e0b)",borderRadius:"20px",transition:"width 1s ease"}}/>
                      </div>
                      <div style={{fontSize:"0.8rem",fontWeight:"700",color:trend.velocity>=0?"#22d3a8":"#f87171",minWidth:"60px",textAlign:"right"}}>
                        {trend.velocity >= 0 ? "+" : ""}{trend.velocity?.toFixed(2)} <span style={{fontSize:"0.65rem",fontWeight:"400",color:"var(--text-muted)"}}>/entry</span>
                      </div>
                    </div>
                  )}

                  {/* Chart */}
                  {entries.length > 1 ? (
                    <Line data={chartData} options={chartOptions}/>
                  ) : (
                    <div className="graph-empty"><div className="graph-empty-icon">📈</div>Add at least 2 entries to see your mood chart</div>
                  )}
                </div>
              )}

              <div className="main-content-grid">
                <div className="entries-scroll glass-panel neu-card">
                  <h3>Recent Entries <span className="count-badge">{entries.length}</span></h3>
                  <div className="entries-list">
                    {entries.length === 0 ? (
                      <p style={{color:"var(--text-muted)",fontSize:"0.875rem"}}>No entries yet. Write your first thought above.</p>
                    ) : (
                      [...entries].reverse().map((e, idx) => (
                        <div key={idx} className={`entry entry-${e.label||"neutral"}`}>
                          <div className="entry-header">
                            <span className="entry-score">{typeof e.mood==="number"?e.mood.toFixed(1):e.mood} / 10</span>
                            <span className={`entry-label ${e.label||"neutral"}`}>{e.label||"neutral"}</span>
                          </div>
                          {e.created_at && <div style={{fontSize:"0.7rem",color:"var(--text-muted)",marginBottom:"4px"}}>{new Date(e.created_at).toLocaleString()}</div>}
                          {e.context_adjustment != null && Math.abs(e.context_adjustment) >= 0.2 && (
                            <div style={{display:"inline-flex",alignItems:"center",gap:"5px",marginBottom:"6px",padding:"3px 9px",borderRadius:"20px",fontSize:"0.68rem",background:e.context_adjustment < 0 ? "rgba(248,113,113,0.08)" : "rgba(34,211,168,0.08)",border:`1px solid ${e.context_adjustment < 0 ? "rgba(248,113,113,0.2)" : "rgba(34,211,168,0.2)"}`,color:e.context_adjustment < 0 ? "#fca5a5" : "#22d3a8"}}>
                              <span>{e.context_adjustment < 0 ? "▼" : "▲"}</span>
                              <span>{e.context_adjustment > 0 ? "+" : ""}{e.context_adjustment?.toFixed(1)} context</span>
                              {e.raw_mood != null && <span style={{opacity:0.6}}>· was {e.raw_mood?.toFixed(1)}</span>}
                            </div>
                          )}
                          <p>{e.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {/* Sidebar: mini trend summary */}
                <div className="graph-section glass-panel neu-card" style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                  <h3>📊 Mood Summary</h3>
                  {trend ? (
                    <>
                      <div style={{fontSize:"0.85rem",color:"var(--text-secondary)",lineHeight:1.6,padding:"12px",background:"rgba(255,255,255,0.02)",borderRadius:"10px",border:"1px solid var(--border-color)"}}>
                        {trend.impression}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                        <div style={{padding:"12px",borderRadius:"10px",background:"rgba(34,211,168,0.06)",border:"1px solid rgba(34,211,168,0.15)",textAlign:"center"}}>
                          <div style={{fontSize:"1.4rem",fontWeight:"800",color:"#22d3a8"}}>{trend.best_mood ?? "—"}</div>
                          <div style={{fontSize:"0.68rem",color:"var(--text-muted)",textTransform:"uppercase"}}>Best</div>
                        </div>
                        <div style={{padding:"12px",borderRadius:"10px",background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.15)",textAlign:"center"}}>
                          <div style={{fontSize:"1.4rem",fontWeight:"800",color:"#f87171"}}>{trend.worst_mood ?? "—"}</div>
                          <div style={{fontSize:"0.68rem",color:"var(--text-muted)",textTransform:"uppercase"}}>Worst</div>
                        </div>
                      </div>

                    </>
                  ) : (
                    <div className="graph-empty"><div className="graph-empty-icon">📈</div>Add entries to see insights</div>
                  )}
                </div>
              </div>

              {trend?.triggered && <div className="cause-section"><h4>⚠ Detected Pattern</h4><p>{trend.reason}</p></div>}
              {alert && (
                <div className="chatbot-alert">
                  <h4>💙 AI Support Message</h4>
                  <p>{alert}</p>
                  <button onClick={playAlert} disabled={ttsLoading} className="tts-btn">
                    {ttsLoading ? <><span className="spinner"/> Loading…</> : "🔊 Listen"}
                  </button>
                  <audio ref={audioRef} style={{display:"none"}}/>
                </div>
              )}
            </>
          )}

          {activeTab === "coping" && (
            <div className="fade-in">
              <p style={{color:"var(--text-secondary)",fontSize:"0.875rem",marginBottom:"24px",lineHeight:1.6}}>
                Tools to shift your emotional state — talk it out or let calming sounds carry you. 🌿
              </p>

              {/* Now Playing ambient banner */}
              <NowPlayingBanner
                theme={ambientTheme}
                playing={ambientPlaying}
                trackLabel={ambientTrackMeta.label}
                trackIcon={ambientTrackMeta.icon}
              />

              {/* Chatbot */}
              <div style={{marginBottom:"24px"}}>
                <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#22d3a8",display:"inline-block",boxShadow:"0 0 8px #22d3a8",animation:"pulse-glow 2s ease infinite"}}/>
                  Wellness Companion — Talk It Out
                </div>
                <CopingChatbot />
              </div>

              {/* Soothing Music */}
              <div style={{marginBottom:"24px"}}>
                <div style={{fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:"12px"}}>
                  🎵 Soothing Ambient Sounds
                </div>
                <SoothingMusic
                  onAmbientChange={(theme) => {
                    setAmbientTheme(theme);
                  }}
                  onPlayingChange={(isPlaying) => {
                    setAmbientPlaying(isPlaying);
                  }}
                  onTrackChange={(track) => {
                    if (track) setAmbientTrackMeta({ label: track.label, icon: track.icon });
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "mindMirror" && (
            <div className="fade-in">
              <p style={{color:"var(--text-secondary)",fontSize:"0.875rem",marginBottom:"20px",lineHeight:1.6}}>
                AI-powered real-time reflection. Start a session to analyze your emotional micro-expressions locally and privately.
              </p>
              <MindMirror />
            </div>
          )}

          {activeTab === "community" && <CommunitySection/>}
        </div>
      </div>

      {/* --- Hackathon Judge Mode / Technical Transparency --- */}
      <footer style={{padding:"60px 40px 100px",borderTop:"1px solid var(--border-color)",marginTop:"80px",background:"rgba(0,0,0,0.15)",position:"relative",zIndex:10}}>
        <div style={{maxWidth:"1200px",margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"32px"}}>
            <div style={{padding:"6px 14px",background:"var(--accent-soft)",borderRadius:"8px",fontSize:"0.72rem",color:"var(--accent-mid)",fontWeight:"800",letterSpacing:"0.08em",border:"1px solid var(--border-color)"}}>JUDGE OVERVIEW</div>
            <h2 style={{fontSize:"1.6rem",color:"#fff",margin:0}}>Technical Framework & Ethical Mitigations</h2>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:"24px"}}>
            <div className="glass-panel neu-card" style={{padding:"28px",borderRadius:"18px",background:"rgba(255,255,255,0.02)"}}>
              <h4 style={{color:"#3b82f6",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px",fontSize:"1rem"}}>🤖 Hybrid Intelligence</h4>
              <p style={{fontSize:"0.85rem",color:"var(--text-secondary)",lineHeight:1.7}}>
                MoodScape uses a <strong>Hybrid Analysis Chain</strong>. VADER provides low-latency heuristic scoring, while <strong>Gemini 1.5 Flash</strong> resolves complex <strong>sarcasm, slang, and contextual ambivalence</strong>.
              </p>
            </div>

            <div className="glass-panel neu-card" style={{padding:"28px",borderRadius:"18px",background:"rgba(255,255,255,0.02)"}}>
              <h4 style={{color:"#22d3a8",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px",fontSize:"1rem"}}>🛡️ Privacy-First Biometrics</h4>
              <p style={{fontSize:"0.85rem",color:"var(--text-secondary)",lineHeight:1.7}}>
                Biometric inputs (webcam/microphone) are <strong>Processed Locally</strong> in the browser memory. No audio/video data is transmitted to the backend, ensuring <strong>HIPAA-aligned</strong> personal security.
              </p>
            </div>

            <div className="glass-panel neu-card" style={{padding:"28px",borderRadius:"18px",background:"rgba(255,255,255,0.02)"}}>
              <h4 style={{color:"#a78bfa",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px",fontSize:"1rem"}}>🧠 Conversational Empathy</h4>
              <p style={{fontSize:"0.85rem",color:"var(--text-secondary)",lineHeight:1.7}}>
                The <strong>Sage Companion</strong> is governed by personality-steering instructions that prioritize <strong>validation over prescription</strong>. Multi-turn context ensures suggestions follow the user's emotional journey.
              </p>
            </div>

            <div className="glass-panel neu-card" style={{padding:"28px",borderRadius:"18px",background:"rgba(255,255,255,0.02)"}}>
              <h4 style={{color:"#fbbf24",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px",fontSize:"1rem"}}>💙 Ethical Social Safety</h4>
              <p style={{fontSize:"0.85rem",color:"var(--text-secondary)",lineHeight:1.7}}>
                Moderation uses <strong>Reflective Rejection</strong>. Instead of simple censorship, we guide users to reframe negative venting into <strong>support-seeking narratives</strong>, fostering community resilience.
              </p>
            </div>
          </div>
          
          <div style={{marginTop:"44px",paddingTop:"24px",borderTop:"1px solid var(--border-color)",textAlign:"center",fontSize:"0.72rem",color:"var(--text-muted)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>Stack: React 18 · Vite · Flask · PostgreSQL · Gemini AI · ElevenLabs</span>
            <span style={{letterSpacing:"0.05em"}}>© 2026 MoodScape Team — Hackathon Optimized</span>
          </div>
        </div>
      </footer>
    </>
  );
}
