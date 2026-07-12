"use client";

import { useEffect, useRef, useState } from "react";
import "./game.css";

type Upgrade = { title: string; detail: string; apply: () => void };
type Mob = { x: number; y: number; r: number; hp: number; max: number; speed: number; hue: number };
type Shot = { x: number; y: number; vx: number; vy: number; life: number; damage: number };
type Gem = { x: number; y: number; value: number };
type State = {
  x: number; y: number; hp: number; maxHp: number; speed: number; damage: number; rate: number;
  shotClock: number; spawnClock: number; time: number; xp: number; nextXp: number; level: number; kills: number;
  mobs: Mob[]; shots: Shot[]; gems: Gem[]; over: boolean; paused: boolean; invincible: number;
};

const initial = (): State => ({
  x: 0, y: 0, hp: 12, maxHp: 12, speed: 220, damage: 2, rate: .65, shotClock: 0,
  spawnClock: 0, time: 0, xp: 0, nextXp: 8, level: 1, kills: 0,
  mobs: [], shots: [], gems: [], over: false, paused: false, invincible: 0,
});

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initial());
  const keys = useRef(new Set<string>());
  const stick = useRef({ active: false, id: -1, sx: 0, sy: 0, x: 0, y: 0 });
  const [hud, setHud] = useState({ hp: 12, maxHp: 12, xp: 0, next: 8, level: 1, kills: 0, time: 0 });
  const [started, setStarted] = useState(false);
  const [choice, setChoice] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [flash, setFlash] = useState("");

  const upgrades = (): Upgrade[] => [
    { title: "룬 위력", detail: "성좌탄 피해량 +1", apply: () => stateRef.current.damage += 1 },
    { title: "영창 가속", detail: "자동 공격 속도 +18%", apply: () => stateRef.current.rate = Math.max(.16, stateRef.current.rate * .82) },
    { title: "마력 순환", detail: "이동 속도·최대 체력 증가", apply: () => { const s=stateRef.current; s.speed+=22; s.maxHp+=2; s.hp=Math.min(s.maxHp,s.hp+4); } },
  ];

  const choose = (i: number) => {
    upgrades()[i].apply(); stateRef.current.paused = false; setChoice(false);
    setFlash(upgrades()[i].title); setTimeout(() => setFlash(""), 1200);
  };
  const restart = () => { stateRef.current = initial(); setGameOver(false); setChoice(false); setStarted(true); };

  useEffect(() => {
    const down=(e:KeyboardEvent)=>{ keys.current.add(e.key.toLowerCase()); if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase()))e.preventDefault(); };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",down); window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)};
  },[]);

  useEffect(() => {
    const canvas=canvasRef.current!; const ctx=canvas.getContext("2d")!; let raf=0; let last=performance.now(); let hudClock=0;
    const resize=()=>{ const d=Math.min(devicePixelRatio,2); canvas.width=innerWidth*d;canvas.height=innerHeight*d;canvas.style.width=`${innerWidth}px`;canvas.style.height=`${innerHeight}px`;ctx.setTransform(d,0,0,d,0,0); };
    resize(); window.addEventListener("resize",resize);
    const loop=(now:number)=>{ const dt=Math.min((now-last)/1000,.033);last=now; const W=innerWidth,H=innerHeight,s=stateRef.current;
      if(started&&!s.paused&&!s.over) update(s,dt,W,H);
      draw(ctx,s,W,H,now,started,stick.current);
      if(started&&(hudClock+=dt)>.08){hudClock=0;setHud({hp:s.hp,maxHp:s.maxHp,xp:s.xp,next:s.nextXp,level:s.level,kills:s.kills,time:s.time})}
      if(s.paused&&!choice){setChoice(true)} if(s.over&&!gameOver){setGameOver(true)} raf=requestAnimationFrame(loop);
    }; raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize)};
  },[started,choice,gameOver]);

  const update=(s:State,dt:number,W:number,H:number)=>{
    s.time+=dt;s.invincible-=dt;s.spawnClock-=dt;s.shotClock-=dt;
    let dx=0,dy=0; const k=keys.current;
    if(k.has("a")||k.has("arrowleft"))dx--;if(k.has("d")||k.has("arrowright"))dx++;if(k.has("w")||k.has("arrowup"))dy--;if(k.has("s")||k.has("arrowdown"))dy++;
    const j=stick.current;if(j.active){dx=j.x;dy=j.y} const len=Math.hypot(dx,dy)||1;s.x+=dx/len*s.speed*dt;s.y+=dy/len*s.speed*dt;
    s.spawnClock-=dt;if(s.spawnClock<=0){s.spawnClock=Math.max(.14,.7-s.time*.004);const a=Math.random()*Math.PI*2,d=Math.max(W,H)*.72;const elite=Math.random()<Math.min(.3,s.time/240);const hp=(elite?8:3)+Math.floor(s.time/40);s.mobs.push({x:s.x+Math.cos(a)*d,y:s.y+Math.sin(a)*d,r:elite?25:16+Math.random()*7,hp,max:hp,speed:(elite?36:54)+s.time*.12,hue:elite?282:335});}
    if(s.shotClock<=0&&s.mobs.length){s.shotClock=s.rate;let target=s.mobs[0],best=Infinity;for(const m of s.mobs){const d=(m.x-s.x)**2+(m.y-s.y)**2;if(d<best){best=d;target=m}}const a=Math.atan2(target.y-s.y,target.x-s.x);s.shots.push({x:s.x,y:s.y,vx:Math.cos(a)*510,vy:Math.sin(a)*510,life:1.4,damage:s.damage});}
    for(const m of s.mobs){const a=Math.atan2(s.y-m.y,s.x-m.x);m.x+=Math.cos(a)*m.speed*dt;m.y+=Math.sin(a)*m.speed*dt;if(Math.hypot(m.x-s.x,m.y-s.y)<m.r+18&&s.invincible<=0){s.hp--;s.invincible=.55;if(s.hp<=0){s.hp=0;s.over=true}}}
    for(const p of s.shots){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;for(const m of s.mobs){if(m.hp>0&&Math.hypot(p.x-m.x,p.y-m.y)<m.r+8){m.hp-=p.damage;p.life=0;break}}}
    for(const m of s.mobs){if(m.hp<=0){s.kills++;s.gems.push({x:m.x,y:m.y,value:1})}}
    s.mobs=s.mobs.filter(m=>m.hp>0);s.shots=s.shots.filter(p=>p.life>0);
    for(const g of s.gems){const d=Math.hypot(s.x-g.x,s.y-g.y);if(d<145){g.x+=(s.x-g.x)/Math.max(d,1)*330*dt;g.y+=(s.y-g.y)/Math.max(d,1)*330*dt}if(d<24){s.xp+=g.value;g.value=0}}
    s.gems=s.gems.filter(g=>g.value>0);if(s.xp>=s.nextXp){s.xp-=s.nextXp;s.level++;s.nextXp=Math.floor(s.nextXp*1.35+3);s.paused=true}
  };

  const pointerDown=(e:React.PointerEvent)=>{if(!started||choice||gameOver)return;stick.current={active:true,id:e.pointerId,sx:e.clientX,sy:e.clientY,x:0,y:0};canvasRef.current?.setPointerCapture(e.pointerId)};
  const pointerMove=(e:React.PointerEvent)=>{const j=stick.current;if(!j.active||j.id!==e.pointerId)return;const dx=e.clientX-j.sx,dy=e.clientY-j.sy,l=Math.hypot(dx,dy),max=62;j.x=dx/Math.max(l,max);j.y=dy/Math.max(l,max)};
  const pointerUp=()=>{stick.current.active=false;stick.current.x=0;stick.current.y=0};

  return <main className="game-shell">
    <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="네온 아르카나 게임 화면" />
    {started&&<div className="hud"><div className="xp"><i style={{width:`${hud.xp/hud.next*100}%`}}/></div><div className="stats"><span>LV.{hud.level}</span><span>♥ {hud.hp}/{hud.maxHp}</span><span>✦ {hud.kills}</span><span>{String(Math.floor(hud.time/60)).padStart(2,"0")}:{String(Math.floor(hud.time%60)).padStart(2,"0")}</span></div></div>}
    {!started&&<section className="start-card"><p className="eyebrow">URBAN OCCULT / CASE 07</p><h1>NEON<br/><em>ARCANA</em></h1><p className="kicker">균열이 열린 서울의 밤.<br/>성좌술사 아스트라와 마지막 새벽까지 버텨라.</p><button onClick={()=>setStarted(true)}>출격 개시 <b>›</b></button><small>화면을 드래그하거나 WASD로 이동 · 공격은 자동</small></section>}
    {choice&&<section className="modal"><p>ARCANA AWAKENING</p><h2>술식 공명 선택</h2>{upgrades().map((u,i)=><button key={u.title} onClick={()=>choose(i)}><b>0{i+1}</b><span><strong>{u.title}</strong><small>{u.detail}</small></span><i>›</i></button>)}</section>}
    {gameOver&&<section className="modal over"><p>RIFT COLLAPSED</p><h2>작전 종료</h2><div className="result"><span>생존 시간<b>{Math.floor(hud.time)}초</b></span><span>격파 수<b>{hud.kills}</b></span></div><button onClick={restart} className="retry">다시 출격</button></section>}
    {flash&&<div className="flash">✦ {flash} 획득</div>}
  </main>;
}

function draw(ctx:CanvasRenderingContext2D,s:State,W:number,H:number,t:number,started:boolean,j:{active:boolean;sx:number;sy:number;x:number;y:number}){
  ctx.clearRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#07051b");g.addColorStop(.55,"#0b1030");g.addColorStop(1,"#03040d");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.translate(W/2-s.x,H/2-s.y);ctx.strokeStyle="rgba(76,207,255,.055)";ctx.lineWidth=1;const grid=72,ox=Math.floor((s.x-W)/grid)*grid,oy=Math.floor((s.y-H)/grid)*grid;for(let x=ox;x<s.x+W;x+=grid){ctx.beginPath();ctx.moveTo(x,s.y-H);ctx.lineTo(x,s.y+H);ctx.stroke()}for(let y=oy;y<s.y+H;y+=grid){ctx.beginPath();ctx.moveTo(s.x-W,y);ctx.lineTo(s.x+W,y);ctx.stroke()}
  for(const g of s.gems){ctx.save();ctx.translate(g.x,g.y);ctx.rotate(t*.003);ctx.shadowBlur=18;ctx.shadowColor="#45ffd1";ctx.fillStyle="#78ffe2";ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(7,0);ctx.lineTo(0,10);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();ctx.restore()}
  for(const m of s.mobs){ctx.shadowBlur=20;ctx.shadowColor=`hsl(${m.hue} 100% 55%)`;ctx.fillStyle=`hsl(${m.hue} 74% 48%)`;ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,7);ctx.fill();ctx.fillStyle="#13091f";ctx.beginPath();ctx.arc(m.x-5,m.y-3,3,0,7);ctx.arc(m.x+5,m.y-3,3,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#171328";ctx.fillRect(m.x-m.r,m.y-m.r-9,m.r*2,3);ctx.fillStyle="#ff5a92";ctx.fillRect(m.x-m.r,m.y-m.r-9,m.r*2*m.hp/m.max,3)}
  for(const p of s.shots){ctx.shadowBlur=22;ctx.shadowColor="#55f8ff";ctx.fillStyle="#c8ffff";ctx.beginPath();ctx.arc(p.x,p.y,6,0,7);ctx.fill()}
  if(started){ctx.translate(s.x,s.y);ctx.globalAlpha=s.invincible>0&&Math.floor(t/70)%2? .35:1;ctx.shadowBlur=30;ctx.shadowColor="#36eaff";ctx.fillStyle="#65f3ff";ctx.beginPath();ctx.arc(0,0,18,0,7);ctx.fill();ctx.strokeStyle="#f6b8ff";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,27+t%800/800*5,0,7);ctx.stroke();ctx.fillStyle="#091129";ctx.beginPath();ctx.arc(-5,-3,3,0,7);ctx.arc(5,-3,3,0,7);ctx.fill();ctx.globalAlpha=1}ctx.restore();ctx.shadowBlur=0;
  if(j.active){ctx.strokeStyle="rgba(120,244,255,.5)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(j.sx,j.sy,62,0,7);ctx.stroke();ctx.fillStyle="rgba(120,244,255,.35)";ctx.beginPath();ctx.arc(j.sx+j.x*62,j.sy+j.y*62,24,0,7);ctx.fill()}
}
