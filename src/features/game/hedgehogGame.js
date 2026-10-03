// @ts-nocheck
/*
 * «Ёжик-кувырок» — мини-игра с сайта группы. Автор: RedstoneLord
 * (github.com/RedstoneLord/itmo-m3102, index.html). Перенесена как есть: код игры не менялся (кроме правок с пометкой «Правка поверх оригинала»),
 * только обёртка IIFE заменена на ES-модуль. Обновлять — копированием нового кода из index.html.
 */
const global = window;
/* ===== Ёжик-кувырок: утилиты и данные ===== */
const TAU=Math.PI*2, G=1000, R=26, DT=1/120, PENT=[0,2,4,7,9];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash1(n){n=Math.imul((n|0)^((n|0)>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);n^=n>>>16;return(n>>>0)/4294967296;}
function pl(n,a,b,c){n=Math.abs(n)%100;const m=n%10;if(n>10&&n<20)return c;if(m>1&&m<5)return b;if(m===1)return a;return c;}
function fmt(n){return Math.round(n).toLocaleString('ru-RU');}
function fmtTime(s){s=Math.floor(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function hex(c){return[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];}
function mixc(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function rgb(c,a){return a===undefined?'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')':'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+a+')';}

const HATS=[
  {id:'none',name:'Без шляпы',cost:0},
  {id:'party',name:'Колпачок',cost:25},
  {id:'flower',name:'Венок',cost:60},
  {id:'beret',name:'Берет',cost:100},
  {id:'top',name:'Цилиндр',cost:160},
  {id:'cap',name:'Грибная шапка',cost:250},
  {id:'glasses',name:'Очки',cost:350},
  {id:'crown',name:'Корона',cost:600}
];

const GOAL_DEFS=[
  {id:'flips',amounts:[10,20,35],scope:'day',text:n=>'Сделай '+n+' '+pl(n,'кувырок','кувырка','кувырков')},
  {id:'perfect',amounts:[3,6,10],scope:'day',text:n=>'Приземлись идеально '+n+' '+pl(n,'раз','раза','раз')},
  {id:'berries',amounts:[30,60,100],scope:'day',text:n=>'Собери '+n+' '+pl(n,'ягоду','ягоды','ягод')},
  {id:'dist',amounts:[800,1500,2500],scope:'day',text:n=>'Пробеги '+fmt(n)+' м'},
  {id:'combo',amounts:[3,5,8],scope:'run',text:n=>'Набери комбо ×'+n},
  {id:'time',amounts:[90,180,300],scope:'run',text:n=>'Продержись '+fmtTime(n)+' за один забег'},
  {id:'apples',amounts:[1,2,3],scope:'day',text:n=>'Съешь '+n+' '+pl(n,'яблоко','яблока','яблок')}
];
const GOAL_REWARD=20;

const SAVE_KEY='hh_save_v1';
function todayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function makeDaily(key){
  let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))|0;
  const r=mulberry32(h^0x5bd1e995);
  const pool=GOAL_DEFS.slice(),goals=[];
  for(let i=0;i<3;i++){
    const d=pool.splice(Math.floor(r()*pool.length),1)[0];
    goals.push({id:d.id,target:d.amounts[Math.floor(r()*3)],prog:0,done:false});
  }
  return{date:key,goals};
}
function loadSave(){
  let d={};
  try{d=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{};}catch(e){d={};}
  const s=Object.assign({berries:0,owned:['none'],hat:'none',sfx:false,music:false,daily:null,runs:0,goalsDone:0},d);
  s.best=Object.assign({dist:0,score:0,combo:0,time:0},d.best||{});
  if(!Array.isArray(s.owned)||!s.owned.includes('none'))s.owned=['none'].concat(Array.isArray(s.owned)?s.owned:[]);
  if(!s.owned.includes(s.hat))s.hat='none';
  const k=todayKey();
  if(!s.daily||s.daily.date!==k||!Array.isArray(s.daily.goals))s.daily=makeDaily(k);
  return s;
}
function persist(s){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch(e){}}
function goalDef(id){return GOAL_DEFS.find(g=>g.id===id);}

/* ===== палитра суток ===== */
const PERIOD=720;
const KEYS=[
  {t:0.00,name:'Рассвет',icon:'',skyT:'#f4b6c6',skyB:'#ffe6bf',far:'#d9bde4',mid:'#bcd9a2',gT:'#8dd08a',gB:'#5ca86a',tree:'#8fc98e',night:0.12},
  {t:0.16,name:'Цветущий луг',icon:'',skyT:'#7fcdf2',skyB:'#e6f6ff',far:'#aedbd0',mid:'#8fd48f',gT:'#7fd070',gB:'#4aa65a',tree:'#5fbd6e',night:0},
  {t:0.36,name:'Осенний лес',icon:'',skyT:'#f3b98a',skyB:'#fde5c4',far:'#e0b088',mid:'#d99a58',gT:'#cf8a45',gB:'#9c5c30',tree:'#e07a3a',night:0},
  {t:0.55,name:'Грибная роща',icon:'',skyT:'#b9a4e6',skyB:'#f3d9f0',far:'#a994d6',mid:'#8f7cc8',gT:'#a98ad8',gB:'#6f56ad',tree:'#e8678a',night:0.1},
  {t:0.72,name:'Закат',icon:'',skyT:'#ff8f7e',skyB:'#ffd3a0',far:'#c9709a',mid:'#a65a8c',gT:'#c9688a',gB:'#7a3f6a',tree:'#6d3f72',night:0.3},
  {t:0.86,name:'Звёздная ночь',icon:'',skyT:'#141a46',skyB:'#3a3f80',far:'#2a3a78',mid:'#233466',gT:'#2f5a78',gB:'#1c3350',tree:'#1b2c52',night:1},
  {t:1.00,name:'Рассвет',icon:'',skyT:'#f4b6c6',skyB:'#ffe6bf',far:'#d9bde4',mid:'#bcd9a2',gT:'#8dd08a',gB:'#5ca86a',tree:'#8fc98e',night:0.12}
];
const CF=['skyT','skyB','far','mid','gT','gB','tree'];
KEYS.forEach(k=>CF.forEach(f=>{k['c_'+f]=hex(k[f]);}));
function getPal(tod){
  const f=(tod%PERIOD)/PERIOD;
  let i=0;while(i<KEYS.length-2&&f>=KEYS[i+1].t)i++;
  const a=KEYS[i],b=KEYS[i+1],u=smooth(clamp((f-a.t)/(b.t-a.t),0,1));
  const p={f,i,idx:(u<0.5?i:i+1)%6,biome:i,night:lerp(a.night,b.night,u)};
  CF.forEach(c=>{p['a_'+c]=mixc(a['c_'+c],b['c_'+c],u);p[c]=rgb(p['a_'+c]);});
  p.gHi=rgb(mixc(p.a_gT,[255,255,255],0.28));
  p.gDk=rgb(mixc(p.a_gB,[0,0,0],0.18));
  p.treeDk=rgb(mixc(p.a_tree,[0,0,0],0.2));
  p.trunk=rgb(mixc([122,85,56],p.a_gB,p.night*0.7));
  return p;
}

/* ===== местность и мир ===== */
class Terrain{
  constructor(seed){
    this.rng=mulberry32(seed);
    this.pts=[{x:-1200,y:0},{x:-200,y:0},{x:380,y:0}];
    this.nextCrest=false;this.count=0;this.cursor=0;this.onSegment=null;this.bigPrev=false;
  }
  last(){return this.pts[this.pts.length-1];}
  extend(toX,p){while(this.last().x<toX)this.addPoint(p);}
  addPoint(p){
    const r=this.rng,a=this.last();this.count++;
    let L=lerp(500,680,p)*(0.8+r()*0.5),A=lerp(110,175,p)*(0.7+r()*0.6),big=false,giant=false;
    if(this.nextCrest&&this.count>12&&!this.bigPrev&&r()<0.055){giant=true;big=true;A*=2.0;L*=2.2;}else if(this.nextCrest&&this.count>4&&r()<0.22){big=true;A*=1.45;L*=1.3;}
    if(!this.nextCrest&&this.bigPrev){A*=1.2;L*=this.lastGiant?2.4:1.3;}
    const b={x:a.x+L,y:this.nextCrest?-A:A*0.9,crest:this.nextCrest,big,giant};
    this.bigPrev=big;this.lastGiant=giant;this.pts.push(b);this.nextCrest=!this.nextCrest;
    if(this.onSegment)this.onSegment(a,b,p,this.count);
  }
  find(x){
    const P=this.pts;let i=this.cursor;
    if(i>P.length-2)i=P.length-2;if(i<0)i=0;
    while(i<P.length-2&&P[i+1].x<x)i++;
    while(i>0&&P[i].x>x)i--;
    this.cursor=i;return i;
  }
  y(x){const i=this.find(x),a=this.pts[i],b=this.pts[i+1];let t=(x-a.x)/(b.x-a.x);t=t<0?0:t>1?1:t;return a.y+(b.y-a.y)*(1-Math.cos(Math.PI*t))/2;}
  slope(x){const i=this.find(x),a=this.pts[i],b=this.pts[i+1];let t=(x-a.x)/(b.x-a.x);t=t<0?0:t>1?1:t;return(b.y-a.y)*(Math.PI/2)*Math.sin(Math.PI*t)/(b.x-a.x);}
  angle(x){return Math.atan(this.slope(x));}
  prune(x){while(this.pts.length>8&&this.pts[2].x<x-2200){this.pts.shift();this.cursor=Math.max(0,this.cursor-1);}}
}

class World{
  constructor(seed){
    this.terrain=new Terrain(seed);
    this.obstacles=[];this.pickups=[];this.marks=[];
    this.terrain.onSegment=(a,b,p,n)=>this.spawn(a,b,p,n);
    this.terrain.extend(2800,0);
  }
  spawn(a,b,p,n){
    if(n<5)return;
    const T=this.terrain,r=T.rng,L=b.x-a.x,pp=Math.min(p,1.15);
    if(b.giant){
      this.marks.push({kind:'peak',x:b.x,y:b.y,hit:false});
      for(let k=0;k<9;k++){const x=b.x-220+k*55;this.pickups.push({x,y:T.y(x)-36,kind:'berry',got:false,ph:r()*6});}
      this.pickups.push({x:b.x,y:b.y-170,kind:'apple',got:false,ph:0});
    }else if(!b.crest&&!a.giant&&n>8&&r()<0.07){
      const tx=b.x;this.marks.push({kind:'tunnel',x:tx,w:140,hit:false});
      for(let k=0;k<5;k++){const x=tx-80+k*40;this.pickups.push({x,y:T.y(x)-34,kind:'berry',got:false,ph:r()*6});}
    }
    if(r()<0.2+0.45*pp){
      const q=r();
      const kind=q<0.32?'puddle':q<0.64?'rock':q<0.84?'snail':'log';
      const sz={rock:[22,24],log:[36,22],snail:[18,20],puddle:[46,0]}[kind];
      this.obstacles.push({x:a.x+L*(0.2+r()*0.6),kind,w:sz[0],h:sz[1],hit:false,dead:false,wob:0,ph:r()*6});
      if(pp>0.5&&r()<0.35)this.obstacles.push({x:a.x+L*(0.2+r()*0.6)+90,kind:'rock',w:22,h:24,hit:false,dead:false,wob:0,ph:r()*6});
    }
    if(b.crest&&r()<0.45){
      const cnt=4+Math.floor(r()*3),x0=a.x+L*0.28;
      for(let k=0;k<cnt;k++){const x=x0+k*46;this.pickups.push({x,y:T.y(x)-34,kind:'berry',got:false,ph:r()*6});}
    }else if(!b.crest&&r()<0.55){
      for(let k=0;k<7;k++){const x=a.x+L*0.08+k*52,h=130*(1-Math.pow((k-3)/3.4,2));this.pickups.push({x,y:a.y-70-h,kind:'berry',got:false,ph:r()*6});}
    }
    if(!b.crest&&r()<0.07)this.pickups.push({x:a.x+L*0.35,y:a.y-230,kind:'apple',got:false,ph:r()*6});
    if(r()<0.04){const x=a.x+L*0.5;this.pickups.push({x,y:T.y(x)-22,kind:'mush',got:false,ph:r()*6});}
    if(!b.crest&&r()<0.14){const x=a.x+L*0.8;this.pickups.push({x,y:T.y(x)-14,kind:'flower',got:false,ph:r()*6});}
    if(r()<0.08){const kind=['magnet','shield','feather'][(r()*3)|0],x=a.x+L*(0.3+r()*0.4);this.pickups.push({x,y:T.y(x)-130-r()*130,kind,got:false,ph:r()*6});}
    this.obstacles=this.obstacles.filter(o=>!this.marks.some(m=>m.kind==='tunnel'&&Math.abs(m.x-o.x)<m.w+90));
  }
  cull(x){
    this.obstacles=this.obstacles.filter(o=>o.x>x-1600&&!o.gone);
    this.pickups=this.pickups.filter(k=>k.x>x-1600&&!k.got);this.marks=this.marks.filter(m=>m.x>x-1800);
    this.terrain.prune(x);
  }
}

/* ===== звук (всё синтезируется Web Audio, по умолчанию выключен) ===== */
function makeAudio(save){
  let ctx=null,master=null,sg=null,mg=null,noiseBuf=null,mTimer=null,nextT=0,step=0;
  const st={sfx:!!save.sfx,music:!!save.music,tempo:0.38};
  function ensure(){
    if(!ctx){
      const AC=global.AudioContext||global.webkitAudioContext;if(!AC)return null;
      try{ctx=new AC();}catch(e){return null;}
      master=ctx.createGain();master.gain.value=0.9;master.connect(ctx.destination);
      sg=ctx.createGain();sg.gain.value=0.55;sg.connect(master);
      mg=ctx.createGain();mg.gain.value=0.16;mg.connect(master);
      noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
      const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }
    if(ctx.state==='suspended')ctx.resume();
    return ctx;
  }
  function tone(f,d,o){
    o=o||{};if(!ensure())return;
    const t0=ctx.currentTime+(o.delay||0),a=o.a||0.006,v=o.v||0.25;
    const osc=ctx.createOscillator(),g=ctx.createGain();
    osc.type=o.type||'sine';osc.frequency.setValueAtTime(f,t0);
    if(o.to)osc.frequency.exponentialRampToValueAtTime(o.to,t0+a+d);
    g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(v,t0+a);g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);
    osc.connect(g);g.connect(o.dest||sg);osc.start(t0);osc.stop(t0+a+d+0.05);
  }
  function noise(d,v,fc,delay){
    if(!ensure())return;
    const t0=ctx.currentTime+(delay||0),src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    src.buffer=noiseBuf;f.type='lowpass';f.frequency.value=fc||800;
    g.gain.setValueAtTime(v,t0);g.gain.exponentialRampToValueAtTime(0.0001,t0+d);
    src.connect(f);f.connect(g);g.connect(sg);src.start(t0,Math.random()*0.5);src.stop(t0+d+0.05);
  }
  const hz=(base,semi)=>base*Math.pow(2,semi/12);
  const SFX={
    click(){tone(700,0.04,{type:'square',v:0.05});},
    nope(){tone(200,0.12,{type:'square',to:150,v:0.08});},
    curl(){tone(260,0.09,{type:'triangle',to:430,v:0.1});},
    jump(){tone(300,0.18,{to:640,v:0.14});},puff(p){p=p||0;noise(0.2,0.08+0.1*p,1500);tone(240,0.16+0.1*p,{to:520+300*p,v:0.12});},
    flip(n){const f=hz(440,PENT[n%5]+12*Math.floor(n/5));tone(f,0.14,{type:'triangle',v:0.18});tone(f*2,0.1,{v:0.06,delay:0.02});},
    land(p){p=clamp(p||0.5,0.1,1);tone(150,0.14,{to:55,v:0.12+0.25*p});noise(0.09,0.1*p,500);},
    perfect(){tone(784,0.16,{v:0.14});tone(1175,0.18,{v:0.13,delay:0.07});tone(1568,0.24,{v:0.12,delay:0.14});},
    berry(k){const f=hz(660,PENT[k%5]+12*Math.min(1,Math.floor(k/5)));tone(f,0.1,{to:f*1.5,v:0.16});},
    apple(){tone(500,0.08,{to:300,v:0.2});tone(420,0.1,{to:250,v:0.18,delay:0.09});},
    mush(){[0,4,7,12].forEach((s,i)=>tone(hz(392,s),0.12,{type:'triangle',v:0.15,delay:i*0.06}));},
    flower(){tone(988,0.25,{v:0.1});tone(1319,0.3,{v:0.09,delay:0.1});},
    bonk(){tone(220,0.2,{type:'square',to:90,v:0.12});noise(0.1,0.14,900);},
    splash(){noise(0.22,0.13,1800);tone(500,0.1,{to:900,v:0.05});},
    yawn(){tone(420,1.3,{type:'triangle',to:140,v:0.16,a:0.25});tone(425,1.3,{type:'sine',to:142,v:0.1,a:0.25});},
    goal(){[0,4,7,12].forEach((s,i)=>tone(hz(523,s),0.2,{v:0.14,delay:i*0.09}));},
    unlock(){[0,5,9,12].forEach((s,i)=>tone(hz(392,s),0.22,{type:'triangle',v:0.15,delay:i*0.08}));}
  };
  function pluck(t,f,v){
    const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain();
    o.type='triangle';o2.type='sine';o.frequency.value=f;o2.frequency.value=f*2;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+0.005);g.gain.exponentialRampToValueAtTime(0.0001,t+0.9);
    o.connect(g);o2.connect(g);g.connect(mg);o.start(t);o2.start(t);o.stop(t+1);o2.stop(t+1);
  }
  function pad(t,f,len){
    [1,1.5].forEach(m=>{
      const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f*m;
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.05,t+len*0.4);g.gain.exponentialRampToValueAtTime(0.0001,t+len);
      o.connect(g);g.connect(mg);o.start(t);o.stop(t+len+0.1);
    });
  }
  function musicStep(t,i){
    const roots=[0,-3,-7,-5],bar=Math.floor(i/8)%4,root=roots[bar],minor=bar===1;
    const tones=minor?[0,3,7,12,15]:[0,4,7,12,16];
    if(i%8===0){pad(t,hz(261.63,root-12),st.tempo*8);pluck(t,hz(261.63,root-24),0.22);}
    if(Math.random()<0.78){const tn=tones[Math.floor(Math.random()*tones.length)];pluck(t,hz(261.63,root+tn+(Math.random()<0.4?12:0)),0.13);}
  }
  function musicTick(){
    if(!ctx||!st.music)return;
    while(nextT<ctx.currentTime+0.4){musicStep(nextT,step);nextT+=st.tempo;step++;}
  }
  return{
    state:st,
    sfx(name,a){if(!st.sfx)return;const f=SFX[name];if(f){try{f(a);}catch(e){}}},
    setSfx(on){st.sfx=!!on;if(on){ensure();SFX.click();}},
    setMusic(on){
      st.music=!!on;
      if(on){if(!ensure())return;if(!mTimer){nextT=ctx.currentTime+0.1;step=0;mTimer=setInterval(musicTick,100);}}
      else if(mTimer){clearInterval(mTimer);mTimer=null;}
    },
    setTempo(p){st.tempo=lerp(0.40,0.27,clamp(p,0,1));},
    resume(){if(ctx&&ctx.state==='suspended')ctx.resume();},
    destroy(){if(mTimer){clearInterval(mTimer);mTimer=null;}if(ctx){try{ctx.close();}catch(e){}ctx=null;}}
  };
}
/* ===== рисование: ёжик (по мотивам эмодзи 🦔), шляпы, предметы ===== */
// Правка поверх оригинала: farProps иногда даёт r < 0, arc() бросает IndexSizeError и кадр обрывается
function circ(ctx,x,y,r){if(!(r>0))return;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function ell(ctx,x,y,rx,ry,rot){ctx.beginPath();ctx.ellipse(x,y,Math.max(0.01,rx),Math.max(0.01,ry),rot||0,0,TAU);ctx.fill();}
function starPath(ctx,x,y,r){
  ctx.beginPath();
  for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*0.4:r;ctx[i?'lineTo':'moveTo'](x+Math.cos(a)*rr,y+Math.sin(a)*rr);}
  ctx.closePath();
}
function spikeRow(ctx,n,span,center,r0,len,color,rot,seed){
  ctx.fillStyle=color;
  const full=span>=TAU-0.01,stepA=n>1?span/(full?n:n-1):0,d=Math.max(0.05,(stepA||0.3)*0.62);
  for(let i=0;i<n;i++){
    const a=center+(full?i*stepA:(i/(n-1)-0.5)*span)+rot,l=len*(0.78+0.44*hash1(i*7+seed));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a-d)*r0,Math.sin(a-d)*r0);
    ctx.lineTo(Math.cos(a)*(r0+l),Math.sin(a)*(r0+l));
    ctx.lineTo(Math.cos(a+d)*r0,Math.sin(a+d)*r0);
    ctx.closePath();ctx.fill();
  }
}
function drawHat(ctx,id,R){
  ctx.save();
  if(id==='party'){
    ctx.fillStyle='#ff77b4';ctx.beginPath();ctx.moveTo(-0.3*R,0);ctx.lineTo(0.3*R,0);ctx.lineTo(0.02*R,-0.85*R);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#ffe066';ctx.lineWidth=0.07*R;
    for(let k=1;k<4;k++){const y=-k*0.2*R,w=0.3*R*(1-k*0.22);ctx.beginPath();ctx.moveTo(-w,y+0.04*R);ctx.lineTo(w,y-0.02*R);ctx.stroke();}
    ctx.fillStyle='#ffe066';circ(ctx,0.02*R,-0.88*R,0.12*R);
  }else if(id==='flower'){
    ctx.fillStyle='#6fbf6a';ell(ctx,0,0.02*R,0.5*R,0.1*R,0);
    const cols=['#ff8fb8','#fff3a0','#ffb347','#b6a0ff','#ff8fb8'];
    for(let i=0;i<5;i++){const x=-0.4*R+i*0.2*R,y=-0.05*R-0.1*R*Math.sin(i/4*Math.PI);ctx.fillStyle=cols[i];circ(ctx,x,y,0.12*R);ctx.fillStyle='#ffd84a';circ(ctx,x,y,0.05*R);}
  }else if(id==='beret'){
    ctx.fillStyle='#c8445a';ell(ctx,0.04*R,-0.1*R,0.55*R,0.24*R,-0.1);
    ctx.fillStyle='#e0647a';ell(ctx,-0.1*R,-0.16*R,0.3*R,0.1*R,-0.1);
    ctx.fillStyle='#8f2c40';circ(ctx,0.16*R,-0.34*R,0.06*R);
  }else if(id==='top'){
    ctx.fillStyle='#2b2b33';ctx.beginPath();ctx.rect(-0.3*R,-0.66*R,0.6*R,0.62*R);ctx.fill();
    ctx.fillStyle='#202026';ell(ctx,0,0,0.5*R,0.11*R,0);
    ctx.fillStyle='#d04a5a';ctx.fillRect(-0.3*R,-0.18*R,0.6*R,0.12*R);
    ctx.fillStyle='#3a3a46';ell(ctx,0,-0.66*R,0.3*R,0.07*R,0);
  }else if(id==='cap'){
    ctx.fillStyle='#e04b45';ctx.beginPath();ctx.arc(0,0,0.55*R,Math.PI,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';circ(ctx,-0.25*R,-0.2*R,0.09*R);circ(ctx,0.1*R,-0.33*R,0.1*R);circ(ctx,0.32*R,-0.15*R,0.07*R);
  }else if(id==='crown'){
    ctx.fillStyle='#ffcf40';ctx.strokeStyle='#d99a1f';ctx.lineWidth=0.04*R;
    ctx.beginPath();ctx.moveTo(-0.36*R,0);ctx.lineTo(-0.36*R,-0.42*R);ctx.lineTo(-0.18*R,-0.2*R);ctx.lineTo(0,-0.5*R);ctx.lineTo(0.18*R,-0.2*R);ctx.lineTo(0.36*R,-0.42*R);ctx.lineTo(0.36*R,0);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#e8465a';circ(ctx,0,-0.5*R,0.06*R);ctx.fillStyle='#4aa8ff';circ(ctx,-0.36*R,-0.42*R,0.05*R);circ(ctx,0.36*R,-0.42*R,0.05*R);
  }
  ctx.restore();
}
/* o: curl, leg, run, roll, hat, blink, sleepy, dizzy, t */
function drawHog(ctx,R,o){
  const curl=o.curl||0,face=1-clamp(curl*1.7,0,1),hat=o.hat||'none';
  if(face>0.02){
    ctx.save();ctx.globalAlpha=face;
    const run=o.run===undefined?1:o.run,ph=o.leg||0;
    for(let i=0;i<2;i++){
      const s=Math.sin(ph+i*Math.PI),c=Math.cos(ph+i*Math.PI);
      const fx=(i?0.5:-0.12)*R+s*0.26*R*run,fy=0.9*R-Math.max(0,c)*0.2*R*run;
      ctx.fillStyle='#b98a5d';ell(ctx,fx,fy+0.02*R,0.22*R,0.14*R,0);
      ctx.fillStyle='#efc99a';ell(ctx,fx,fy,0.2*R,0.12*R,0);
    }
    ctx.restore();
  }
  const n=Math.round(lerp(15,26,curl)),span=lerp(3.5,TAU,curl),center=Math.PI+0.3*(1-curl),rot=(o.roll||0)*curl;
  spikeRow(ctx,n,span,center,0.86*R,0.38*R,'#5b3d2b',rot,0);
  spikeRow(ctx,n,span,center+(span>=TAU-0.01?TAU/n/2:span/(n-1)/2),0.84*R,0.27*R,'#8b6240',rot,5);
  const g=ctx.createRadialGradient(-0.3*R,-0.4*R,0.1*R,0,0,R);
  g.addColorStop(0,'#a37850');g.addColorStop(1,'#6e4a31');
  ctx.fillStyle=g;circ(ctx,0,0,0.93*R);
  if(curl>0.3){
    ctx.save();ctx.globalAlpha=clamp((curl-0.3)*1.4,0,1);ctx.rotate(rot);
    ctx.strokeStyle='rgba(255,220,170,0.35)';ctx.lineWidth=0.06*R;ctx.lineCap='round';
    for(let i=0;i<5;i++){const a=i*1.26;ctx.beginPath();ctx.arc(0,0,0.62*R,a,a+0.55);ctx.stroke();}
    ctx.restore();
  }
  if(face>0.02){
    ctx.save();ctx.globalAlpha=face;
    ctx.save();ctx.beginPath();ctx.arc(0,0,0.93*R,0,TAU);ctx.clip();
    ctx.fillStyle='#f0cfa1';ell(ctx,0.35*R,0.62*R,0.95*R,0.55*R,-0.15);ctx.restore();
    ctx.fillStyle='#f6d9b0';ell(ctx,0.62*R,0.12*R,0.52*R,0.46*R,0.12);
    ctx.fillStyle='#e8bf8d';circ(ctx,0.12*R,-0.42*R,0.2*R);ctx.fillStyle='#f3a7a0';circ(ctx,0.14*R,-0.4*R,0.11*R);
    const ex=0.58*R,ey=-0.06*R,bl=o.sleepy?0.25:(1-(o.blink||0));
    if(o.sleepy>=1||bl<0.15){ctx.strokeStyle='#2a1c16';ctx.lineWidth=0.06*R;ctx.lineCap='round';ctx.beginPath();ctx.arc(ex,ey+0.02*R,0.1*R,0.15,Math.PI-0.15);ctx.stroke();}
    else{ctx.fillStyle='#1f1612';ell(ctx,ex,ey,0.1*R,0.11*R*bl,0);if(bl>0.5){ctx.fillStyle='#fff';circ(ctx,ex+0.035*R,ey-0.04*R,0.035*R);}}
    ctx.fillStyle='rgba(255,130,150,0.5)';ell(ctx,0.62*R,0.3*R,0.14*R,0.09*R,0);
    ctx.fillStyle='#2b1d18';circ(ctx,1.08*R,0.14*R,0.14*R);ctx.fillStyle='rgba(255,255,255,0.7)';circ(ctx,1.04*R,0.09*R,0.04*R);
    ctx.strokeStyle='#7a4a30';ctx.lineWidth=0.035*R;ctx.lineCap='round';ctx.beginPath();ctx.arc(0.9*R,0.2*R,0.14*R,0.5,1.9);ctx.stroke();
    if(hat==='glasses'){
      ctx.strokeStyle='#222';ctx.lineWidth=0.05*R;ctx.beginPath();ctx.moveTo(0.4*R,-0.12*R);ctx.lineTo(0.05*R,-0.26*R);ctx.stroke();
      ctx.fillStyle='#1d1d26';ell(ctx,0.58*R,-0.05*R,0.22*R,0.17*R,0.1);ctx.fillStyle='rgba(255,255,255,0.55)';ell(ctx,0.52*R,-0.1*R,0.07*R,0.04*R,-0.4);
    }else if(hat!=='none'){
      ctx.save();ctx.translate(0.36*R,-0.8*R);ctx.rotate(0.22);drawHat(ctx,hat,R);ctx.restore();
    }
    if(o.dizzy){
      ctx.fillStyle='#ffe066';
      for(let i=0;i<3;i++){const a=(o.t||0)*4+i*TAU/3;starPath(ctx,0.3*R+Math.cos(a)*0.5*R,-1.2*R+Math.sin(a)*0.15*R,0.14*R);ctx.fill();}
    }
    ctx.restore();
  }
}

/* ===== предметы мира ===== */
function drawObstacle(ctx,o,T,pal,clock){
  const gy=T.y(o.x),a=T.angle(o.x);
  ctx.save();ctx.translate(o.x,gy);ctx.rotate(a);
  const dark=pal.night*0.55;
  const col=(c)=>rgb(mixc(hex(c),[20,25,60],dark));
  if(o.wob>0)ctx.rotate(Math.sin(clock*30)*0.1*o.wob);
  if(o.kind==='rock'){
    ctx.fillStyle=col('#8d8a99');ctx.beginPath();ctx.moveTo(-22,2);ctx.quadraticCurveTo(-24,-20,-6,-24);ctx.quadraticCurveTo(14,-28,22,-6);ctx.quadraticCurveTo(24,0,22,2);ctx.closePath();ctx.fill();
    ctx.fillStyle=col('#a9a6b6');ell(ctx,-6,-14,8,5,-0.4);
  }else if(o.kind==='log'){
    ctx.fillStyle=col('#9a6a43');ctx.beginPath();ctx.roundRect?ctx.roundRect(-36,-22,72,24,10):ctx.rect(-36,-22,72,24);ctx.fill();
    ctx.fillStyle=col('#c8935f');ell(ctx,33,-10,6,11,0);ctx.strokeStyle=col('#8a5a36');ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(33,-10,3.5,7,0,0,TAU);ctx.stroke();
    ctx.strokeStyle=col('#7d5130');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-26,-14);ctx.lineTo(10,-14);ctx.stroke();
  }else if(o.kind==='snail'){
    const wig=Math.sin(clock*3+o.ph)*2;
    ctx.fillStyle=col('#d8c3a5');ell(ctx,0,-5,18,6,0);circ(ctx,14,-9,5);
    ctx.strokeStyle=col('#d8c3a5');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(15,-12);ctx.lineTo(17+wig,-20);ctx.moveTo(12,-12);ctx.lineTo(11+wig,-20);ctx.stroke();
    ctx.fillStyle=col('#e9a46a');circ(ctx,-3,-14,12);ctx.strokeStyle=col('#b9743a');ctx.lineWidth=2;ctx.beginPath();ctx.arc(-3,-14,6,0,TAU*0.8);ctx.stroke();
  }else if(o.kind==='puddle'){
    ctx.fillStyle=rgb(mixc([143,208,245],[30,45,100],dark),0.75);ell(ctx,0,2,o.w,6,0);
    ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(-8+Math.sin(clock*2+o.ph)*3,2,12,3,0,0,TAU);ctx.stroke();
  }
  ctx.restore();
}
// Правка поверх оригинала: значки бонусов, ягод и сна рисуются векторно (раньше — эмодзи, разные на каждой ОС)
function drawGlyph(ctx,kind,x,y,s,col){
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';ctx.lineJoin='round';
  if(kind==='magnet'){
    ctx.strokeStyle=col;ctx.lineWidth=s*0.5;ctx.beginPath();ctx.arc(0,-s*0.05,s*0.55,Math.PI,0,true);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-s*0.55,-s*0.05);ctx.lineTo(-s*0.55,-s*0.75);ctx.moveTo(s*0.55,-s*0.05);ctx.lineTo(s*0.55,-s*0.75);ctx.stroke();
    ctx.strokeStyle='#cfd6e6';ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(-s*0.55,-s*0.62);ctx.lineTo(-s*0.55,-s*0.95);ctx.moveTo(s*0.55,-s*0.62);ctx.lineTo(s*0.55,-s*0.95);ctx.stroke();
    ctx.translate(0,s*0.3);
  }else if(kind==='shield'){
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(s*0.85,-s*0.65);ctx.quadraticCurveTo(s*0.85,s*0.45,0,s);ctx.quadraticCurveTo(-s*0.85,s*0.45,-s*0.85,-s*0.65);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=s*0.16;ctx.beginPath();ctx.moveTo(-s*0.35,0);ctx.lineTo(-s*0.05,s*0.3);ctx.lineTo(s*0.4,-s*0.25);ctx.stroke();
  }else if(kind==='feather'){
    ctx.rotate(-0.6);ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,-s);ctx.quadraticCurveTo(s*0.7,-s*0.2,0,s*0.75);ctx.quadraticCurveTo(-s*0.7,-s*0.2,0,-s);ctx.fill();
    ctx.strokeStyle='rgba(90,70,30,0.6)';ctx.lineWidth=s*0.1;ctx.beginPath();ctx.moveTo(0,-s*0.8);ctx.lineTo(0,s);ctx.stroke();
  }else if(kind==='boost'){
    ctx.fillStyle='#f3e7d3';ctx.fillRect(-s*0.25,-s*0.1,s*0.5,s*0.9);
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,s*0.85,Math.PI,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';circ(ctx,-s*0.35,-s*0.35,s*0.14);circ(ctx,s*0.25,-s*0.5,s*0.12);
  }else if(kind==='berry'){
    ctx.fillStyle=col;circ(ctx,0,s*0.15,s*0.75);ctx.fillStyle='rgba(255,255,255,0.55)';circ(ctx,-s*0.25,-s*0.1,s*0.2);
    ctx.fillStyle='#4caf50';ctx.beginPath();ctx.moveTo(0,-s*0.55);ctx.lineTo(-s*0.55,-s*0.95);ctx.lineTo(0,-s*0.75);ctx.lineTo(s*0.55,-s*0.95);ctx.closePath();ctx.fill();
  }else if(kind==='moon'){
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,s*0.8,0,TAU);ctx.arc(s*0.4,-s*0.3,s*0.7,0,TAU,true);ctx.fill('evenodd');
  }
  ctx.restore();
}
function drawPickup(ctx,k,clock){
  const bob=Math.sin(clock*3+k.ph)*3;
  ctx.save();ctx.translate(k.x,k.y+bob);
  if(k.kind==='magnet'||k.kind==='shield'||k.kind==='feather'){
    const col={magnet:'#ff6b81',shield:'#6bb8ff',feather:'#ffd84a'}[k.kind];
    ctx.globalAlpha=0.3;ctx.fillStyle=col;circ(ctx,0,0,27+Math.sin(clock*4)*3);ctx.globalAlpha=1;
    ctx.fillStyle='#fff';circ(ctx,0,0,17);ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,17,0,TAU);ctx.stroke();
    drawGlyph(ctx,k.kind,0,0,10,col);
  }else if(k.kind==='berry'){
    ctx.fillStyle='rgba(232,70,124,0.25)';circ(ctx,0,0,13);
    ctx.fillStyle='#e8467c';circ(ctx,0,0,8.5);ctx.fillStyle='#ff9cc0';circ(ctx,-2.5,-3,2.6);
    ctx.fillStyle='#4caf50';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-5,-11);ctx.lineTo(0,-9);ctx.lineTo(5,-11);ctx.closePath();ctx.fill();
  }else if(k.kind==='apple'){
    ctx.fillStyle='rgba(255,90,90,0.25)';circ(ctx,0,0,20);
    ctx.fillStyle='#e0393a';circ(ctx,-3.5,0,11);circ(ctx,3.5,0,11);ctx.fillStyle='#ff8a8a';circ(ctx,-6,-4,3);
    ctx.strokeStyle='#6b4a2b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(1,-15);ctx.stroke();
    ctx.fillStyle='#4caf50';ell(ctx,6,-13,6,3,-0.5);
  }else if(k.kind==='mush'){
    ctx.fillStyle='rgba(255,210,70,0.3)';circ(ctx,0,0,20);
    ctx.fillStyle='#f6e6d0';ctx.fillRect(-4,-2,8,12);ctx.fillStyle='#ffc233';ctx.beginPath();ctx.arc(0,-2,13,Math.PI,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';circ(ctx,-5,-8,2.5);circ(ctx,3,-10,3);circ(ctx,8,-4,2);
  }else if(k.kind==='flower'){
    ctx.strokeStyle='#4caf50';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(0,14);ctx.lineTo(0,2);ctx.stroke();
    ctx.fillStyle='#ff8fc0';for(let i=0;i<5;i++){const a=i*TAU/5+clock*0.5;circ(ctx,Math.cos(a)*7,Math.sin(a)*7-2,5.5);}
    ctx.fillStyle='#ffd84a';circ(ctx,0,-2,4);
  }
  ctx.restore();
}
function drawDeco(ctx,kind,x,y,ang,s,pal,clock,seed){
  ctx.save();ctx.translate(x,y+2);ctx.rotate(ang);
  const dk=pal.night*0.5,c=h=>rgb(mixc(hex(h),[25,30,70],dk));
  if(kind==='tuft'){
    ctx.strokeStyle=pal.gHi;ctx.lineWidth=2.4*s;ctx.lineCap='round';
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*4*s,0);ctx.quadraticCurveTo(i*6*s,-8*s,i*9*s+Math.sin(clock*2+seed)*1.5,-14*s);ctx.stroke();}
  }else if(kind==='flower'){
    const cols=['#ff9cc6','#fff3a0','#ffb347','#c3b1ff'],cc=c(cols[(((seed|0)%4)+4)%4]);
    ctx.strokeStyle=pal.gHi;ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-13*s);ctx.stroke();
    ctx.fillStyle=cc;for(let i=0;i<5;i++){const a=i*TAU/5;circ(ctx,Math.cos(a)*4*s,-13*s+Math.sin(a)*4*s,3.2*s);}
    ctx.fillStyle=c('#ffd84a');circ(ctx,0,-13*s,2.4*s);
  }else if(kind==='mush'){
    ctx.fillStyle=c('#f1e2cc');ctx.fillRect(-2.5*s,-9*s,5*s,9*s);
    ctx.fillStyle=pal.biome===3?'#ff7fb0':c('#e0584d');ctx.beginPath();ctx.arc(0,-9*s,8*s,Math.PI,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.85)';circ(ctx,-3*s,-12*s,1.6*s);circ(ctx,3*s,-13*s,1.3*s);
  }else if(kind==='leaf'){
    ctx.fillStyle=c(seed%2?'#e9822f':'#d65a2a');ell(ctx,0,-2*s,6*s,2.6*s,0.3);ell(ctx,7*s,-2*s,5*s,2.2*s,-0.4);
  }else if(kind==='pebble'){
    ctx.fillStyle=c('#9a96a8');ell(ctx,0,-3*s,6*s,4*s,0);ctx.fillStyle=c('#b6b2c4');ell(ctx,-1.5*s,-4.5*s,2.5*s,1.5*s,0);
  }
  ctx.restore();
}

/* ===== игра ===== */
const GA=G*0.85;
const FAR={par:0.12,base:0.58,a1:34,f1:0.0042,a2:56,f2:0.0013,ph:0.4};
const MID={par:0.28,base:0.70,a1:24,f1:0.0058,a2:34,f2:0.0021,ph:1.2};
const DECO={0:['tuft','flower'],1:['tuft','flower','flower'],2:['leaf','mush','tuft'],3:['mush','mush','tuft'],4:['tuft','pebble','flower'],5:['tuft','flower','pebble']};
const AMB={0:['dust','#fff4cc'],1:['petal','#ffb6d0'],2:['leaf','#e8903a'],3:['spore','#e9d4ff'],4:['dust','#ffe2b0'],5:['firefly','#fff29a']};
const COMBO_MSG=['Ёжик в ударе!','Колючая магия!','Это вообще легально?!','Мама, смотри без лап!','Иголки дрожат от восторга!','Ёжик-легенда!','Белки аплодируют стоя!','Физика обиделась!'];
const MS={42:'42 м — ответ на всё!',100:'100 м! Привет, M3102',314:'π метров! 3,14…',1337:'1337 м — l33t-ёж'};
const FONT='"Inter Variable",Inter,system-ui,-apple-system,"Segoe UI",sans-serif';
/* Правка поверх оригинала: интерфейс в стиле сайта М3102 — иконки lucide вместо эмодзи, шрифт Inter */
const ICONS={
  play:'<polygon points="6 3 20 12 6 21 6 3"/>',
  pause:'<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  sound:'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  mute:'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  full:'<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  again:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  back:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  berry:'<path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"/><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"/>',
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'
};
const ic=n=>'<svg class="hh-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[n]+'</svg>';
/* Правка поверх оригинала: значки предметов в меню — SVG-копии того, что игра рисует на холсте (drawPickup/drawGlyph),
   чтобы в подсказках была та же ягода, тот же щит и магнит, что и в забеге */
const GLYPHS={
  berry:['-12 -13 24 24','<circle r="8.5" fill="#e8467c"/><circle cx="-2.5" cy="-3" r="2.6" fill="#ff9cc0"/><path d="M0-7-5-11 0-9 5-11Z" fill="#4caf50"/>'],
  apple:['-16 -18 32 32','<circle cx="-3.5" r="11" fill="#e0393a"/><circle cx="3.5" r="11" fill="#e0393a"/><circle cx="-6" cy="-4" r="3" fill="#ff8a8a"/><path d="M0-9 1-15" stroke="#6b4a2b" stroke-width="2"/><ellipse cx="6" cy="-13" rx="6" ry="3" transform="rotate(-28.6 6 -13)" fill="#4caf50"/>'],
  shield:['-12 -12 24 24','<path d="M0-10 8.5-6.5Q8.5 4.5 0 10-8.5 4.5-8.5-6.5Z" fill="#6bb8ff"/><path d="M-3.5 0-.5 3 4-2.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'],
  magnet:['-12 -12 24 24','<g transform="translate(0 3)"><path d="M-5.5-7.5V-.5A5.5 5.5 0 0 0 5.5-.5V-7.5" fill="none" stroke="#ff6b81" stroke-width="5" stroke-linecap="round"/><path d="M-5.5-6.2V-9.5M5.5-6.2V-9.5" stroke="#cfd6e6" stroke-width="5"/></g>'],
  feather:['-12 -12 24 24','<g transform="rotate(-34.4)"><path d="M0-10Q7-2 0 7.5-7-2 0-10Z" fill="#ffd84a"/><path d="M0-8V10" stroke="rgba(90,70,30,.6)" stroke-width="1"/></g>']
};
const gl=n=>'<svg class="hh-gl" viewBox="'+GLYPHS[n][0]+'" aria-hidden="true">'+GLYPHS[n][1]+'</svg>';
const ARROW={up:'<path d="m18 15-6-6-6 6"/>',left:'<path d="m15 18-6-6 6-6"/>',right:'<path d="m9 18 6-6-6-6"/>',down:'<path d="m6 9 6 6 6-6"/>'};
const key=k=>'<kbd class="hh-key">'+(ARROW[k]?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ARROW[k]+'</svg>':k)+'</kbd>';


class Game{
  constructor(canvas,opts){
    this.cv=canvas;this.ctx=canvas.getContext('2d');
    this.save=opts.save;this.audio=opts.audio;this.cb=opts.cb||{};
    this.W=640;this.H=420;this.dpr=1;this.clock=0;this.acc=0;
    this.input={keys:new Set(),pointer:false,pointerX:0.5};
    this.reduce=!!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.cam={x:0,y:0,zoom:0.8,init:false,roll:0,vA:0};this.spd=0;
    const r=mulberry32(77);
    this.stars=[];for(let i=0;i<80;i++)this.stars.push({x:r(),y:r()*0.55,r:0.6+r()*1.4,ph:r()*6});
    this.clouds=[];for(let i=0;i<7;i++)this.clouds.push({x:r()*1400,y:0.06+r()*0.3,s:0.7+r()*0.8,sp:6+r()*8});
    this.amb=[];for(let i=0;i<30;i++)this.amb.push({x:r(),y:r(),ph:r()*6,sz:0.6+r()*0.8,vx:0.3+r()*0.5,vy:0.2+r()*0.4});
    this.state='menu';this.begin(true);
  }
  resize(w,h,dpr){
    this.W=Math.max(200,w);this.H=Math.max(200,h);this.dpr=dpr||1;
    this.cv.width=Math.round(this.W*this.dpr);this.cv.height=Math.round(this.H*this.dpr);
  }
  newHog(){
    return{x:100,y:0,a:0,s:260,onGround:true,cx:0,cy:0,vx:0,vy:0,air:0,curl:0,curlT:0,squash:0,flipAng:0,flipRemain:0,flips:0,roll:0,leg:0,
      inv:0,stumbleT:0,sniffT:0,blink:0,blinkT:2,dust:0,berryStreak:0,berryT:0,boostT:0,charge:0,holdT:0,was:false,jcd:0,mag:0,shd:0,fea:0,takeX:0,spaced:false};
  }
  begin(menu){
    this.world=new World((Math.random()*1e9)|0);
    this.hog=this.newHog();this.hog.y=this.world.terrain.y(this.hog.x);
    this.t=0;this.tod=menu?90:0;this.score=0;this.trick=0;this.dist=0;this.distInt=0;this.combo=0;this.comboT=0;this.sleep=0;
    this.run={flips:0,perfect:0,stumbles:0,berries:0,apples:0,maxCombo:0};
    this.fx=[];this.texts=[];this.banners=[];this.shake=0;this.life=[];this.lifeT=1;this.zk=0;this.flash=0;this.rainT=0;this.ms={};this.dieT=0;this.cullT=0;this.saveT=0;this.timeInt=0;
    this.biome=-1;this.cam.init=false;this.pal=getPal(this.tod);this.prog=0;
  }
  start(){
    this.begin(false);this.state='play';this.biome=-1;
    this.audio.setTempo(0);
    if(this.cb.onState)this.cb.onState('play');
  }
  toMenu(){this.begin(true);this.state='menu';if(this.cb.onState)this.cb.onState('menu');}
  pause(){if(this.state==='play'){this.state='paused';this.input.keys.clear();this.input.pointer=false;persist(this.save);if(this.cb.onState)this.cb.onState('paused');}}
  resume(){if(this.state==='paused'){this.state='play';if(this.cb.onState)this.cb.onState('play');}}
  holding(){return this.input.keys.size>0||this.input.pointer;}
  downHeld(){const k=this.input.keys;return k.has('ArrowDown')||k.has('KeyS');}
  flipDir(){
    const k=this.input.keys;
    if(this.input.pointer)return this.input.pointerX<0.5?-1:1;
    const L=k.has('ArrowLeft')||k.has('KeyA'),Rr=k.has('ArrowRight')||k.has('KeyD');
    if(Rr&&!L)return 1;if(L)return -1;
    if(k.has('Space')||k.has('ArrowUp')||k.has('KeyW'))return -1;
    return 0;
  }
  mult(){return 1+this.combo;}
  center(h){return h.onGround?{x:h.x+Math.sin(h.a)*R,y:h.y-Math.cos(h.a)*R}:{x:h.cx,y:h.cy};}
  addBanner(txt){this.banners.push({txt,t:0});}

  /* --- ежедневные цели --- */
  dayAdd(id,n){const g=this.save.daily.goals.find(x=>x.id===id);if(!g||g.done)return;g.prog+=n;this.goalCheck(g);}
  dayMax(id,v){const g=this.save.daily.goals.find(x=>x.id===id);if(!g||g.done)return;if(v>g.prog)g.prog=v;this.goalCheck(g);}
  goalCheck(g){
    if(g.prog<g.target)return;
    g.done=true;g.prog=g.target;this.save.berries+=GOAL_REWARD;this.save.goalsDone=(this.save.goalsDone||0)+1;
    this.addBanner('Цель: '+goalDef(g.id).text(g.target)+' · +'+GOAL_REWARD+' ягод');this.audio.sfx('goal');persist(this.save);
  }

  /* --- эффекты --- */
  burst(x,y,n,o){
    o=o||{};
    for(let i=0;i<n;i++){
      const a=o.a0!==undefined?lerp(o.a0,o.a1,Math.random()):Math.random()*TAU,sp=(o.sp||120)*(0.4+Math.random()*0.8);
      this.fx.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0,max:(o.life||0.6)*(0.7+Math.random()*0.6),size:(o.size||4)*(0.7+Math.random()*0.6),col:o.col||'#fff',type:o.type||'dot',g:o.g===undefined?500:o.g,rot:Math.random()*TAU});
    }
  }
  text(x,y,txt,col,size){size=size||22;for(const o of this.texts){if(o.life<0.7&&Math.abs(o.x-x)<170&&Math.abs(o.y-y)<size*1.5)y=o.y-size*1.5;}this.texts.push({x,y,life:0,max:1.3,txt,col:col||'#fff',size});}

  /* --- физика --- */
  step(dt){
    const h=this.hog,T=this.world.terrain;
    if(this.state==='menu'){this.tod+=dt*6;h.blinkT-=dt;if(h.blinkT<=0){h.blink=1;h.blinkT=2+Math.random()*3;}h.blink=Math.max(0,h.blink-dt*8);return;}
    if(this.state==='paused'||this.state==='over')return;
    const dying=this.state==='dying';
    this.t+=dt;this.tod+=dt;
    const p=this.prog=Math.min(this.t/600,1.15),pc=Math.min(p,1);
    this.world.terrain.extend(h.x+2800,p);
    if(dying){this.dieT+=dt;if(this.dieT>2.0){this.finish();return;}}
    const hold=!dying&&h.stumbleT<=0&&this.holding();
    if(h.jcd>0)h.jcd-=dt;
    if(hold)h.holdT+=dt;
    if(h.onGround&&h.was&&!hold&&!dying&&h.stumbleT<=0&&h.jcd<=0)this.jump();
    if(!hold&&h.onGround)h.holdT=0;
    h.was=hold;
    if(h.onGround){
      const a=h.a,sa=Math.sin(a);
      h.s+=(sa>0?G*sa*(hold?1.9:1):G*sa*(hold?0.9:0.35))*dt;
      if(hold&&sa<0.03)h.s-=h.s*0.35*dt;
      if(!dying){
        const vmin=lerp(220,320,pc),vcap=lerp(480,820,pc)+(h.boostT>0?160:0);
        if(h.s<vmin)h.s+=(vmin-h.s)*Math.min(1,2.2*dt);
        else if(h.s>vcap)h.s-=(h.s-vcap)*Math.min(1,1.6*dt);
      }else h.s=Math.max(0,h.s-(h.s*2.4+30)*dt);
      h.curlT=(hold||dying||h.stumbleT>0)?1:0;
      const vx=h.s*Math.cos(a),vy=h.s*Math.sin(a),nx=h.x+vx*dt,gy=T.y(nx),byb=h.y+vy*dt+0.5*GA*dt*dt;
      if(!dying&&h.s>140&&gy>byb+0.002)this.takeoff(vx,vy);
      else{h.x=nx;h.y=gy;h.a=T.angle(nx);}
      h.roll+=h.s*dt/R;h.leg+=h.s*dt/(R*1.5);
      h.dust-=dt;
      if(h.curl>0.5&&h.s>260&&h.dust<=0&&!this.reduce){h.dust=0.06;this.burst(h.x,h.y-2,1,{a0:-Math.PI*0.95,a1:-Math.PI*0.6,sp:60,life:0.4,size:3,col:'rgba(255,255,255,0.6)',g:-40});}
    }else{
      const down=!dying&&this.downHeld();
      h.vy+=(down?G*1.6:GA*(h.fea>0?0.55:1))*dt;if(h.fea>0&&Math.random()<0.02)this.burst(h.cx,h.cy+R*0.5,1,{type:'petal',col:'#fff3a8',size:3,sp:30,life:0.8,g:-20});if(!h.spaced&&T.y(h.cx)-h.cy>700){h.spaced=true;this.addBanner('Привет, космос!');this.burst(h.cx,h.cy,14,{type:'star',col:'#fff',size:6,sp:260,life:0.9,g:0});this.zk=-0.08;}h.cx+=h.vx*dt;h.cy+=h.vy*dt;h.air+=dt;h.leg+=dt*14;
      let flipping=h.flipRemain!==0;
      if(!dying&&h.stumbleT<=0){
        const fd=this.flipDir();
        if(fd!==0&&Math.abs(h.flipRemain)<0.35){if(h.flipRemain!==0){h.flipAng+=h.flipRemain;h.flipRemain=0;this.flipDone(h.flipAng<0);}h.flipRemain=fd*TAU;if(!flipping)this.audio.sfx('curl');}
      }
      if(h.flipRemain!==0){
        const st=Math.sign(h.flipRemain)*Math.min(Math.abs(h.flipRemain),(TAU/0.5)*dt);
        h.flipAng+=st;h.flipRemain-=st;
        if(Math.abs(h.flipRemain)<1e-6){h.flipRemain=0;this.flipDone(h.flipAng<0);}
        flipping=true;
      }else h.flipAng-=TAU*Math.round(h.flipAng/TAU);
      h.curlT=(flipping||down||dying)?1:0;
      if((h.vy>0||h.air>0.08)&&h.cy+R*0.92>=T.y(h.cx))this.land();
    }
    h.curl+=(h.curlT-h.curl)*Math.min(1,dt*18);
    h.squash+=(0-h.squash)*Math.min(1,dt*9);
    h.blinkT-=dt;if(h.blinkT<=0){h.blink=1;h.blinkT=2+Math.random()*3;}h.blink=Math.max(0,h.blink-dt*8);
    if(h.inv>0)h.inv-=dt;if(h.stumbleT>0)h.stumbleT-=dt;if(h.sniffT>0)h.sniffT-=dt;if(h.boostT>0)h.boostT-=dt;if(h.mag>0)h.mag-=dt;if(h.fea>0)h.fea-=dt;if(h.boostT>0&&!this.reduce&&Math.random()<0.04){const c0=this.center(h);this.burst(c0.x-20,c0.y,1,{type:'star',col:'#ffe066',size:4,sp:40,life:0.4,g:0});}
    h.berryT-=dt;if(h.berryT<=0)h.berryStreak=0;
    if(dying)return;
    // препятствия
    const c=this.center(h);
    for(const o of this.world.obstacles){
      if(o.dead)continue;
      const dx=Math.abs(o.x-c.x);if(dx>o.w+R)continue;
      if(o.kind==='puddle'){
        if(h.onGround&&dx<o.w&&!o.hit){o.hit=true;h.s*=0.8;this.audio.sfx('splash');this.burst(c.x,h.y,10,{a0:-Math.PI*0.9,a1:-Math.PI*0.1,sp:200,col:'#bfe6ff',size:3.5,life:0.6});}
        continue;
      }
      const top=T.y(o.x)-o.h;
      if(c.y+R*0.85>top+3&&dx<o.w+R*0.6&&(h.inv<=0||h.curl>0.6)){
        o.dead=true;o.hit=true;
        this.burst(o.x,top+o.h*0.5,12,{sp:220,col:o.kind==='log'?'#b98458':o.kind==='snail'?'#e9a46a':'#a9a6b6',size:4,life:0.7});
        if(h.curl>0.6){
          if(h.onGround)h.s*=0.92;this.trick+=25*this.mult();this.audio.sfx('land',0.5);
          this.text(o.x,top-14,'Бам!','#fff3b0',20);
          if(h.inv<=0){
            if(h.shd>0){h.shd=0;h.inv=1.2;this.text(c.x,c.y-R*2,'Щит лопнул!','#bfe3ff',24);}
            else{this.sleep=Math.min(1,this.sleep+0.12);if(this.sleep>=1){this.die();return;}}
          }
        }else this.stumble(0.4,['Бонк!','Ой-ой!','Колючий конфуз!','Кто тут камень поставил?!'][(Math.random()*4)|0]);
      }
    }
    for(const m of this.world.marks){
      if(m.hit)continue;
      if(m.kind==='peak'&&c.x>m.x-40){m.hit=true;this.addBanner('Вершина мира!');this.trick+=300*this.mult();this.burst(m.x,m.y-40,22,{type:'star',col:'#fff6a0',size:7,sp:300,life:1,g:80});this.zk=-0.07;this.audio.sfx('perfect');}
      else if(m.kind==='tunnel'&&Math.abs(c.x-m.x)<m.w*0.5&&c.y>T.y(m.x)-180){m.hit=true;this.text(m.x,T.y(m.x)-200,'Секретный туннель!','#ffe9a8',26);this.trick+=200*this.mult();this.audio.sfx('mush');this.burst(m.x,T.y(m.x)-60,14,{type:'star',col:'#ffe066',size:5,sp:160,life:0.9,g:-40});}
    }
    // подбор
    for(const k of this.world.pickups){
      if(k.got)continue;if(h.mag>0&&k.kind==='berry'){const mx=c.x-k.x,my=c.y-k.y,md=Math.hypot(mx,my);if(md<320&&md>1){const v=(1100-md*2)*dt;k.x+=mx/md*v;k.y+=my/md*v;}}const dx=k.x-c.x,dy=k.y-c.y;
      if(dx*dx+dy*dy<(R+22)*(R+22))this.collect(k,c);
    }
    // сонливость, комбо
    this.sleep=Math.max(0,this.sleep-dt*lerp(0.03,0.016,pc));
    if(this.combo>0){this.comboT-=dt;if(this.comboT<=0){this.combo=0;}}
    // дистанция
    this.dist=Math.max(this.dist,(h.x-100)/25);
    const di=Math.floor(this.dist);for(const key in MS){if(di>=+key&&!this.ms[key]){this.ms[key]=1;this.addBanner(MS[key]);}}
    if(di>this.distInt){this.dayAdd('dist',di-this.distInt);this.distInt=di;}
    const ti=Math.floor(this.t);if(ti>this.timeInt){this.timeInt=ti;this.dayMax('time',ti);this.audio.setTempo(pc);}
    this.score=Math.floor(this.dist)+this.trick;
    this.cullT-=dt;if(this.cullT<=0){this.cullT=2;this.world.cull(h.x);}
    this.saveT-=dt;if(this.saveT<=0){this.saveT=15;persist(this.save);}
  }
  shakeK(v){if(!this.reduce)this.shake=Math.max(this.shake,v);}
  jump(){
    const h=this.hog,sp=h.s;
    const pw=clamp(sp/780*0.7+clamp(h.holdT/0.9,0,1)*0.5,0.1,1);
    const J=lerp(290,780,pw*pw*0.6+pw*0.4);
    const a=h.a,nx=Math.sin(a),ny=-Math.cos(a);
    h.cx=h.x+nx*R;h.cy=h.y+ny*R;
    h.vx=sp*Math.cos(a)+nx*J*0.8+J*0.22;h.vy=sp*Math.sin(a)+ny*J*0.95;
    h.onGround=false;h.air=0;h.flips=0;h.flipAng=0;h.flipRemain=0;h.jcd=0.2;h.takeX=h.cx;h.spaced=false;h.holdT=0;h.squash=-0.22;
    this.audio.sfx('puff',pw);this.audio.sfx('jump');
    this.burst(h.x,h.y-4,Math.round(8+pw*14),{a0:-Math.PI*0.95,a1:-Math.PI*0.05,sp:120+pw*170,size:9+pw*8,life:0.75,col:'#f4f1ff',g:-30,type:'smoke'});
    this.burst(h.x,h.y-2,Math.round(4+pw*8),{a0:-Math.PI*0.9,a1:-Math.PI*0.1,sp:200,size:3,life:0.5,col:'rgba(255,255,255,0.8)',g:300});
    this.zk=-(0.04+pw*0.07);this.shakeK(0.08+pw*0.15);
    if(pw>0.78)this.text(h.cx,h.cy-R*2,['Супер-прыжок!','Ёжик-катапульта!','Вжжжух!'][(Math.random()*3)|0],'#fff6b0',24);
  }
  power(k){
    const h=this.hog,m={magnet:['Магнит!','#ffb3c1'],shield:['Щит!','#bfe3ff'],feather:['Пёрышко!','#fff3a8']}[k.kind];
    if(k.kind==='magnet')h.mag=9;else if(k.kind==='shield')h.shd=25;else h.fea=8;
    this.text(k.x,k.y-30,m[0],m[1],24);this.burst(k.x,k.y,16,{col:m[1],size:5,sp:240,life:0.7,g:0,type:'star'});
    this.audio.sfx('mush');this.trick+=75*this.mult();this.flash=0.15;
  }
  snort(){
    const c=this.center(this.hog),L=['Фыр!','Фыр-фыр-фыр!','Фррр!','Я не злюсь, я бодрюсь'];
    this.text(c.x,c.y-R*2.2,L[(Math.random()*L.length)|0],'#ffe9c2',22);
    this.burst(c.x+R,c.y,5,{col:'#fff',size:5,sp:90,life:0.6,g:-30,type:'smoke'});this.audio.sfx('flower');
  }
  easter(){
    const h=this.hog;this.rainT=6;this.save.berries+=30;this.run.berries+=30;h.boostT=10;h.mag=10;
    this.addBanner('Код Konami! Ёжик-Турбо!');this.audio.sfx('unlock');this.flash=0.5;this.zk=-0.08;
  }
  updateRain(dt){
    if(this.rainT<=0)return;this.rainT-=dt;
    const c=this.cam,z=c.zoom,n=Math.floor(dt*90+Math.random());
    for(let i=0;i<n;i++)this.fx.push({x:c.x+Math.random()*this.W/z,y:c.y-30,vx:0,vy:140+Math.random()*120,life:0,max:2.6,size:6,col:Math.random()<0.5?'#ff7fae':'#ffd54a',type:'star',g:260,rot:0});
  }
  takeoff(vx,vy){
    const h=this.hog;
    h.cx=h.x+Math.sin(h.a)*R;h.cy=h.y-Math.cos(h.a)*R;h.vx=vx;h.vy=vy;
    h.onGround=false;h.air=0;h.flips=0;h.flipAng=0;h.flipRemain=0;
    h.takeX=h.cx;h.spaced=false;if(vy<-80)this.audio.sfx('jump');
  }
  flipDone(back){
    const h=this.hog;h.flips++;this.run.flips++;this.dayAdd('flips',1);this.audio.sfx('flip',h.flips-1);
    const names=back?['Бэкфлип!','Двойной бэкфлип!','Тройной!!','Безумие ×4!']:['Фронтфлип!','Двойной фронтфлип!','Тройной!!','Безумие ×4!'];
    const c=this.center(h);
    this.text(c.x,c.y-R*1.6,h.flips>=4?'Безумие ×'+h.flips+'!':names[h.flips-1],h.flips>1?'#ffd84a':'#fff',20+Math.min(h.flips,4)*2);
    this.burst(c.x,c.y,6,{sp:140,type:'star',col:'#ffe066',size:5,life:0.5,g:0});
  }
  land(){
    const h=this.hog,T=this.world.terrain;
    h.x=h.cx;h.y=T.y(h.cx);h.a=T.angle(h.x);
    const cs=Math.cos(h.a),sn=Math.sin(h.a),vt=h.vx*cs+h.vy*sn,vin=h.vy*cs-h.vx*sn;
    const ang=Math.atan2(Math.max(vin,0),Math.max(vt,1));
    const perfect=ang<0.30&&h.air>0.45;
    h.s=vt<60?60:vt;h.onGround=true;
    h.squash=clamp(vin/1500,0,0.42);h.holdT=0;this.shakeK(clamp(vin/2600,0,0.45));
    {const dd=Math.abs(h.cx-h.takeX);
    if(h.air>1.7)this.text(h.cx,h.y-R*5,'Ёжик-ракета! '+h.air.toFixed(1).replace('.',',')+' с','#bfe9ff',22);
    else if(dd>900)this.text(h.cx,h.y-R*5,'Перелёт на '+Math.round(dd/25)+' м!','#bfe9ff',22);}
    const rem=Math.abs(h.flipRemain);let fail=false,done=h.flips;
    if(rem>0){
      if(rem>TAU-0.6){/* едва начал — отменяем без штрафа */}
      else if(rem<=1.1){done++;h.flips++;this.run.flips++;this.dayAdd('flips',1);this.audio.sfx('flip',h.flips-1);}
      else fail=true;
    }
    h.flipAng=0;h.flipRemain=0;
    const gx=h.x,gyy=h.y;
    if(vin>140)this.audio.sfx('land',vin/900);
    this.burst(gx,gyy-2,Math.round(7+clamp(vin/80,0,12)),{a0:-Math.PI*0.95,a1:-Math.PI*0.05,sp:160,col:'rgba(255,255,255,0.7)',size:4,life:0.5,g:300});this.burst(gx,gyy-2,5,{a0:-Math.PI*0.9,a1:-Math.PI*0.1,sp:220,col:this.pal.gHi,size:3,life:0.7,g:600,type:'petal'});
    if(fail){this.combo=0;this.audio.sfx('nope');this.stumble(0.34,'Недокрутил…');return;}
    if(done>0||perfect){
      const m=this.mult(),pts=Math.round((done*150+(perfect?100:0))*m);
      this.trick+=pts;this.combo=Math.min(25,this.combo+(done>0?1:0)+(perfect?1:0));this.comboT=8;
      this.run.maxCombo=Math.max(this.run.maxCombo,this.mult());this.dayMax('combo',this.mult());{const cb=this.combo;if(cb>=2)this.text(gx-40,gyy-R*5.2,COMBO_MSG[(cb*3+this.run.flips)%COMBO_MSG.length],'#ffd0f0',20);if(cb>=4&&cb%4===0)this.addBanner('Комбо ×'+this.mult()+' — '+COMBO_MSG[cb%COMBO_MSG.length]);}
      if(perfect){
        this.run.perfect++;this.dayAdd('perfect',1);h.s+=70;this.audio.sfx('perfect');
        this.text(gx,gyy-R*2.4,['Идеально!','Мягкая посадка!','Как по маслу!','Ёжик-пилот!'][(Math.random()*4)|0],'#8affc1',26);this.zk=0.07;this.flash=0.35;
        this.burst(gx,gyy-R,12,{sp:200,type:'star',col:'#fff6a0',size:6,life:0.7,g:100});
      }
      this.text(gx+10,gyy-R*3.4,'+'+fmt(pts),'#fff',18);
    }
  }
  stumble(sev,txt,fromLanding){
    const h=this.hog;if(h.inv>0)return;
    if(h.shd>0){h.shd=0;h.inv=1.2;const c1=this.center(h);this.burst(c1.x,c1.y,16,{col:'#9fd0ff',size:5,sp:260,life:0.6,g:0,type:'star'});this.text(c1.x,c1.y-R*2,'Щит лопнул!','#bfe3ff',24);this.audio.sfx('land',0.6);this.shakeK(0.2);return;}h.inv=1.5;h.stumbleT=0.8;this.zk=0.05;this.combo=0;this.run.stumbles++;
    this.sleep=Math.min(1,this.sleep+sev);
    if(h.onGround)h.s*=0.55;else{h.vx*=0.6;}
    const c=this.center(h);
    this.shake=this.reduce?0:0.35;
    this.burst(c.x,c.y-R,8,{type:'star',col:'#ffe066',size:5,sp:150,life:0.7,g:200});
    this.text(c.x,c.y-R*2,txt,'#ffb3c1',26);this.audio.sfx('bonk');
    if(this.sleep>=1)this.die();
  }
  die(){
    this.state='dying';this.dieT=0;this.input.keys.clear();this.input.pointer=false;
    this.audio.sfx('yawn');
    const c=this.center(this.hog);this.text(c.x,c.y-R*2.4,'Хр-р-р…','#c9d6ff',26);
    if(this.cb.onState)this.cb.onState('dying');
  }
  finish(){
    const s=this.save,nb={},best=s.best;
    const sum={dist:Math.floor(this.dist),score:this.score,combo:this.run.maxCombo,time:this.t,berries:this.run.berries,flips:this.run.flips,perfect:this.run.perfect,newBest:nb};
    if(sum.dist>best.dist){best.dist=sum.dist;nb.dist=true;}
    if(sum.score>best.score){best.score=sum.score;nb.score=true;}
    if(sum.combo>best.combo){best.combo=sum.combo;nb.combo=true;}
    if(sum.time>best.time)best.time=sum.time;
    s.runs++;persist(s);
    this.state='over';if(this.cb.onOver)this.cb.onOver(sum);
  }
  collect(k,c){
    const h=this.hog,m=this.mult();k.got=true;if(k.kind==='magnet'||k.kind==='shield'||k.kind==='feather'){this.power(k);return;}
    if(k.kind==='berry'){
      h.berryStreak++;h.berryT=0.9;this.save.berries++;this.run.berries++;this.dayAdd('berries',1);this.trick+=5*m;
      this.audio.sfx('berry',h.berryStreak-1);this.burst(k.x,k.y,5,{col:'#ff7fae',size:3,sp:100,life:0.4,g:0});
    }else if(k.kind==='apple'){
      this.sleep=Math.max(0,this.sleep-0.25);this.run.apples++;this.dayAdd('apples',1);this.trick+=50*m;
      this.audio.sfx('apple');this.text(k.x,k.y-24,'Ням! Бодрость +','#ffb3b3',22);this.burst(k.x,k.y,10,{col:'#ff6a6a',size:4,sp:160,life:0.6});
    }else if(k.kind==='mush'){
      h.boostT=2.5;if(h.onGround)h.s+=160;else h.vx+=160;this.save.berries+=3;this.run.berries+=3;this.dayAdd('berries',3);
      this.audio.sfx('mush');this.text(k.x,k.y-24,'Ускорение!','#ffe066',22);this.burst(k.x,k.y,12,{col:'#ffd54a',size:4,sp:200,life:0.6,type:'star',g:0});
    }else if(k.kind==='flower'){
      h.sniffT=0.7;this.trick+=100*m;this.audio.sfx('flower');this.text(k.x,k.y-22,'Ммм, цветочек!','#ffc2e0',20);
      this.burst(k.x,k.y,12,{col:'#ffb6d0',size:4,sp:90,life:1,g:-30,type:'petal'});
    }
  }

  /* --- кадр --- */
  frame(rdt){
    const dt=Math.min(rdt,0.05);this.clock+=dt;
    this.acc+=dt;let guard=0;
    while(this.acc>=DT&&guard++<12){this.step(DT);this.acc-=DT;}
    if(this.acc>DT*12)this.acc=0;
    this.updateFx(dt);this.updateCam(dt);this.draw();
  }
  updateFx(dt){
    this.pal=getPal(this.tod);
    if(this.state!=='menu'&&this.state!=='paused'&&this.pal.biome!==this.biome){
      if(this.biome!==-1||this.t<1)this.addBanner(KEYS[this.pal.biome].name);
      this.biome=this.pal.biome;
    }
    if(this.shake>0)this.shake=Math.max(0,this.shake-dt);if(this.state!=='paused'){this.zk-=this.zk*Math.min(1,dt*4);if(this.flash>0)this.flash=Math.max(0,this.flash-dt*1.6);this.updateLife(dt);this.updateRain(dt);}
    if(this.state==='paused')return;
    for(let i=this.fx.length-1;i>=0;i--){const f=this.fx[i];f.life+=dt;if(f.life>=f.max){this.fx.splice(i,1);continue;}f.vy+=f.g*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;}
    for(let i=this.texts.length-1;i>=0;i--){const t=this.texts[i];t.life+=dt;t.y-=50*dt;if(t.life>=t.max)this.texts.splice(i,1);}
    if(this.banners.length){const b=this.banners[0];b.t+=dt;if(b.t>2.8)this.banners.shift();}
    const h=this.hog;
    if(this.state==='dying'&&Math.random()<dt*2.2){const c=this.center(h);this.fx.push({x:c.x+R*0.6,y:c.y-R*1.1,vx:18,vy:-34,life:0,max:1.6,size:14+Math.random()*6,col:'#dfe6ff',type:'z',g:0,rot:0});}
    const sp=h.onGround?h.s:Math.abs(h.vx);
    for(const a of this.amb){a.x-=(0.012+sp*0.00018)*a.vx*dt*60*0.5;a.y+=Math.sin(this.clock+a.ph)*0.0004+a.vy*0.00025;if(a.x<-0.05)a.x=1.05;if(a.y>1.05)a.y=-0.05;}
  }
  updateCam(dt){
    const h=this.hog,T=this.world.terrain,c=this.cam,menu=this.state==='menu',cen=this.center(h);
    const z0=clamp(Math.min(this.H/620,this.W/900),0.4,1.4);
    const sp=h.onGround?h.s:Math.hypot(h.vx,h.vy);
    const hgt=h.onGround?0:clamp((T.y(cen.x)-cen.y-R)/450,0,1);
    let zt=menu?z0*1.05:z0*lerp(1,0.89,clamp((sp-300)/500,0,1))*lerp(1,0.82,hgt)*(1+this.zk*0.55);
    if(this.state==='dying')zt*=1.12;
    c.zoom=c.init?c.zoom+(zt-c.zoom)*Math.min(1,dt*2.6):zt;
    const vw=this.W/c.zoom,vh=this.H/c.zoom;
    const tx=cen.x-vw*(menu?0.2:0.3)+(menu?0:sp*0.14),ty=lerp(cen.y,T.y(cen.x)-R,0.62)-vh*0.62;
    if(!c.init){c.x=tx;c.y=ty;c.init=true;}
    const A0=c.x+this.W*0.3/c.zoom;c.x+=(tx-c.x)*Math.min(1,dt*8);c.y+=(ty-c.y)*Math.min(1,dt*3.2);const A1=c.x+this.W*0.3/c.zoom;c.vA=(A1-A0)/Math.max(dt,0.001);const rt=menu?0:clamp(-(h.onGround?h.a:Math.atan2(h.vy,h.vx)*0.4)*0.13,-0.045,0.045);c.roll+=(rt-c.roll)*Math.min(1,dt*2.5);this.spd=sp;
  }

  /* --- отрисовка --- */
  layerY(u,L){const c=this.cam,vh=this.H/c.zoom;return L.base*this.H+Math.sin(u*L.f1+L.ph)*L.a1+Math.sin(u*L.f2+L.ph*1.7+1)*L.a2-(c.y+vh*0.62)*0.06;}
  layer(L,color){
    const ctx=this.ctx,z=this.cam.zoom,an=this.W*0.3,off=(this.cam.x+an/z)*L.par;
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,this.H+4);
    for(let sx=0;sx<=this.W+12;sx+=12)ctx.lineTo(sx,this.layerY((sx-an)/z+off,L));
    ctx.lineTo(this.W,this.H+4);ctx.closePath();ctx.fill();
  }
  trees(pal){
    const ctx=this.ctx,z=this.cam.zoom,an=this.W*0.3,off=(this.cam.x+an/z)*MID.par,k0=Math.floor((off-an/z)/150)-1,type=pal.idx<=2?'tree':pal.idx===3?'mush':'pine';
    for(let k=k0;k<k0+this.W/z/150+4;k++){
      if(hash1(k*3+1)<0.35)continue;
      const u=k*150+hash1(k)*60,sx=(u-off)*z+an;if(sx<-90||sx>this.W+90)continue;
      const sy=this.layerY(u,MID)+4,sc=z*(0.75+hash1(k+9)*0.7)*1.15;
      ctx.save();ctx.translate(sx,sy);
      if(type==='tree'){
        ctx.fillStyle=pal.trunk;ctx.fillRect(-4*sc,-32*sc,8*sc,32*sc);
        ctx.fillStyle=pal.tree;circ(ctx,0,-48*sc,24*sc);circ(ctx,-16*sc,-38*sc,16*sc);circ(ctx,16*sc,-38*sc,16*sc);
        ctx.fillStyle=pal.treeDk;ell(ctx,10*sc,-34*sc,12*sc,7*sc,0);
      }else if(type==='pine'){
        ctx.fillStyle=pal.trunk;ctx.fillRect(-3*sc,-14*sc,6*sc,14*sc);
        for(let j=0;j<3;j++){ctx.fillStyle=j%2?pal.treeDk:pal.tree;ctx.beginPath();ctx.moveTo(-(26-j*5)*sc,-(10+j*20)*sc);ctx.lineTo(0,-(46+j*20)*sc);ctx.lineTo((26-j*5)*sc,-(10+j*20)*sc);ctx.closePath();ctx.fill();}
      }else{
        ctx.fillStyle='#efe0cb';ctx.fillRect(-5*sc,-30*sc,10*sc,30*sc);
        ctx.fillStyle=pal.tree;ctx.beginPath();ctx.arc(0,-30*sc,28*sc,Math.PI,0);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.7)';circ(ctx,-10*sc,-42*sc,4*sc);circ(ctx,8*sc,-48*sc,5*sc);circ(ctx,16*sc,-38*sc,3*sc);
      }
      if(type==='tree'&&hash1(k*11+4)>0.78){
        const hp=Math.max(0,Math.sin(this.clock*1.3+k*5)-0.8)*5;
        ctx.save();ctx.translate(15*sc,-(30+hp*28)*sc);ctx.rotate(-0.1);
        ctx.fillStyle=rgb(mixc([185,105,40],[25,30,70],pal.night*0.7));
        ctx.beginPath();ctx.moveTo(-2*sc,0);ctx.bezierCurveTo(-16*sc,-4*sc,-14*sc,-26*sc+Math.sin(this.clock*3+k)*3*sc,-4*sc,-20*sc);ctx.bezierCurveTo(-8*sc,-14*sc,-6*sc,-6*sc,0,-2*sc);ctx.fill();
        ell(ctx,2*sc,-5*sc,6*sc,5*sc,0.3);circ(ctx,8*sc,-10*sc,3.6*sc);ell(ctx,7*sc,-14*sc,1.4*sc,2.6*sc,0);
        ctx.fillStyle='#1b1220';circ(ctx,9.5*sc,-10.6*sc,0.9*sc);ctx.fillStyle='#8a5a2b';circ(ctx,11*sc,-6*sc,2*sc);
        ctx.restore();
      }
      if((type==='tree'||type==='pine')&&pal.night>0.4&&hash1(k*17+1)>0.7){
        ctx.save();ctx.globalAlpha=clamp((pal.night-0.4)*2,0,1);ctx.translate(0,(type==='tree'?-70:-88)*sc);
        ctx.fillStyle='#120e2b';ell(ctx,0,-4*sc,6*sc,8*sc,0);circ(ctx,0,-14*sc,6*sc);
        ctx.beginPath();ctx.moveTo(-5*sc,-18*sc);ctx.lineTo(-4*sc,-24*sc);ctx.lineTo(-1*sc,-19*sc);ctx.moveTo(5*sc,-18*sc);ctx.lineTo(4*sc,-24*sc);ctx.lineTo(1*sc,-19*sc);ctx.fill();
        const bl=Math.sin(this.clock*0.7+k*9)>0.96?0.2:1,look=Math.sin(this.clock*0.5+k)*1.5*sc;
        ctx.fillStyle='#ffe066';ell(ctx,-2.6*sc+look,-14.5*sc,1.7*sc,1.7*sc*bl,0);ell(ctx,2.6*sc+look,-14.5*sc,1.7*sc,1.7*sc*bl,0);
        ctx.restore();
      }
      ctx.restore();
    }
  }
  drawSky(pal){
    const ctx=this.ctx,W=this.W,H=this.H,g=ctx.createLinearGradient(0,0,0,H*0.75);
    g.addColorStop(0,pal.skyT);g.addColorStop(1,pal.skyB);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    if(pal.night>0.05){for(const s of this.stars){ctx.globalAlpha=pal.night*(0.5+0.5*Math.sin(this.clock*2+s.ph));ctx.fillStyle='#fff';circ(ctx,s.x*W,s.y*H,s.r);}ctx.globalAlpha=1;}
    const sunA=1-pal.night;
    if(sunA>0.02){
      const u=clamp(pal.f/0.78,0,1),sx=W*(0.1+0.8*u),sy=H*(0.6-0.42*Math.sin(Math.PI*u));
      const gl=ctx.createRadialGradient(sx,sy,4,sx,sy,70);gl.addColorStop(0,'rgba(255,240,190,'+0.8*sunA+')');gl.addColorStop(1,'rgba(255,240,190,0)');
      ctx.fillStyle=gl;ctx.fillRect(sx-80,sy-80,160,160);ctx.globalAlpha=sunA;ctx.fillStyle='#fff3c4';circ(ctx,sx,sy,22);ctx.globalAlpha=1;
    }
    if(pal.night>0.05){
      const mx=W*0.78,my=H*0.2;ctx.globalAlpha=pal.night;
      const gl=ctx.createRadialGradient(mx,my,6,mx,my,60);gl.addColorStop(0,'rgba(220,230,255,0.5)');gl.addColorStop(1,'rgba(220,230,255,0)');ctx.fillStyle=gl;ctx.fillRect(mx-70,my-70,140,140);
      ctx.fillStyle='#f4f1e2';circ(ctx,mx,my,20);ctx.fillStyle='#e2ddc8';circ(ctx,mx-6,my-4,4);circ(ctx,mx+7,my+6,3);ctx.globalAlpha=1;
    }
    const cw=W+320,ca=0.78*(1-pal.night*0.65);
    ctx.fillStyle='rgba('+(255-pal.night*110|0)+','+(255-pal.night*100|0)+','+(255-pal.night*50|0)+','+ca+')';
    for(const c of this.clouds){
      let x=((c.x-(this.cam.x+W*0.3/this.cam.zoom)*0.04+this.clock*c.sp)%cw+cw)%cw-160;const y=c.y*H,s=c.s*clamp(H/620,0.6,1.3);
      circ(ctx,x,y,26*s);circ(ctx,x+28*s,y-6*s,20*s);circ(ctx,x-28*s,y-2*s,18*s);circ(ctx,x+8*s,y+8*s,22*s);
    }
    if(pal.night>0.3){
      const my=H*0.2,cx2=-140+((this.clock%64)/64)*(W+280),s=clamp(H/620,0.6,1.3)*1.3,cl=(dx,dy,m)=>{circ(ctx,cx2+dx*s,my+dy*s,26*s*m);circ(ctx,cx2+(dx+28)*s,my+(dy-6)*s,20*s*m);circ(ctx,cx2+(dx-28)*s,my+(dy-2)*s,18*s*m);circ(ctx,cx2+(dx+8)*s,my+(dy+8)*s,22*s*m);};
      ctx.globalAlpha=Math.min(1,pal.night*1.2);ctx.fillStyle='rgba(205,215,255,0.55)';cl(0,0,1.1);ctx.fillStyle='rgba(40,48,104,0.96)';cl(0,3,1);ctx.globalAlpha=1;
    }
  }
  updateLife(dt){
    const W=this.W,H=this.H,c=this.cam,z=c.zoom,an=W*0.3,off=(c.x+an/z)*MID.par;
    this.lifeT-=dt;
    if(this.lifeT<=0){this.lifeT=2+Math.random()*4.5;if(this.life.length<9)this.spawnLife();}
    for(let i=this.life.length-1;i>=0;i--){
      const e=this.life[i];e.t+=dt;let dead=e.t>e.max;
      if(e.type==='rabbit'){e.u+=e.vu*dt;const sx=(e.u-off)*z+an;if(e.t>1.5&&(sx<-160||sx>W+160))dead=true;}
      else{
        if(e.type==='bat'){e.vy=Math.sin(e.t*5+e.ph)*80+Math.sin(e.t*11+e.ph)*35;e.vx=e.dir*(95+Math.sin(e.t*3)*45);}
        e.x+=(e.vx-(e.par||0)*(c.vA||0)*z)*dt;e.y+=e.vy*dt;
        if(e.t>1.5&&(e.x<-300||e.x>W+300||e.y>H+80))dead=true;
      }
      if(dead)this.life.splice(i,1);
    }
  }
  spawnLife(){
    const W=this.W,H=this.H,pal=this.pal,c=this.cam,z=c.zoom,an=W*0.3,r=Math.random,day=1-pal.night,dir=r()<0.5?-1:1;
    const pool=[],add=(t,n)=>{if(!this.life.some(e=>e.type===t))for(let i=0;i<n;i++)pool.push(t);};
    if(day>0.55){add('birds',3);add('rabbit',2);if(r()<0.5)add('butterfly',1);}
    if(pal.night>0.55){add('bat',3);add('star',3);if(r()<0.5)add('owl',1);add('swarm',2);}
    else if(pal.night>0.2)add('swarm',2);
    pool.push('leaf');if(pal.biome===2)pool.push('leaf','leaf');
    const t=pool[(r()*pool.length)|0],e={type:t,x:dir>0?-80:W+80,y:0,vx:dir*40,vy:0,dir,ph:r()*6,t:0,max:30,par:0.1};
    if(t==='birds'){e.y=H*(0.1+r()*0.2);e.vx=dir*(50+r()*20);e.n=5+((r()*5)|0);e.par=0.05;e.max=40;}
    else if(t==='rabbit'){e.u=(c.x+an/z)*MID.par+(dir>0?-(an+100):(W-an+100))/z;e.vu=dir*(230+r()*80);e.hop=r()*6;e.max=40;}
    else if(t==='butterfly'){e.y=H*(0.5+r()*0.2);e.vx=dir*(30+r()*20);e.col=['#ff9ad5','#8fd0ff','#ffd36a'][(r()*3)|0];e.par=0.5;e.max=26;}
    else if(t==='leaf'){e.x=W*(0.1+r()*0.8);e.y=-40;e.vx=dir*(8+r()*25);e.vy=55+r()*35;e.sz=22+r()*16;e.par=0.2;e.max=16;e.col=['#9bd96f','#ff9fc4','#e9822f','#c78bff','#f08a6a','#b7e56f'][pal.idx%6];}
    else if(t==='bat'){e.y=H*(0.15+r()*0.25);e.par=0.1;e.max=30;}
    else if(t==='star'){e.x=W*(0.2+r()*0.6);e.y=H*(0.04+r()*0.15);e.vx=-dir*520;e.vy=230;e.par=0;e.max=0.9;}
    else if(t==='owl'){e.x=dir>0?-40:W+40;e.y=H*0.19;e.vx=dir*34;e.par=0.02;e.max=70;}
    else if(t==='swarm'){e.x=W*(0.4+r()*0.5);e.y=H*(0.7+r()*0.1);e.vx=dir*10;e.n=14;e.par=0.35;e.max=22;}
    this.life.push(e);
  }
  drawLife(pass,pal){
    const ctx=this.ctx,W=this.W,H=this.H,c=this.cam,z=c.zoom,an=W*0.3,k=clamp(H/620,0.6,1.4),night=pal.night,off=(c.x+an/z)*MID.par;
    for(const e of this.life){
      const fade=Math.max(0,Math.min(1,e.t/1.2,(e.max-e.t)/1.2));
      ctx.save();
      if(pass==='sky'){
        if(e.type==='birds'){
          ctx.globalAlpha=fade*0.85;ctx.strokeStyle=rgb(mixc([74,68,102],[20,24,70],night));ctx.lineWidth=1.8*k;ctx.lineCap='round';
          for(let i=0;i<e.n;i++){const q=Math.ceil(i/2),sg=i%2?1:-1,bx=e.x-q*17*k*e.dir,by=e.y+(i?sg*q*8*k:0),fl=Math.sin(this.clock*8+e.ph+i*0.8),s=6*k;
            ctx.beginPath();ctx.moveTo(bx-s,by-fl*s*0.9);ctx.quadraticCurveTo(bx-s*0.4,by-fl*s*0.2-2*k,bx,by);ctx.quadraticCurveTo(bx+s*0.4,by-fl*s*0.2-2*k,bx+s,by-fl*s*0.9);ctx.stroke();}
        }else if(e.type==='bat'){
          ctx.globalAlpha=fade;ctx.fillStyle='#0d0a24';ctx.translate(e.x,e.y);ctx.scale(k,k);
          const fl=Math.sin(this.clock*22+e.ph);
          ell(ctx,0,0,4,6,0);circ(ctx,0,-6,3.5);ctx.beginPath();ctx.moveTo(-3,-8);ctx.lineTo(-3,-13);ctx.lineTo(0,-9);ctx.lineTo(3,-13);ctx.lineTo(3,-8);ctx.fill();
          for(const sg of[-1,1]){ctx.beginPath();ctx.moveTo(0,-2);ctx.quadraticCurveTo(sg*11,-14*fl-4,sg*24,-5*fl+3);ctx.quadraticCurveTo(sg*18,3,sg*13,2);ctx.quadraticCurveTo(sg*8,6,sg*4,3);ctx.quadraticCurveTo(sg*2,4,0,5);ctx.closePath();ctx.fill();}
          ctx.fillStyle='#ff6a6a';circ(ctx,-1.2,-6,0.7);circ(ctx,1.2,-6,0.7);
        }else if(e.type==='star'){
          const u=e.t/e.max;ctx.globalAlpha=Math.max(0,1-u);ctx.strokeStyle='#fff';ctx.lineWidth=2*k;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x-e.vx*0.16,e.y-e.vy*0.16);ctx.stroke();ctx.fillStyle='#fff';circ(ctx,e.x,e.y,2.4*k);
        }else if(e.type==='owl'){
          ctx.globalAlpha=fade;ctx.translate(e.x,e.y+Math.sin(e.t*1.3)*6);ctx.scale(k*1.1,k*1.1);ctx.fillStyle='#0b0a22';
          const fl=Math.sin(this.clock*3.2+e.ph);
          for(const sg of[-1,1]){ctx.save();ctx.rotate(sg*(0.15-fl*0.5));ell(ctx,sg*13,-2,13,4.5,0);ctx.restore();}
          ell(ctx,0,2,6,9,0);circ(ctx,0,-8,6);ctx.beginPath();ctx.moveTo(-5,-12);ctx.lineTo(-4,-18);ctx.lineTo(-1,-13);ctx.moveTo(5,-12);ctx.lineTo(4,-18);ctx.lineTo(1,-13);ctx.fill();
          ctx.fillStyle='#ffe066';circ(ctx,-2.4,-8,1.3);circ(ctx,2.4,-8,1.3);
        }
      }else if(pass==='mid'){
        if(e.type==='rabbit'){
          const sx=(e.u-off)*z+an,sy=this.layerY(e.u,MID)+4,sc=k*1.05,hop=Math.abs(Math.sin(this.clock*9+e.hop))*13*sc;
          ctx.translate(sx,sy-hop);ctx.scale(e.dir*sc,sc);
          ctx.fillStyle=rgb(mixc([214,197,176],[28,34,84],night*0.8));
          ell(ctx,0,-9,11,7,0);circ(ctx,10,-14,5.5);ell(ctx,8,-25,2.2,8,-0.15+Math.sin(this.clock*6+e.hop)*0.08);ell(ctx,12.5,-24,2.2,7.5,0.3);ell(ctx,-5,-3,6,3.4,0);ell(ctx,7,-3,4,2.6,0);
          ctx.fillStyle='#fff';circ(ctx,-11.5,-10,3.6);ctx.fillStyle='#1b1220';circ(ctx,12.2,-15,0.9);ctx.fillStyle='#f3a7a0';ell(ctx,8,-25,0.9,5,-0.15);
        }
      }else{
        if(e.type==='butterfly'){
          const bx=e.x+Math.sin(e.t*2+e.ph)*16*k,by=e.y+Math.sin(e.t*3.3+e.ph)*20*k,f=Math.abs(Math.sin(this.clock*13+e.ph));
          ctx.globalAlpha=fade;ctx.translate(bx,by);ctx.rotate(Math.sin(e.t*2+e.ph)*0.4);ctx.scale(k*1.2,k*1.2);
          ctx.fillStyle=e.col;ell(ctx,-4*f-1,-3,4*f+1,6,-0.35);ell(ctx,4*f+1,-3,4*f+1,6,0.35);ell(ctx,-3*f-1,4,3*f+1,4.5,0.35);ell(ctx,3*f+1,4,3*f+1,4.5,-0.35);
          ctx.fillStyle='rgba(255,255,255,0.8)';circ(ctx,-4*f-1,-5,1.1);circ(ctx,4*f+1,-5,1.1);ctx.fillStyle='#2a1c30';ell(ctx,0,0,1.1,5.5,0);
        }else if(e.type==='leaf'){
          const lx=e.x+Math.sin(e.t*1.7+e.ph)*55,rot=Math.sin(e.t*1.7+e.ph)*0.9+e.t*0.4,s=e.sz*k;
          ctx.globalAlpha=0.95*fade;ctx.translate(lx,e.y);ctx.rotate(rot);ctx.scale(1,Math.abs(Math.cos(e.t*3.1+e.ph))*0.85+0.15);ctx.fillStyle=e.col;
          ctx.beginPath();ctx.moveTo(0,-s*0.55);ctx.quadraticCurveTo(s*0.5,-s*0.05,0,s*0.55);ctx.quadraticCurveTo(-s*0.5,-s*0.05,0,-s*0.55);ctx.fill();
          ctx.strokeStyle='rgba(0,0,0,0.22)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,-s*0.5);ctx.lineTo(0,s*0.7);ctx.stroke();
        }else if(e.type==='swarm'){
          for(let i=0;i<e.n;i++){
            const a=this.clock*(0.5+(i%3)*0.15)+e.ph+i*1.7,px=e.x+Math.cos(a*0.9+i)*(34+i*3)*k,py=e.y+Math.sin(a*1.3+i*2)*(18+i*1.6)*k,gl=Math.max(0,Math.sin(this.clock*2.2+i*1.9))*fade;
            ctx.fillStyle='#fff29a';ctx.globalAlpha=0.28*gl;circ(ctx,px,py,7*k);ctx.globalAlpha=Math.min(1,gl*1.1+0.15*fade);circ(ctx,px,py,1.8*k);
          }
        }
      }
      ctx.restore();
    }
  }
  peaks(pal){
    const ctx=this.ctx,z=this.cam.zoom,W=this.W,H=this.H,an=W*0.3,off=(this.cam.x+an/z)*0.04,k=clamp(H/620,0.6,1.4),yb=H*0.62-this.cam.y*0.03;
    const col=rgb(mixc(pal.a_far,pal.a_skyB,0.55)),snow=rgb(mixc([255,255,255],[150,165,230],pal.night*0.7),0.85);
    for(let i=Math.floor((off-an/z)/260)-2;i<(off+(W-an)/z)/260+3;i++){
      const h0=hash1(i*7+3),pk=(60+h0*170)*k,sx=(i*260-off)*z+an+(hash1(i)-0.5)*60,w=(150+h0*60)*k;
      ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(sx-w,yb+40);ctx.lineTo(sx-w*0.25,yb-pk*0.82);ctx.lineTo(sx,yb-pk);ctx.lineTo(sx+w*0.3,yb-pk*0.78);ctx.lineTo(sx+w,yb+40);ctx.closePath();ctx.fill();
      if(pk>130*k){ctx.fillStyle=snow;ctx.beginPath();ctx.moveTo(sx-w*0.28,yb-pk*0.78);ctx.lineTo(sx-w*0.25,yb-pk*0.82);ctx.lineTo(sx,yb-pk);ctx.lineTo(sx+w*0.3,yb-pk*0.78);ctx.lineTo(sx+w*0.12,yb-pk*0.68);ctx.lineTo(sx,yb-pk*0.76);ctx.lineTo(sx-w*0.12,yb-pk*0.66);ctx.closePath();ctx.fill();}
    }
  }
  farProps(pal){
    const ctx=this.ctx,z=this.cam.zoom,W=this.W,an=W*0.3,off=(this.cam.x+an/z)*FAR.par,k=clamp(this.H/620,0.6,1.4);
    for(let i=Math.floor((off-an/z)/520)-1;i<(off+(W-an)/z)/520+2;i++){
      if(hash1(i*5+2)<0.45)continue;
      const u=i*520+hash1(i)*200,sx=(u-off)*z+an,sy=this.layerY(u,FAR)+3,s=k*(0.9+hash1(i+4)*0.4),dk=rgb(mixc(pal.a_far,[40,30,70],0.45+pal.night*0.2));
      ctx.save();ctx.translate(sx,sy);ctx.fillStyle=dk;
      if(hash1(i*3+1)>0.5){
        ctx.beginPath();ctx.moveTo(-6*s,0);ctx.lineTo(-3.5*s,-34*s);ctx.lineTo(3.5*s,-34*s);ctx.lineTo(6*s,0);ctx.closePath();ctx.fill();
        ctx.translate(0,-34*s);ctx.rotate(this.clock*0.7+i);ctx.strokeStyle=dk;ctx.lineWidth=2.2*s;ctx.lineCap='round';
        for(let b=0;b<4;b++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-24*s);ctx.stroke();ctx.fillRect(1*s,-24*s,5*s,14*s);}
      }else{
        ctx.fillRect(-9*s,-14*s,18*s,14*s);ctx.beginPath();ctx.moveTo(-12*s,-14*s);ctx.lineTo(0,-26*s);ctx.lineTo(12*s,-14*s);ctx.closePath();ctx.fill();ctx.fillRect(4*s,-30*s,3*s,8*s);
        ctx.fillStyle='rgba(255,215,120,'+(0.25+pal.night*0.75)+')';ctx.fillRect(-4*s,-10*s,4*s,4*s);
        ctx.fillStyle='rgba(255,255,255,0.35)';for(let j=0;j<3;j++){const t=(this.clock*0.4+j/3+i)%1;circ(ctx,6*s+t*8*s+Math.sin(t*6)*2,-32*s-t*22*s,(2+t*3)*s);}
      }
      ctx.restore();
    }
  }
  fgGrass(pal){
    const ctx=this.ctx,z=this.cam.zoom,W=this.W,H=this.H,an=W*0.3,off=(this.cam.x+an/z)*1.45,k=clamp(H/620,0.6,1.3),st=46;
    ctx.fillStyle=pal.gDk;
    for(let i=Math.floor((off-an/z)/st)-1;i<(off+(W-an)/z)/st+2;i++){
      const h0=hash1(i*9+5);if(h0<0.3)continue;
      const sx=(i*st+h0*30-off)*z+an,hh=(16+h0*34)*k,sw=Math.sin(this.clock*2.2+i)*3*k;
      ctx.beginPath();ctx.moveTo(sx-5*k,H+2);ctx.quadraticCurveTo(sx-1*k,H-hh*0.6,sx+sw,H-hh);ctx.quadraticCurveTo(sx+3*k,H-hh*0.5,sx+6*k,H+2);ctx.closePath();ctx.fill();
    }
  }
  drawSpeed(){
    if(this.state!=='play'||this.reduce)return;
    const v=clamp((this.spd-560)/300,0,1)+(this.hog.boostT>0?0.4:0);if(v<=0.02)return;
    const ctx=this.ctx,W=this.W,H=this.H;ctx.strokeStyle='rgba(255,255,255,'+0.28*Math.min(v,1)+')';ctx.lineWidth=1.6;ctx.lineCap='round';
    for(let i=0;i<14;i++){const y=((i*0.173+0.07)%1)*H,x=((this.clock*(900+i*70)+i*173)%(W+300))-150,len=60+(i%4)*30;ctx.beginPath();ctx.moveTo(W-x,y);ctx.lineTo(W-x+len,y);ctx.stroke();}
  }
  drawMarks(pass,pal){
    const ctx=this.ctx,T=this.world.terrain,c=this.cam,z=c.zoom,x0=c.x-400,x1=c.x+this.W/z+400;
    for(const m of this.world.marks){
      if(m.x<x0||m.x>x1)continue;
      if(m.kind==='peak'&&pass===0){
        ctx.strokeStyle='rgba(255,255,255,0.93)';ctx.lineWidth=16;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();let on=false;
        for(let x=m.x-800;x<=m.x+800;x+=14){const y=T.y(x);if(y<=m.y+120){ctx[on?'lineTo':'moveTo'](x,y+5);on=true;}}
        ctx.stroke();
        ctx.strokeStyle='#6b4a2b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.lineTo(m.x,m.y-90);ctx.stroke();
        ctx.fillStyle='#e8467c';ctx.beginPath();ctx.moveTo(m.x,m.y-90);ctx.quadraticCurveTo(m.x+22,m.y-88+Math.sin(this.clock*5)*5,m.x+44,m.y-80);ctx.quadraticCurveTo(m.x+22,m.y-72+Math.sin(this.clock*5+1)*5,m.x,m.y-62);ctx.closePath();ctx.fill();
      }else if(m.kind==='tunnel'){
        const gy=T.y(m.x),w=m.w,aw=w*0.6;
        const arch=()=>{ctx.moveTo(m.x-aw,gy+14);ctx.lineTo(m.x-aw,gy-85);ctx.quadraticCurveTo(m.x-aw,gy-175,m.x,gy-175);ctx.quadraticCurveTo(m.x+aw,gy-175,m.x+aw,gy-85);ctx.lineTo(m.x+aw,gy+14);ctx.closePath();};
        if(pass===0){
          ctx.fillStyle='#150c1f';ctx.beginPath();arch();ctx.fill();
          const g=ctx.createRadialGradient(m.x,gy-70,6,m.x,gy-70,100);g.addColorStop(0,'rgba(255,205,120,0.45)');g.addColorStop(1,'rgba(255,205,120,0)');ctx.fillStyle=g;ctx.fillRect(m.x-aw,gy-175,aw*2,190);
          ctx.fillStyle='#fff29a';for(let i=0;i<6;i++){const a=this.clock*0.8+i*1.9;ctx.globalAlpha=0.4+0.6*Math.max(0,Math.sin(this.clock*2+i*2));circ(ctx,m.x+Math.cos(a)*aw*0.7,gy-90+Math.sin(a*1.3)*50,2.2);}ctx.globalAlpha=1;
        }else{
          ctx.fillStyle=pal.trunk;ctx.beginPath();
          ctx.moveTo(m.x-w-24,gy+40);ctx.lineTo(m.x-w,gy-60);ctx.lineTo(m.x-w*0.8,gy-340);ctx.lineTo(m.x+w*0.8,gy-340);ctx.lineTo(m.x+w,gy-60);ctx.lineTo(m.x+w+24,gy+40);ctx.closePath();
          arch();ctx.fill('evenodd');
          ctx.strokeStyle='rgba(0,0,0,0.18)';ctx.lineWidth=3;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(m.x+i*w*0.3,gy-200);ctx.lineTo(m.x+i*w*0.33,gy-330);ctx.stroke();}
          ctx.fillStyle=pal.tree;circ(ctx,m.x,gy-380,140);circ(ctx,m.x-130,gy-335,100);circ(ctx,m.x+130,gy-335,100);circ(ctx,m.x-60,gy-450,90);circ(ctx,m.x+75,gy-440,85);
          ctx.fillStyle=pal.treeDk;ell(ctx,m.x+60,gy-340,110,40,0);
        }
      }
    }
  }
  drawGround(pal){
    const ctx=this.ctx,T=this.world.terrain,c=this.cam,z=c.zoom;
    const xl=c.x-160,xr=c.x+this.W/z+160,yb=c.y+this.H/z+140,ys=[],xs=[];
    for(let x=xl;x<=xr+10;x+=10){xs.push(x);ys.push(T.y(x));}
    ctx.fillStyle=pal.gB;ctx.beginPath();ctx.moveTo(xs[0],yb);for(let i=0;i<xs.length;i++)ctx.lineTo(xs[i],ys[i]);ctx.lineTo(xs[xs.length-1],yb);ctx.closePath();ctx.fill();
    ctx.fillStyle=pal.gDk;ctx.beginPath();ctx.moveTo(xs[0],yb);for(let i=0;i<xs.length;i++)ctx.lineTo(xs[i],ys[i]+150+Math.sin(xs[i]*0.01)*20);ctx.lineTo(xs[xs.length-1],yb);ctx.closePath();ctx.fill();
    ctx.fillStyle=pal.gT;ctx.beginPath();for(let i=0;i<xs.length;i++)ctx[i?'lineTo':'moveTo'](xs[i],ys[i]);for(let i=xs.length-1;i>=0;i--)ctx.lineTo(xs[i],ys[i]+60+Math.sin(xs[i]*0.02)*6);ctx.closePath();ctx.fill();
    ctx.strokeStyle=pal.gHi;ctx.lineWidth=6;ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<xs.length;i++)ctx[i?'lineTo':'moveTo'](xs[i],ys[i]-1);ctx.stroke();
    const kinds=DECO[pal.idx],k0=Math.floor(xl/70);
    for(let k=k0;k*70<xr;k++){
      const r=hash1(k*13+7);if(r<0.5)continue;
      const x=k*70+r*100,kind=kinds[Math.floor(hash1(k+99)*kinds.length)];
      drawDeco(ctx,kind,x,T.y(x),T.angle(x),0.8+hash1(k+5)*0.6,pal,this.clock,k);
    }
  }
  drawHogWorld(){
    const ctx=this.ctx,h=this.hog,T=this.world.terrain,c=this.center(h),st=this.state;
    const gy=T.y(c.x),hgt=Math.max(0,gy-(c.y+R)),sw=R*clamp(1.1-hgt/420,0.35,1.1);
    ctx.fillStyle='rgba(30,20,50,'+(0.22*clamp(1-hgt/420,0.3,1))+')';ell(ctx,c.x,gy+2,sw,sw*0.22,T.angle(c.x));
    if(h.shd>0){const pu=1+Math.sin(this.clock*6)*0.04;ctx.fillStyle='rgba(120,190,255,0.18)';circ(ctx,c.x,c.y,R*1.7*pu);ctx.strokeStyle='rgba(190,225,255,0.85)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(c.x,c.y,R*1.7*pu,0,TAU);ctx.stroke();}if(h.mag>0){ctx.strokeStyle='rgba(255,107,129,'+(0.25+0.2*Math.sin(this.clock*8))+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.x,c.y,R*(2+((this.clock*1.5)%1)*3),0,TAU);ctx.stroke();}
    let ang,sq=h.squash,sleepy=0,dizzy=h.stumbleT>0;
    if(h.onGround)ang=h.a*0.9;else ang=Math.atan2(h.vy,h.vx)*0.45+h.flipAng;
    if(dizzy)ang+=Math.sin(this.clock*35)*0.14;
    let curl=h.curl;
    if(st==='dying'){curl=Math.max(curl,this.dieT>0.3?1:curl);sleepy=1;}
    if(this.sleep>0.7&&st==='play')sleepy=0.5;
    const breathe=st==='menu'?Math.sin(this.clock*2.4)*0.03:0;
    if(h.inv>0&&Math.floor(this.clock*14)%2===0&&st==='play'&&h.stumbleT<=0)ctx.globalAlpha=0.55;
    ctx.save();ctx.translate(c.x,c.y+R*sq*0.6+R*breathe);ctx.rotate(ang);ctx.scale(1+sq*0.5+breathe,1-sq*0.6-breathe);
    if(h.sniffT>0)ctx.rotate(Math.sin(this.clock*30)*0.05);
    const run=h.onGround?clamp(h.s/220,0,1):0.6;
    drawHog(ctx,R,{curl,leg:h.leg,run:st==='menu'?0:run,roll:h.roll,hat:this.save.hat,blink:h.blink,sleepy,dizzy,t:this.clock});
    ctx.restore();ctx.globalAlpha=1;
  }
  drawFx(){
    const ctx=this.ctx;
    for(const f of this.fx){
      const u=f.life/f.max;ctx.globalAlpha=1-u*u;ctx.fillStyle=f.col;
      if(f.type==='smoke'){ctx.globalAlpha=0.55*(1-u)*(1-u);circ(ctx,f.x,f.y,f.size*(0.6+u*1.8));}else if(f.type==='star'){starPath(ctx,f.x,f.y,f.size*(1-u*0.4));ctx.fill();}
      else if(f.type==='petal'){ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot+f.life*4);ell(ctx,0,0,f.size,f.size*0.5,0);ctx.restore();}
      else if(f.type==='z'){ctx.font='700 '+f.size+'px '+FONT;ctx.textAlign='center';ctx.fillText('Z',f.x,f.y);}
      else circ(ctx,f.x,f.y,Math.max(0.5,f.size*(1-u*0.5)));
    }
    ctx.globalAlpha=1;
    ctx.textAlign='center';ctx.lineJoin='round';
    for(const t of this.texts){
      const u=t.life/t.max,a=u<0.15?u/0.15:1-clamp((u-0.6)/0.4,0,1),sc=1+Math.max(0,0.25-u)*1.2;
      ctx.globalAlpha=a;ctx.font='700 '+Math.round(t.size*1.45*sc)+'px '+FONT;
      ctx.lineWidth=7;ctx.strokeStyle='rgba(60,40,90,0.75)';ctx.strokeText(t.txt,t.x,t.y);ctx.fillStyle=t.col;ctx.fillText(t.txt,t.x,t.y);
    }
    ctx.globalAlpha=1;
  }
  drawAmbient(pal){
    const ctx=this.ctx,W=this.W,H=this.H,d=AMB[pal.idx],kind=d[0];
    for(const a of this.amb){
      const x=a.x*W,y=a.y*H,s=a.sz;
      if(kind==='firefly'){const gl=0.5+0.5*Math.sin(this.clock*2.5+a.ph);ctx.globalAlpha=0.25+0.5*gl;ctx.fillStyle=d[1];circ(ctx,x,y,7*s);ctx.globalAlpha=0.9*gl+0.1;circ(ctx,x,y,2.2*s);}
      else if(kind==='spore'){ctx.globalAlpha=0.55;ctx.fillStyle=d[1];circ(ctx,x,y,2.6*s);}
      else if(kind==='dust'){ctx.globalAlpha=0.5;ctx.fillStyle=d[1];circ(ctx,x,y,1.8*s);}
      else{ctx.save();ctx.translate(x,y);ctx.rotate(this.clock*1.5+a.ph);ctx.globalAlpha=0.85;ctx.fillStyle=d[1];ell(ctx,0,0,(kind==='leaf'?7:5)*s,3*s,0);ctx.restore();}
    }
    ctx.globalAlpha=1;
  }
  pill(x,y,w,h,fill){const ctx=this.ctx,r=h/2;ctx.fillStyle=fill||'rgba(255,255,255,0.82)';ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();}
  drawHud(){
    const ctx=this.ctx,W=this.W,u=clamp(Math.min(W,this.H*1.6)/800,0.78,1.15),pad=12*u;
    ctx.textBaseline='middle';
    // дистанция и очки
    this.pill(pad,pad,150*u,50*u,'rgba(255,255,255,0.82)');
    ctx.textAlign='left';ctx.fillStyle='#2a2540';ctx.font='700 '+22*u+'px '+FONT;ctx.fillText(fmt(this.dist)+' м',pad+16*u,pad+18*u);
    ctx.font='600 '+12*u+'px '+FONT;ctx.fillStyle='#6a6585';ctx.fillText('Очки '+fmt(this.score),pad+16*u,pad+37*u);
    // сонливость
    const by=pad+58*u;this.pill(pad,by,150*u,24*u,'rgba(255,255,255,0.82)');
    drawGlyph(ctx,'moon',pad+15*u,by+12*u,7*u,'#6a6585');
    const bx=pad+30*u,bw=110*u,bh=9*u,by2=by+7.5*u;
    ctx.fillStyle='rgba(120,110,170,0.25)';this.pill(bx,by2,bw,bh,'rgba(120,110,170,0.25)');
    const fill=clamp(this.sleep,0,1),pulse=this.sleep>0.7?0.75+0.25*Math.sin(this.clock*8):1;
    if(fill>0.02){const g=ctx.createLinearGradient(bx,0,bx+bw,0);g.addColorStop(0,'#9fb4ff');g.addColorStop(1,'#ff8fb8');ctx.globalAlpha=pulse;this.pill(bx,by2,Math.max(bh,bw*fill),bh,g);ctx.globalAlpha=1;}
    const hh=this.hog;let py=by+32*u;[['magnet',hh.mag,1,'#ff6b81'],['feather',hh.fea,1,'#e0b628'],['boost',hh.boostT,1,'#e8467c'],['shield',hh.shd>0?1:0,0,'#6bb8ff']].forEach(p=>{if(p[1]>0){this.pill(pad,py,(p[2]?66:36)*u,22*u,'rgba(255,255,255,0.82)');drawGlyph(ctx,p[0],pad+17*u,py+11*u,7*u,p[3]);if(p[2]){ctx.textAlign='left';ctx.font='600 '+13*u+'px '+FONT;ctx.fillStyle='#2a2540';ctx.fillText(Math.ceil(p[1])+' с',pad+30*u,py+12*u);}py+=26*u;}});
    // ягоды
    const bt=fmt(this.run.berries),bwid=Math.max(80*u,(bt.length*11+48)*u);
    this.pill(W-pad-bwid,pad,bwid,34*u,'rgba(255,255,255,0.82)');
    drawGlyph(ctx,'berry',W-pad-bwid+20*u,pad+17*u,9*u,'#e8467c');
    ctx.textAlign='center';ctx.font='700 '+17*u+'px '+FONT;ctx.fillStyle='#2a2540';ctx.fillText(bt,W-pad-bwid/2+10*u,pad+18*u);
    // комбо
    if(this.combo>0){
      const cx=W/2,cy=pad+28*u,rr=24*u;
      ctx.fillStyle='rgba(255,255,255,0.82)';circ(ctx,cx,cy,rr);
      ctx.strokeStyle='#ff8fb8';ctx.lineWidth=4*u;ctx.lineCap='round';ctx.beginPath();ctx.arc(cx,cy,rr-2*u,-Math.PI/2,-Math.PI/2+TAU*clamp(this.comboT/8,0,1));ctx.stroke();
      ctx.fillStyle='#2a2540';ctx.font='700 '+(this.combo>=5?22:19)*u+'px '+FONT;ctx.fillText('×'+this.mult(),cx,cy+1);
    }
    // баннеры
    if(this.banners.length){
      const b=this.banners[0],a=clamp(Math.min(b.t/0.3,(2.8-b.t)/0.5),0,1);
      ctx.globalAlpha=a;ctx.font='700 '+18*u+'px '+FONT;const tw=ctx.measureText(b.txt).width+36*u;
      this.pill(W/2-tw/2,pad+64*u,tw,34*u,'rgba(255,255,255,0.88)');ctx.fillStyle='#2a2540';ctx.textAlign='center';ctx.fillText(b.txt,W/2,pad+82*u);ctx.globalAlpha=1;
    }
    ctx.textBaseline='alphabetic';
  }
  draw(){
    const ctx=this.ctx,pal=this.pal,W=this.W,H=this.H,c=this.cam,z=c.zoom,an=W*0.3;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.drawSky(pal);this.peaks(pal);this.drawLife('sky',pal);
    this.layer(FAR,pal.far);this.farProps(pal);this.layer(MID,pal.mid);this.trees(pal);this.drawLife('mid',pal);
    ctx.save();
    if(this.shake>0){ctx.translate((Math.random()-0.5)*this.shake*13,(Math.random()-0.5)*this.shake*13);}
    ctx.translate(an,H*0.6);ctx.rotate(c.roll+(this.shake>0?(Math.random()-0.5)*this.shake*0.022:0));ctx.translate(-an,-H*0.6);
    ctx.scale(z,z);ctx.translate(-c.x,-c.y);
    this.drawGround(pal);this.drawMarks(0,pal);
    for(const o of this.world.obstacles){if(o.dead||o.x<c.x-80||o.x>c.x+W/z+80)continue;drawObstacle(ctx,o,this.world.terrain,pal,this.clock);}
    for(const k of this.world.pickups){if(k.got||k.x<c.x-40||k.x>c.x+W/z+40)continue;drawPickup(ctx,k,this.clock);}
    this.drawHogWorld();this.drawMarks(1,pal);this.drawFx();
    ctx.restore();
    this.fgGrass(pal);this.drawLife('fg',pal);this.drawAmbient(pal);this.drawSpeed();
    if(this.flash>0&&!this.reduce){ctx.fillStyle='rgba(255,255,255,'+Math.min(0.5,this.flash)*0.5+')';ctx.fillRect(0,0,W,H);}
    if(this.sleep>0.5&&this.state==='play'){const al=(this.sleep-0.5)*0.9,g=ctx.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.95);g.addColorStop(0,'rgba(20,16,60,0)');g.addColorStop(1,'rgba(20,16,60,'+al+')');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
    if(this.state!=='menu')this.drawHud();
  }
}

/* ===== интерфейс: оверлеи, ввод, магазин шляп ===== */
const CTRL=new Set(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD']);
function drawPreview(cv,hat,r,sz){
  const dpr=2,w=sz[0],h=sz[1];cv.style.width=w+'px';cv.style.height=h+'px';
  cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
  const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  ctx.save();ctx.translate(w*0.46,h*0.58);drawHog(ctx,r,{curl:0,run:0,hat,blink:0,leg:0.4});ctx.restore();
}
function mount(container,opts){
  opts=opts||{};
  const save=loadSave(),audio=makeAudio(save);
  const hasFs=!!(container.requestFullscreen||document.documentElement.requestFullscreen);
  container.innerHTML=
  '<div class="hh-root">'+
    '<div class="hh-bar">'+
      (opts.onBack?'<button class="btn2 hh-back" type="button">'+ic('back')+' Другое</button>':'')+
      '<div class="hh-title"><span class="hh-name">Ёжик-кувырок</span></div>'+
      '<div class="hh-tools">'+
        '<button class="btn2 hh-tool" data-act="sfx" type="button" title="Звуковые эффекты"></button>'+
        '<button class="btn2 hh-tool" data-act="music" type="button" title="Фоновая музыка"></button>'+
        '<button class="btn2 hh-tool" data-act="pause" type="button" title="Пауза (P)" aria-label="Пауза">'+ic('pause')+'</button>'+
        (hasFs?'<button class="btn2 hh-tool" data-act="fs" type="button" title="Во весь экран" aria-label="Во весь экран">'+ic('full')+'</button>':'')+
      '</div>'+
    '</div>'+
    '<div class="hh-stage">'+
      '<canvas class="hh-canvas"></canvas>'+
      '<div class="hh-ov hh-start"></div><div class="hh-ov hh-pause"></div><div class="hh-ov hh-over"></div><div class="hh-ov hh-hats"></div>'+
    '</div>'+
    '<div class="hh-foot">Зажми — катиться, отпусти — прыжок · в воздухе: слева / ← / A — бэкфлип, справа / → / D — фронтфлип · P — пауза</div>'+
  '</div>';
  const $=s=>container.querySelector(s);
  const root=$('.hh-root'),stage=$('.hh-stage'),cv=$('.hh-canvas');
  const ovs={start:$('.hh-start'),pause:$('.hh-pause'),over:$('.hh-over'),hats:$('.hh-hats')};
  let pc=0;const kbuf=[],KON='ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,KeyB,KeyA';let screen='start',overAt=0,raf=0,last=performance.now(),dead=false;
  const game=new Game(cv,{save,audio,cb:{
    onState(s){
      if(s==='paused')show('pause');
      else if(s==='play')show(null);
      else if(s==='menu'){renderStart();show('start');}
    },
    onOver(sum){renderOver(sum);overAt=Date.now();show('over');audio.sfx(sum.newBest.dist||sum.newBest.score?'unlock':'click');}
  }});
  function show(n){screen=n;Object.keys(ovs).forEach(k=>ovs[k].classList.toggle('hh-on',k===n));}
  function toolLabels(){
    const s=$('[data-act=sfx]'),m=$('[data-act=music]');
    s.innerHTML=ic(audio.state.sfx?'sound':'mute')+' Звук';s.setAttribute('aria-pressed',audio.state.sfx);
    m.innerHTML=ic('music')+' Музыка';m.setAttribute('aria-pressed',audio.state.music);
  }
  function goalsHtml(){
    return save.daily.goals.map(g=>{
      const d=goalDef(g.id),pc=Math.round(100*clamp(g.prog/g.target,0,1));
      const prog=g.id==='time'?fmtTime(g.prog)+' / '+fmtTime(g.target):fmt(g.prog)+' / '+fmt(g.target);
      return '<li class="hh-goal'+(g.done?' hh-done':'')+'"><div class="hh-gbar" style="width:'+pc+'%"></div><span class="hh-gt">'+ic(g.done?'check':'target')+' '+d.text(g.target)+'</span><span class="hh-gp">'+(g.done?'+'+GOAL_REWARD+' '+gl('berry'):prog)+'</span></li>';
    }).join('');
  }
  function renderStart(){
    const b=save.best;
    ovs.start.innerHTML=
    '<div class="hh-card">'+
      '<canvas class="hh-prev"></canvas>'+
      '<h2 class="hh-h">Ёжик-кувырок</h2>'+
      '<p class="hh-sub">Катись с холмов, взлетай и крути кувырки.<br>Главное — не дать ёжику уснуть.</p>'+
      '<div class="hh-row"><button class="btn2 btn-primary hh-big" data-act="play" type="button">'+ic('play')+' Играть</button><button class="btn2 hh-big" data-act="hats" type="button">Шляпы</button></div>'+
      '<div class="hh-chips"><span class="hh-chip" title="Ягоды">'+gl('berry')+fmt(save.berries)+'</span><span class="hh-chip" title="Рекорд дистанции">'+ic('flag')+fmt(b.dist)+' м</span><span class="hh-chip" title="Рекорд очков">'+ic('star')+fmt(b.score)+'</span><span class="hh-chip" title="Лучшее комбо">'+ic('flame')+'×'+fmt(b.combo)+'</span></div>'+
      '<div class="hh-sec">Цели дня</div><ul class="hh-goals">'+goalsHtml()+'</ul>'+
      '<ul class="hh-help">'+
        '<li><span class="hh-hl">'+key('Пробел')+'</span><span><b>Зажми</b> экран или пробел — свернуться в шар: на спусках разгоняешься сильнее.</span></li>'+
        '<li><span class="hh-hl">'+key('up')+'</span><span><b>Отпусти</b> — прыжок с облачком дыма: чем быстрее катишься и дольше держишь, тем выше.</span></li>'+
        '<li class="hh-keys"><span>'+key('left')+key('A')+' бэкфлип</span><span>'+key('right')+key('D')+' фронтфлип</span><span>'+key('down')+key('S')+' резко вниз</span></li>'+
        '<li><span class="hh-hl">'+gl('apple')+'</span><span>Яблоки бодрят, камни и брёвна утомляют. Приземляйся вдоль склона — «Идеально!» и ускорение.</span></li>'+
        '<li class="hh-keys"><span>'+gl('magnet')+' магнит</span><span>'+gl('shield')+' щит</span><span>'+gl('feather')+' пёрышко</span><span>'+gl('berry')+' ягоды на шляпы</span></li>'+
      '</ul>'+
    '</div>';
    drawPreview($('.hh-prev'),save.hat,36,[140,110]);
  }
  function renderOver(s){
    const nb=s.newBest,flag=k=>nb[k]?' <i class="hh-new">рекорд!</i>':'';
    ovs.over.innerHTML=
    '<div class="hh-card">'+
      '<h2 class="hh-h">Ёжик уснул</h2>'+
      '<div class="hh-stat-grid">'+
        '<div><b>'+fmt(s.dist)+' м</b><span>Дистанция'+flag('dist')+'</span></div>'+
        '<div><b>'+fmt(s.score)+'</b><span>Очки'+flag('score')+'</span></div>'+
        '<div><b>×'+s.combo+'</b><span>Макс. комбо'+flag('combo')+'</span></div>'+
        '<div><b>'+fmtTime(s.time)+'</b><span>Время</span></div>'+
        '<div><b>'+s.flips+'</b><span>Кувырки</span></div>'+
        '<div><b>+'+s.berries+'</b><span>Ягоды</span></div>'+
      '</div>'+
      '<div class="hh-sec">Цели дня</div><ul class="hh-goals">'+goalsHtml()+'</ul>'+
      '<div class="hh-row"><button class="btn2 btn-primary hh-big" data-act="again" type="button">'+ic('again')+' Ещё раз</button><button class="btn2 hh-big" data-act="menu" type="button">Меню</button></div>'+
    '</div>';
  }
  function renderPause(){
    ovs.pause.innerHTML='<div class="hh-card hh-small"><h2 class="hh-h">Пауза</h2><div class="hh-row"><button class="btn2 btn-primary hh-big" data-act="resume" type="button">'+ic('play')+' Продолжить</button><button class="btn2 hh-big" data-act="quit" type="button">В меню</button></div></div>';
  }
  function renderHats(){
    ovs.hats.innerHTML=
    '<div class="hh-card hh-wide">'+
      '<h2 class="hh-h">Шляпы</h2><p class="hh-sub">У тебя <b>'+fmt(save.berries)+'</b> ягод. Ягоды собираются в забегах и за цели дня.</p>'+
      '<div class="hh-hatgrid">'+HATS.map(h=>{
        const own=save.owned.includes(h.id),sel=save.hat===h.id;
        return '<button type="button" class="hh-hat'+(sel?' hh-sel':'')+(own?'':' hh-lock')+'" data-hat="'+h.id+'"><canvas></canvas><b>'+h.name+'</b><span>'+(sel?'Надето':own?'Надеть':gl('berry')+' '+h.cost)+'</span></button>';
      }).join('')+'</div>'+
      '<div class="hh-row"><button class="btn2 btn-primary hh-big" data-act="back" type="button">'+ic('back')+' Назад</button></div>'+
    '</div>';
    ovs.hats.querySelectorAll('.hh-hat').forEach(el=>drawPreview(el.querySelector('canvas'),el.dataset.hat,22,[72,72]));
  }
  function startGame(){audio.resume();audio.sfx('click');game.start();show(null);}
  function act(a,btn){
    if(btn&&btn.blur)btn.blur();
    switch(a){
      case 'play':case 'again':startGame();break;
      case 'hats':audio.sfx('click');renderHats();show('hats');break;
      case 'back':audio.sfx('click');renderStart();show('start');break;
      case 'menu':case 'quit':audio.sfx('click');persist(save);game.toMenu();break;
      case 'resume':audio.sfx('click');game.resume();break;
      case 'pause':if(game.state==='play'){renderPause();game.pause();}else if(game.state==='paused')game.resume();break;
      case 'sfx':audio.setSfx(!audio.state.sfx);save.sfx=audio.state.sfx;persist(save);toolLabels();break;
      case 'music':audio.setMusic(!audio.state.music);save.music=audio.state.music;persist(save);toolLabels();break;
      case 'fs':
        if(document.fullscreenElement){if(document.exitFullscreen)document.exitFullscreen();}
        else{const el=root.requestFullscreen?root:document.documentElement;if(el.requestFullscreen)el.requestFullscreen().catch(()=>{});}
        break;
    }
  }
  function onClick(e){
    const pv=e.target.closest('.hh-prev');
    if(pv&&container.contains(pv)){pc++;audio.sfx('flower');pv.classList.remove('hh-boing');void pv.offsetWidth;pv.classList.add('hh-boing');const sb=$('.hh-start .hh-sub');if(sb&&pc===5)sb.innerHTML='Эй! Не тыкай ёжика.<br>Он щекотки боится.';if(sb&&pc===12)sb.innerHTML='Ладно, секрет: нажми H во время игры.';return;}
    const hat=e.target.closest('[data-hat]');
    if(hat&&container.contains(hat)){
      const h=HATS.find(x=>x.id===hat.dataset.hat);if(!h)return;
      if(save.owned.includes(h.id)){save.hat=h.id;audio.sfx('click');}
      else if(save.berries>=h.cost){save.berries-=h.cost;save.owned.push(h.id);save.hat=h.id;audio.sfx('unlock');}
      else{audio.sfx('nope');hat.classList.remove('hh-shake');void hat.offsetWidth;hat.classList.add('hh-shake');return;}
      persist(save);renderHats();return;
    }
    const b=e.target.closest('[data-act]');
    if(b&&container.contains(b)){e.preventDefault();act(b.dataset.act,b);}
    else if(e.target.closest('.hh-back')&&opts.onBack){persist(save);opts.onBack();}
  }
  function setPointer(e){const r=cv.getBoundingClientRect();game.input.pointerX=(e.clientX-r.left)/Math.max(1,r.width);}
  function onPD(e){
    if(game.state!=='play')return;
    e.preventDefault();audio.resume();game.input.pointer=true;setPointer(e);
    try{cv.setPointerCapture(e.pointerId);}catch(_){}
    if(game.hog.onGround)audio.sfx('curl');
  }
  function onPM(e){if(game.input.pointer)setPointer(e);}
  function onPU(){game.input.pointer=false;}
  function onKeyDown(e){
    const t=e.target;
    if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable))return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const code=e.code,st=game.state;
    kbuf.push(code);if(kbuf.length>10)kbuf.shift();
    if(st==='play'&&kbuf.join()===KON){kbuf.length=0;game.easter();}
    if(code==='KeyH'&&st==='play'){if(!e.repeat)game.snort();return;}
    if(code==='KeyP'||code==='Escape'){
      if(st==='play'){renderPause();game.pause();}else if(st==='paused')game.resume();else return;
      e.preventDefault();return;
    }
    if(!CTRL.has(code)&&code!=='Enter'&&code!=='KeyR')return;
    if(code==='KeyR'&&st!=='over')return;
    e.preventDefault();if(e.repeat)return;
    if(st==='menu'){if(screen==='start'&&(code==='Space'||code==='Enter'))startGame();return;}
    if(st==='over'){if(Date.now()-overAt>700&&(code==='Space'||code==='Enter'||code==='KeyR'))startGame();return;}
    if(st==='paused'){if(code==='Space'||code==='Enter')game.resume();return;}
    if(st==='play'&&CTRL.has(code)){game.input.keys.add(code);if(game.hog.onGround)audio.sfx('curl');}
  }
  function onKeyUp(e){
    if(CTRL.has(e.code)){game.input.keys.delete(e.code);const t=e.target;if(!(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))))e.preventDefault();}
  }
  function onBlur(){game.input.keys.clear();game.input.pointer=false;if(game.state==='play'){renderPause();game.pause();}}
  function onVis(){if(document.hidden&&game.state==='play'){renderPause();game.pause();}}
  function fit(){const r=stage.getBoundingClientRect();game.resize(r.width,r.height,Math.min(global.devicePixelRatio||1,2));}
  const ro=global.ResizeObserver?new ResizeObserver(fit):null;if(ro)ro.observe(stage);else global.addEventListener('resize',fit);
  container.addEventListener('click',onClick);
  cv.addEventListener('pointerdown',onPD);cv.addEventListener('pointermove',onPM);
  ['pointerup','pointercancel','lostpointercapture'].forEach(n=>cv.addEventListener(n,onPU));
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  global.addEventListener('keydown',onKeyDown);global.addEventListener('keyup',onKeyUp);
  global.addEventListener('blur',onBlur);document.addEventListener('visibilitychange',onVis);
  function loop(t){if(dead)return;raf=requestAnimationFrame(loop);const dt=(t-last)/1000;last=t;game.frame(dt);}
  toolLabels();renderStart();renderPause();show('start');fit();
  if(audio.state.music)audio.setMusic(true);
  raf=requestAnimationFrame(t=>{last=t;loop(t);});
  return function destroy(){
    dead=true;cancelAnimationFrame(raf);if(ro)ro.disconnect();else global.removeEventListener('resize',fit);
    global.removeEventListener('keydown',onKeyDown);global.removeEventListener('keyup',onKeyUp);
    global.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',onVis);
    persist(save);audio.destroy();container.innerHTML='';
  };
}

export const HedgehogGame = { mount };
