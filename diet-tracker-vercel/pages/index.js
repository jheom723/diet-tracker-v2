import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from "recharts";
import Head from "next/head";

const STORAGE_KEY = "diet-tracker-records";

function loadRecords() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecords(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function calcScore(r) {
  let s = 50;
  if (r.breakfast) s += 8;
  if (r.lunch)     s += 8;
  if (r.dinner)    s += 8;
  if (r.snack)     s += 3;
  if (r.exercise)  s += 12;
  if (r.duration && parseInt(r.duration) >= 30) s += 6;
  const water = parseInt(r.water) || 0;
  if (water >= 8) s += 5; else if (water >= 5) s += 3;
  if (!r.breakfast || !r.lunch || !r.dinner) s -= 5;
  return Math.min(100, Math.max(0, s));
}

function ScoreBadge({ score, onClick }) {
  const grades = { A:"#22c55e", B:"#84cc16", C:"#facc15", D:"#f97316", F:"#ef4444" };
  const grade = score>=90?"A": score>=75?"B": score>=60?"C": score>=40?"D":"F";
  return (
    <span onClick={onClick} style={{
      background: grades[grade], color:"#fff",
      fontFamily:"'Playfair Display',serif", fontWeight:700,
      fontSize:13, borderRadius:6, padding:"2px 9px", letterSpacing:1,
      cursor: onClick ? "pointer" : "default",
    }}>{grade}</span>
  );
}

function WeightChart({ records }) {
  const data = [...records].reverse().filter(r=>r.weight)
    .map(r=>({ date: r.date.slice(5), weight: parseFloat(r.weight) }));

  if (data.length < 2) return (
    <div style={{textAlign:"center",color:"#64748b",padding:"20px 0",fontSize:13}}>
      몸무게 데이터가 2개 이상 있어야 그래프가 표시돼요 📉
    </div>
  );

  const weights = data.map(d=>d.weight);
  const minW = Math.min(...weights), maxW = Math.max(...weights);
  const avg = (weights.reduce((a,b)=>a+b,0)/weights.length).toFixed(1);
  const diff = (weights[weights.length-1]-weights[0]).toFixed(1);

  const CustomTooltip = ({active,payload,label}) => active && payload?.length ? (
    <div style={{background:"rgba(30,20,60,0.95)",border:"1px solid rgba(167,139,250,0.3)",borderRadius:10,padding:"8px 14px",fontSize:12}}>
      <div style={{color:"#94a3b8",marginBottom:2}}>{label}</div>
      <div style={{color:"#f0abfc",fontWeight:700,fontSize:15}}>{payload[0].value} kg</div>
    </div>
  ) : null;

  const statPill = {display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.06)",borderRadius:20,padding:"4px 12px",fontSize:12};

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {[
          {label:"시작", val:`${weights[0]}kg`, color:"#e2e8f0"},
          {label:"현재", val:`${weights[weights.length-1]}kg`, color:"#e2e8f0"},
          {label:"변화", val:`${diff<0?"▼":"▲"} ${Math.abs(diff)}kg`, color:diff<0?"#86efac":"#fca5a5"},
          {label:"평균", val:`${avg}kg`, color:"#c4b5fd"},
        ].map(({label,val,color})=>(
          <div key={label} style={statPill}>
            <span style={{color:"#94a3b8",fontSize:11}}>{label}</span>
            <span style={{color,fontWeight:600}}>{val}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{top:10,right:10,left:-10,bottom:0}}>
          <defs>
            <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
          <XAxis dataKey="date" tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
          <YAxis domain={[minW-1,maxW+1]} tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
          <Tooltip content={<CustomTooltip/>}/>
          <ReferenceLine y={parseFloat(avg)} stroke="rgba(167,139,250,0.4)" strokeDasharray="4 4"
            label={{value:`avg ${avg}`,fill:"#7c3aed",fontSize:10,position:"insideTopRight"}}/>
          <Area type="monotone" dataKey="weight" stroke="#a855f7" strokeWidth={2.5}
            fill="url(#wg)" dot={{r:3,fill:"#7c3aed"}} activeDot={{r:6,fill:"#c084fc",stroke:"#fff",strokeWidth:2}}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AiModal({ record, onClose }) {
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState(null);

  useEffect(() => {
    fetchComment();
  }, []);

  async function fetchComment() {
    setLoading(true);
    try {
      const prompt = `다음은 사용자의 하루 다이어트 기록입니다. 건강한 다이어트 코치 입장에서 친근하고 구체적으로 피드백해주세요.

날짜: ${record.date}
아침: ${record.breakfast||"미기록"}
점심: ${record.lunch||"미기록"}
저녁: ${record.dinner||"미기록"}
간식: ${record.snack||"없음"}
운동: ${record.exercise ? record.exercise+(record.duration?" "+record.duration+"분":"") : "없음"}
물 섭취: ${record.water ? record.water+"잔" : "미기록"}
몸무게: ${record.weight ? record.weight+"kg" : "미기록"}
메모: ${record.note||"없음"}
점수: ${record.score}점

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{"goods":["잘한 점 1","잘한 점 2"],"improvements":["개선할 점 1","개선할 점 2"],"tip":"오늘을 위한 따뜻한 한마디"}`;

      const res = await fetch("/api/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }]
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b=>b.text||"").join("") || "";
      setComment(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(err) {
      setComment({ error: err.message });
    }
    setLoading(false);
  }

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(160deg,#1e1040,#2d1b69)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:"24px 24px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:520,maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:"rgba(255,255,255,0.15)",borderRadius:2,margin:"0 auto 20px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#c4b5fd"}}>AI 다이어트 코치</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{record.date}</div>
          </div>
          <ScoreBadge score={record.score}/>
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:"30px 0"}}>
            <div style={{fontSize:28,marginBottom:12}}>🤔</div>
            <div style={{color:"#94a3b8",fontSize:13}}>기록을 분석하는 중...</div>
          </div>
        ) : comment?.error ? (
          <div style={{color:"#ef4444",fontSize:13}}>오류: {comment.error}</div>
        ) : comment ? (
          <div>
            {comment.goods?.length > 0 && (
              <div style={{marginBottom:18}}>
                <div style={{fontSize:12,color:"#86efac",fontWeight:600,marginBottom:10}}>✅ 잘하고 있어요</div>
                {comment.goods.map((g,i)=>(
                  <div key={i} style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#e2e8f0",marginBottom:7,lineHeight:1.5}}>{g}</div>
                ))}
              </div>
            )}
            {comment.improvements?.length > 0 && (
              <div style={{marginBottom:18}}>
                <div style={{fontSize:12,color:"#fbbf24",fontWeight:600,marginBottom:10}}>💡 이렇게 개선해봐요</div>
                {comment.improvements.map((imp,i)=>(
                  <div key={i} style={{background:"rgba(251,191,36,0.07)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#e2e8f0",marginBottom:7,lineHeight:1.5}}>{imp}</div>
                ))}
              </div>
            )}
            {comment.tip && (
              <div style={{background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.25)",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#c4b5fd",lineHeight:1.6}}>✨ {comment.tip}</div>
            )}
          </div>
        ) : null}

        <button onClick={onClose} style={{marginTop:22,width:"100%",padding:"12px",borderRadius:12,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"#94a3b8",fontSize:13,cursor:"pointer"}}>
          닫기
        </button>
      </div>
    </div>
  );
}

const inputStyle = {width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"9px 12px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"};
const iconBtn = {background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:13};

function Section({title,children}) {
  return (
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"14px 16px"}}>
      <div style={{fontSize:12,fontWeight:500,color:"#94a3b8",marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}

function Tag({icon,text,color="#ddd6fe"}) {
  return <span style={{background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"3px 9px",fontSize:11,color,display:"inline-flex",alignItems:"center",gap:4}}>{icon} {text}</span>;
}

function StatCard({label,value,icon}) {
  return (
    <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 12px",textAlign:"center"}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#c4b5fd",marginTop:4}}>{value}</div>
      <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{label}</div>
    </div>
  );
}

export default function DietTracker() {
  const [records, setRecords] = useState([]);
  const [view, setView] = useState("log");
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,10),
    breakfast:"", lunch:"", dinner:"", snack:"",
    exercise:"", duration:"", water:"", weight:"", note:""
  });
  const [saved, setSaved] = useState(false);
  const [editId, setEditId] = useState(null);
  const [aiModal, setAiModal] = useState(null);

  useEffect(() => {
    setRecords(loadRecords());
  }, []);

  function handleSubmit() {
    if (!form.date) return;
    const entry = {...form, id: editId||Date.now(), score: calcScore(form)};
    let updated;
    if (editId) {
      updated = records.map(r => r.id===editId ? entry : r);
      setEditId(null);
    } else {
      const exists = records.find(r=>r.date===form.date);
      updated = exists
        ? records.map(r=>r.date===form.date ? {...entry,id:r.id} : r)
        : [entry,...records];
    }
    updated.sort((a,b)=>a.date<b.date?1:-1);
    setRecords(updated);
    saveRecords(updated);
    setSaved(true);
    setTimeout(()=>setSaved(false),1800);
    setForm({...form,breakfast:"",lunch:"",dinner:"",snack:"",exercise:"",duration:"",water:"",weight:"",note:""});
    setView("history");
  }

  function handleEdit(r) { setForm({...r}); setEditId(r.id); setView("log"); }
  function handleDelete(id) {
    const updated = records.filter(r=>r.id!==id);
    setRecords(updated); saveRecords(updated);
  }

  const avgScore = records.length>0 ? Math.round(records.reduce((s,r)=>s+(r.score||0),0)/records.length) : null;
  const exerciseDays = records.filter(r=>r.exercise).length;

  return (
    <>
      <Head>
        <title>나의 다이어트 트래커</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
        <meta name="theme-color" content="#0f0c29"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <link rel="manifest" href="/manifest.json"/>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); min-height: 100vh; }
          input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; }
          input:focus, textarea:focus { border-color: rgba(167,139,250,0.5) !important; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.4); border-radius: 2px; }
        `}</style>
      </Head>

      <div style={{minHeight:"100vh",fontFamily:"'DM Sans',sans-serif",color:"#e2e8f0",paddingBottom:60}}>
        {/* 헤더 */}
        <div style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.08)",padding:"20px 24px 16px",position:"sticky",top:0,zIndex:10}}>
          <div style={{maxWidth:520,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#c4b5fd"}}>나의 다이어트</span>
                <span style={{fontSize:11,color:"#94a3b8",letterSpacing:2,textTransform:"uppercase"}}>Daily Tracker</span>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:14}}>
              {[{id:"log",label:editId?"✏️ 수정":"✍️ 기록"},{id:"history",label:"📋 히스토리"},{id:"stats",label:"📊 통계"}].map(tab=>(
                <button key={tab.id} onClick={()=>{setView(tab.id);if(tab.id!=="log")setEditId(null);}}
                  style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,
                    background:view===tab.id?"#7c3aed":"rgba(255,255,255,0.08)",color:view===tab.id?"#fff":"#94a3b8"}}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{maxWidth:520,margin:"0 auto",padding:"24px 16px 0"}}>
          {aiModal && <AiModal record={aiModal} onClose={()=>setAiModal(null)}/>}

          {/* 기록 뷰 */}
          {view==="log" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Section title="📅 날짜">
                <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inputStyle}/>
              </Section>
              <Section title="🍽️ 식단">
                {[{key:"breakfast",label:"아침",ph:"예: 오트밀, 삶은달걀"},{key:"lunch",label:"점심",ph:"예: 닭가슴살 샐러드"},{key:"dinner",label:"저녁",ph:"예: 현미밥, 된장국"},{key:"snack",label:"간식",ph:"예: 견과류, 단백질바"}].map(({key,label,ph})=>(
                  <div key={key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <span style={{width:36,fontSize:12,color:"#94a3b8",flexShrink:0}}>{label}</span>
                    <input type="text" placeholder={ph} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} style={{...inputStyle,flex:1}}/>
                  </div>
                ))}
              </Section>
              <Section title="🏃 운동">
                <div style={{display:"flex",gap:10}}>
                  <input type="text" placeholder="운동 종류" value={form.exercise} onChange={e=>setForm({...form,exercise:e.target.value})} style={{...inputStyle,flex:2}}/>
                  <input type="number" placeholder="분" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} style={{...inputStyle,flex:1}}/>
                </div>
              </Section>
              <Section title="💧 물 & ⚖️ 몸무게">
                <div style={{display:"flex",gap:10}}>
                  <div style={{flex:1}}>
                    <label style={{fontSize:11,color:"#94a3b8",display:"block",marginBottom:4}}>물 (잔)</label>
                    <input type="number" placeholder="8" value={form.water} onChange={e=>setForm({...form,water:e.target.value})} style={inputStyle}/>
                  </div>
                  <div style={{flex:1}}>
                    <label style={{fontSize:11,color:"#94a3b8",display:"block",marginBottom:4}}>몸무게 (kg)</label>
                    <input type="number" step="0.1" placeholder="60.0" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})} style={inputStyle}/>
                  </div>
                </div>
              </Section>
              <Section title="📝 메모">
                <textarea rows={2} placeholder="오늘의 컨디션이나 특이사항..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})} style={{...inputStyle,resize:"none",lineHeight:1.5}}/>
              </Section>
              <button onClick={handleSubmit} style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#7c3aed,#a855f7)",color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 24px rgba(124,58,237,0.4)"}}>
                {saved?"✅ 저장됐어요!": editId?"수정 완료":"오늘 기록 저장"}
              </button>
            </div>
          )}

          {/* 히스토리 뷰 */}
          {view==="history" && (
            <div>
              {records.length===0 ? (
                <div style={{textAlign:"center",color:"#64748b",marginTop:60}}>
                  <div style={{fontSize:40}}>🌱</div>
                  <div style={{marginTop:12}}>아직 기록이 없어요!</div>
                </div>
              ) : records.map(r=>(
                <div key={r.id} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"16px 18px",marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#c4b5fd"}}>{r.date}</span>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {r.score!==undefined && <ScoreBadge score={r.score} onClick={()=>setAiModal(r)}/>}
                      <button onClick={()=>handleEdit(r)} style={iconBtn}>✏️</button>
                      <button onClick={()=>handleDelete(r.id)} style={iconBtn}>🗑️</button>
                    </div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                    {r.breakfast && <Tag icon="🌅" text={`아침: ${r.breakfast}`}/>}
                    {r.lunch && <Tag icon="☀️" text={`점심: ${r.lunch}`}/>}
                    {r.dinner && <Tag icon="🌙" text={`저녁: ${r.dinner}`}/>}
                    {r.snack && <Tag icon="🍎" text={`간식: ${r.snack}`}/>}
                    {r.exercise && <Tag icon="🏃" text={`${r.exercise}${r.duration?` ${r.duration}분`:""}`} color="#6ee7b7"/>}
                    {r.water && <Tag icon="💧" text={`물 ${r.water}잔`} color="#7dd3fc"/>}
                    {r.weight && <Tag icon="⚖️" text={`${r.weight}kg`} color="#f0abfc"/>}
                  </div>
                  {r.note && <div style={{fontSize:12,color:"#94a3b8",fontStyle:"italic"}}>"{r.note}"</div>}
                  <div style={{fontSize:11,color:"#475569",marginTop:6}}>💬 등급 배지를 탭하면 AI 코치 코멘트를 볼 수 있어요</div>
                </div>
              ))}
            </div>
          )}

          {/* 통계 뷰 */}
          {view==="stats" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <StatCard label="기록일수" value={`${records.length}일`} icon="📅"/>
                <StatCard label="평균점수" value={avgScore!==null?`${avgScore}점`:"-"} icon="⭐"/>
                <StatCard label="운동일수" value={`${exerciseDays}일`} icon="🏃"/>
              </div>
              <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:18}}>
                <div style={{fontSize:13,color:"#94a3b8",marginBottom:14}}>⚖️ 몸무게 변화 그래프</div>
                <WeightChart records={records}/>
              </div>
              <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:18}}>
                <div style={{fontSize:13,color:"#94a3b8",marginBottom:12}}>📈 최근 점수 추이</div>
                {records.slice(0,7).reverse().map(r=>(
                  <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
                    <span style={{fontSize:11,color:"#64748b",width:70,flexShrink:0}}>{r.date.slice(5)}</span>
                    <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:6,height:8,overflow:"hidden"}}>
                      <div style={{width:`${r.score||0}%`,height:"100%",background:(r.score||0)>=80?"#22c55e":(r.score||0)>=60?"#facc15":"#ef4444",borderRadius:6}}/>
                    </div>
                    <ScoreBadge score={r.score||0}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
