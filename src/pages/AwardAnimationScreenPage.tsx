import React from 'react';
import { Award, ChevronLeft, ChevronRight, Download, Maximize2, Play, Pause, X } from 'lucide-react';
import { getAwardSnapshot, type AwardKey } from '@/lib/award-graphics';

const ORDER: AwardKey[] = ['best_player','best_referee','best_team','best_club','team_match_mvp','fair_play','top_scorer','top_hitter'];

function useQueryAward() {
  const [key,setKey]=React.useState<AwardKey>(()=>{
    const raw=new URLSearchParams(window.location.hash.split('?')[1]||'').get('award') as AwardKey|null;
    return raw && ORDER.includes(raw) ? raw : 'best_player';
  });
  return [key,setKey] as const;
}

export default function AwardAnimationScreenPage(){
  const [key,setKey]=useQueryAward();
  const [playing,setPlaying]=React.useState(false);
  
  const [tick,setTick]=React.useState(0);
  const snapshot=React.useMemo(()=>getAwardSnapshot(key),[key,tick]);
  React.useEffect(()=>{ const id=setInterval(()=>setTick(x=>x+1),2500); return()=>clearInterval(id); },[]);
  React.useEffect(()=>{ if(!playing)return; const id=setInterval(()=>setKey(k=>ORDER[(ORDER.indexOf(k)+1)%ORDER.length]),6500); return()=>clearInterval(id); },[playing]);
  if(!snapshot) return <div className="min-h-screen bg-black text-white grid place-items-center">NO AWARD DATA</div>;
  const stats=Object.entries(snapshot.winner.stats||{}).slice(0,6);
  const photo=snapshot.winner.photo;

  const downloadCard = async () => {
    const canvas=document.createElement('canvas');
    canvas.width=1920; canvas.height=1080;
    const ctx=canvas.getContext('2d');
    if(!ctx) return;
    const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
    try {
      const template=await load(snapshot.template);
      ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
      const scale=Math.min(canvas.width/template.naturalWidth,canvas.height/template.naturalHeight);
      const dw=template.naturalWidth*scale, dh=template.naturalHeight*scale;
      ctx.drawImage(template,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
      if(photo){
        const img=await load(photo);
        const w=360,h=430,x=(canvas.width-w)/2,y=250;
        ctx.save(); ctx.beginPath(); ctx.roundRect(x,y,w,h,20); ctx.clip();
        const fit=Math.max(w/img.naturalWidth,h/img.naturalHeight);
        const iw=img.naturalWidth*fit, ih=img.naturalHeight*fit;
        ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih); ctx.restore();
        ctx.strokeStyle='#f3c94d'; ctx.lineWidth=4; ctx.strokeRect(x,y,w,h);
      }
      ctx.textAlign='center'; ctx.fillStyle='#f3c94d'; ctx.font='900 24px Orbitron, Arial'; ctx.fillText(snapshot.title,960,790);
      ctx.fillStyle='#fff'; ctx.font='900 68px Orbitron, Arial'; ctx.fillText(snapshot.winner.name,960,860);
      ctx.fillStyle='rgba(255,255,255,.78)'; ctx.font='700 24px Arial'; ctx.fillText(snapshot.winner.subtitle || snapshot.winner.club || snapshot.winner.team || snapshot.tournamentName,960,900);
      ctx.textAlign='left'; let sx=1440, sy=760;
      stats.forEach(([k,v],i)=>{const col=i%2,row=Math.floor(i/2);const x=sx+col*190,y=sy+row*55;ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(x,y,175,44);ctx.fillStyle='rgba(255,255,255,.55)';ctx.font='800 11px Arial';ctx.fillText(String(k),x+10,y+16);ctx.fillStyle='#f3c94d';ctx.font='900 16px Arial';ctx.fillText(String(v),x+10,y+35);});
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png',1));
      if(!blob) return;
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`WAB-TKD-${snapshot.key}-${snapshot.winner.name.replace(/[^a-z0-9_-]+/gi,'_')}.png`; a.click(); URL.revokeObjectURL(url);
    } catch {
      // Keep the animation screen usable even if a photo/template cannot be rasterized.
    }
  };

  return <div className="award-screen fixed inset-0 bg-black text-white overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <img src={snapshot.template} className="award-template-bg" alt="WAB-TKD award template" />
      <div className="award-vignette" />
      <div key={`${key}-${snapshot.winner.name}`} className="award-dynamic-layer">
        {photo && <div className="award-photo-frame"><img src={photo} alt="" /></div>}
        <div className="award-nameplate"><div className="award-kicker">{snapshot.title}</div><div className="award-name">{snapshot.winner.name}</div><div className="award-sub">{snapshot.winner.subtitle || snapshot.winner.club || snapshot.winner.team || snapshot.tournamentName}</div></div>
        {stats.length>0 && <div className="award-stats">{stats.map(([k,v])=><div key={k}><span>{k}</span><b>{String(v)}</b></div>)}</div>}
      </div>
    </div>
    <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
      <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/55 backdrop-blur px-3 py-2 text-[10px] font-black tracking-wider text-[hsl(var(--gold))]"><Award size={13} className="inline mr-1"/> WAB-TKD · AWARD ANIMATION</div>
      <div className="pointer-events-auto flex gap-1.5"><button title="DOWNLOAD CARD" onClick={downloadCard} className="rounded-xl border border-[hsl(var(--gold))]/30 bg-black/60 p-2 text-[hsl(var(--gold))]"><Download size={15}/></button><button onClick={()=>setPlaying(v=>!v)} className="rounded-xl border border-white/10 bg-black/60 p-2">{playing?<Pause size={15}/>:<Play size={15}/>}</button><button onClick={()=>document.documentElement.requestFullscreen?.().catch(()=>{})} className="rounded-xl border border-white/10 bg-black/60 p-2"><Maximize2 size={15}/></button><button onClick={()=>window.close()} className="rounded-xl border border-white/10 bg-black/60 p-2"><X size={15}/></button></div>
    </div>
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/65 backdrop-blur p-2">
      <button onClick={()=>setKey(k=>ORDER[(ORDER.indexOf(k)-1+ORDER.length)%ORDER.length])} className="p-2 rounded-xl hover:bg-white/10"><ChevronLeft size={16}/></button>
      <div className="px-3 text-[9px] font-black tracking-[.18em]">{ORDER.indexOf(key)+1} / {ORDER.length} · {snapshot.title}</div>
      <button onClick={()=>setKey(k=>ORDER[(ORDER.indexOf(k)+1)%ORDER.length])} className="p-2 rounded-xl hover:bg-white/10"><ChevronRight size={16}/></button>
    </div>
    <style>{`
      .award-template-bg{width:100%;height:100%;object-fit:contain;object-position:center;display:block;animation:awardKenBurns 7s ease-in-out both}
      .award-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,transparent 35%,rgba(0,0,0,.58) 100%),linear-gradient(180deg,rgba(0,0,0,.1),transparent 30%,rgba(0,0,0,.35));pointer-events:none}
      .award-dynamic-layer{position:absolute;inset:0;animation:awardIn .65s cubic-bezier(.2,.8,.2,1) both;pointer-events:none}
      .award-photo-frame{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:min(19vw,280px);height:min(25vw,340px);max-height:46vh;border:2px solid rgba(255,205,80,.9);border-radius:18px;overflow:hidden;background:#050505;box-shadow:0 0 35px rgba(255,193,45,.22);}
      .award-photo-frame img{width:100%;height:100%;object-fit:cover;object-position:center top}
      .award-nameplate{position:absolute;left:50%;bottom:16%;transform:translateX(-50%);min-width:min(52vw,720px);text-align:center;padding:12px 24px;border:1px solid rgba(255,205,80,.5);border-radius:16px;background:linear-gradient(180deg,rgba(4,4,5,.9),rgba(4,4,5,.76));backdrop-filter:blur(8px);box-shadow:0 12px 35px rgba(0,0,0,.45)}
      .award-kicker{font-size:9px;letter-spacing:.28em;color:#f3c94d;font-weight:900}.award-name{font-size:clamp(24px,4vw,58px);font-weight:1000;line-height:.95;margin-top:6px;text-shadow:0 0 22px rgba(255,200,70,.35)}.award-sub{font-size:clamp(10px,1vw,15px);margin-top:7px;color:rgba(255,255,255,.75);font-weight:800}
      .award-stats{position:absolute;right:5%;bottom:10%;display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:6px;max-width:330px}.award-stats>div{padding:8px 10px;border:1px solid rgba(255,205,80,.25);border-radius:10px;background:rgba(0,0,0,.68);display:flex;justify-content:space-between;gap:12px}.award-stats span{font-size:7px;color:rgba(255,255,255,.55);font-weight:900}.award-stats b{font-size:10px;color:#f3c94d}
      @keyframes awardIn{from{opacity:0;transform:scale(.985) translateY(10px);filter:blur(5px)}to{opacity:1;transform:none;filter:none}}@keyframes awardKenBurns{0%{transform:scale(1)}50%{transform:scale(1.018)}100%{transform:scale(1)}}
      @media(max-width:900px){.award-photo-frame{width:28vw;height:38vw}.award-nameplate{bottom:18%;min-width:70vw}.award-stats{display:none}}
    `}</style>
  </div>
}
