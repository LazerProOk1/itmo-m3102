#!/usr/bin/env node
/*
  Обновление мини-игры «Ёжик-кувырок» (встроена в index.html): новые шляпы, бонусы, цель дня и пасхалки.

  Запуск из корня репозитория:
    node tools/apply-hedgehog-update.mjs --dry   — показать, что будет сделано
    node tools/apply-hedgehog-update.mjs         — применить

  Безопасно запускать повторно: уже внесённые правки пропускаются. Если хоть один якорь не найден,
  НИЧЕГО не записывается. Перед записью создаются index.html.hh.bak и sw.js.hh.bak. Откат — git checkout.
  Номер кэша в sw.js поднимается автоматически, иначе установленные копии сайта останутся со старой игрой.
*/
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
let failed = false;

const indexPath = join(root, 'index.html'), swPath = join(root, 'sw.js');
const indexOrig = readFileSync(indexPath, 'utf8'), swOrig = readFileSync(swPath, 'utf8');
let html = indexOrig;

const log = (state, what) => console.log(`${state === 'ok' ? '+' : state === 'skip' ? '=' : 'x'} ${what}`);
function step(what, done, apply) {
  if (done(html)) return log('skip', what);
  const next = apply(html);
  if (next == null || next === html) { failed = true; return log('fail', `${what} — якорь не найден`); }
  html = next; log('ok', what);
}
// from → to; all=true заменяет все вхождения
const rep = (what, done, from, to, all = false) =>
  step(what, done, t => (t.includes(from) ? (all ? t.split(from).join(to) : t.replace(from, () => to)) : null));

/* ================= 1. Данные: шляпы, бонусы, цели ================= */
rep('Новые шляпы (колпак, каска, маг, пропеллер, нимб, секретная фольга)', t => t.includes("id:'wizard'"),
  `{id:'crown',name:'Корона',cost:600}`,
  `{id:'chef',name:'Поварской колпак',cost:130,perk:'Яблоки бодрят сильнее'},{id:'helmet',name:'Каска',cost:220,perk:'Старт со щитом'},{id:'wizard',name:'Колпак мага',cost:280,perk:'Ягоды сами подлетают'},{id:'propeller',name:'Пропеллер',cost:400,perk:'Дольше в воздухе'},{id:'halo',name:'Нимб',cost:450,perk:'Бодрость копится медленнее'},{id:'foil',name:'Шапочка из фольги',cost:0,secret:true,perk:'Бонусы действуют дольше'},{id:'crown',name:'Корона',cost:600}`);

rep('Список бонусов POWER_KINDS', t => t.includes('const POWER_KINDS'),
  'const GOAL_REWARD=20;',
  `const GOAL_REWARD=20;\nconst POWER_KINDS=['magnet','shield','feather','coffee','star'];`);

rep('Новая цель дня «Подбери N бонусов»', t => t.includes("id:'powers'"),
  `{id:'apples',amounts:[1,2,3],scope:'day',text:n=>'Съешь '+n+' '+pl(n,'яблоко','яблока','яблок')}`,
  `{id:'apples',amounts:[1,2,3],scope:'day',text:n=>'Съешь '+n+' '+pl(n,'яблоко','яблока','яблок')},{id:'powers',amounts:[2,4,6],scope:'day',text:n=>'Подбери '+n+' '+pl(n,'бонус','бонуса','бонусов')}`);

rep('Новые вехи дистанции (404, 500, 2048 м)', t => t.includes('404:'),
  ",1337:'",
  `,404:'🔍 404 м — ёжик не найден',500:'🏃 500 м — лёгкая разминка',2048:'🎮 2048 м — 2^11 одобряет',1337:'`);

/* ================= 2. Бонусы: кофе и звезда ================= */
rep('Поля cof / stm у ёжика', t => t.includes('cof:0,stm:0'), 'mag:0,shd:0,fea:0,takeX:0', 'mag:0,shd:0,fea:0,cof:0,stm:0,takeX:0');
rep('Кофе и звезда появляются в мире', t => t.includes("'feather','coffee','star'][(r()*5)|0]"),
  "['magnet','shield','feather'][(r()*3)|0]", "['magnet','shield','feather','coffee','star'][(r()*5)|0]");
rep('Проверки вида бонуса через POWER_KINDS', t => t.includes('POWER_KINDS.includes(k.kind)'),
  "k.kind==='magnet'||k.kind==='shield'||k.kind==='feather'", 'POWER_KINDS.includes(k.kind)', true);
rep('Цвет значка нового бонуса', t => t.includes("coffee:'#b9794a'"), "const col={magnet:'#ff6b81',", "const col={coffee:'#b9794a',star:'#ffd84a',magnet:'#ff6b81',");
rep('Эмодзи нового бонуса', t => t.includes("{coffee:'☕'"), "ctx.fillText({magnet:'🧲',", "ctx.fillText({coffee:'☕',star:'⭐',magnet:'🧲',");
rep('Подписи при подборе кофе/звезды', t => t.includes("coffee:['Кофе! ☕'"),
  "const h=this.hog,m={magnet:['Магнит! 🧲','#ffb3c1'],", "const h=this.hog,m={coffee:['Кофе! ☕','#e0b48a'],star:['Звезда! ⭐','#fff3a8'],magnet:['Магнит! 🧲','#ffb3c1'],");
rep('Эффекты бонусов (кофе: сон=0 и рывок; звезда: неуязвимость; фольга: ×1,5 по времени)', t => t.includes("const pm=this.save.hat==='foil'"),
  "if(k.kind==='magnet')h.mag=9;else if(k.kind==='shield')h.shd=25;else h.fea=8;",
  "const pm=this.save.hat==='foil'?1.5:1;if(k.kind==='magnet')h.mag=9*pm;else if(k.kind==='shield')h.shd=25;else if(k.kind==='coffee'){h.cof=8*pm;this.sleep=0;h.boostT=Math.max(h.boostT,3);h.s+=80;}else if(k.kind==='star')h.stm=8*pm;else h.fea=8*pm;");
rep('Цель дня «бонусы» считается при подборе', t => t.includes("this.dayAdd('powers',1)"),
  "this.audio.sfx('mush');this.trick+=75*this.mult();this.flash=0.15;",
  "this.audio.sfx('mush');this.trick+=75*this.mult();this.flash=0.15;this.dayAdd('powers',1);");
rep('Таймеры кофе и звезды', t => t.includes('if(h.cof>0)h.cof-=dt;'),
  'if(h.mag>0)h.mag-=dt;if(h.fea>0)h.fea-=dt;', 'if(h.mag>0)h.mag-=dt;if(h.fea>0)h.fea-=dt;if(h.cof>0)h.cof-=dt;if(h.stm>0)h.stm-=dt;');
rep('Звезда: неуязвимость к спотыканиям', t => t.includes('if(this.hog.stm>0)return;'),
  'stumble(sev,txt,fromLanding){', 'stumble(sev,txt,fromLanding){if(this.hog.stm>0)return;');
rep('Звезда: удар по препятствию без потери бодрости', t => t.includes('else if(h.stm<=0){this.sleep'),
  'else{this.sleep=Math.min(1,this.sleep+0.12);', 'else if(h.stm<=0){this.sleep=Math.min(1,this.sleep+0.12);');
rep('Звезда: ягоды ×2', t => t.includes('const bb=this.hog.stm>0?2:1'),
  'h.berryStreak++;h.berryT=0.9;this.save.berries++;this.run.berries++;',
  'h.berryStreak++;h.berryT=0.9;const bb=this.hog.stm>0?2:1;this.save.berries+=bb;this.run.berries+=bb;');
rep('HUD: плашки кофе и звезды', t => t.includes("[['☕',hh.cof,1]"), "[['🧲',hh.mag,1],", "[['☕',hh.cof,1],['⭐',hh.stm,1],['🧲',hh.mag,1],");
rep('Золотое свечение вокруг ёжика со звездой', t => t.includes('if(h.stm>0){ctx.fillStyle'),
  'let ang,sq=h.squash,sleepy=0,dizzy=h.stumbleT>0;',
  "if(h.stm>0){ctx.fillStyle='rgba(255,224,102,'+(0.18+0.1*Math.sin(this.clock*10))+')';circ(ctx,c.x,c.y,R*1.9);}let ang,sq=h.squash,sleepy=0,dizzy=h.stumbleT>0;");

/* ================= 3. Свойства шляп ================= */
rep('Колпак мага: слабый магнит на ягоды', t => t.includes("this.save.hat==='wizard'"),
  "if(h.mag>0&&k.kind==='berry'){const mx=c.x-k.x,my=c.y-k.y,md=Math.hypot(mx,my);if(md<320&&md>1){",
  "if((h.mag>0||this.save.hat==='wizard')&&k.kind==='berry'){const mx=c.x-k.x,my=c.y-k.y,md=Math.hypot(mx,my);if(md<(h.mag>0?320:150)&&md>1){");
rep('Каска: старт забега со щитом', t => t.includes("this.save.hat==='helmet'"),
  'this.hog=this.newHog();this.hog.y=this.world.terrain.y(this.hog.x);',
  "this.hog=this.newHog();this.hog.y=this.world.terrain.y(this.hog.x);if(!menu&&this.save.hat==='helmet')this.hog.shd=25;");
rep('Нимб: бодрость копится медленнее; кофе обнуляет сонливость', t => t.includes("this.save.hat==='halo'"),
  'this.sleep=Math.max(0,this.sleep-dt*lerp(0.03,0.016,pc));',
  "this.sleep=Math.max(0,this.sleep-dt*lerp(0.03,0.016,pc)*(this.save.hat==='halo'?1.5:1));if(h.cof>0)this.sleep=0;");
rep('Поварской колпак: яблоки бодрят сильнее', t => t.includes("this.save.hat==='chef'"),
  'this.sleep=Math.max(0,this.sleep-0.25);this.run.apples++;',
  "this.sleep=Math.max(0,this.sleep-(this.save.hat==='chef'?0.4:0.25));this.run.apples++;");
rep('Пропеллер: слабее гравитация в воздухе', t => t.includes("this.save.hat==='propeller'"),
  'h.vy+=(down?G*1.6:GA*(h.fea>0?0.55:1))*dt;',
  "h.vy+=(down?G*1.6:GA*(h.fea>0?0.55:this.save.hat==='propeller'?0.85:1))*dt;");

/* ================= 4. Рисование шляп ================= */
rep('Рисунки новых шляп', t => t.includes("id==='chef'"),
  "}else if(id==='crown'){",
  `}else if(id==='chef'){
    ctx.fillStyle='#f4f4f8';circ(ctx,-0.22*R,-0.42*R,0.2*R);circ(ctx,0.22*R,-0.42*R,0.2*R);circ(ctx,0,-0.58*R,0.24*R);ctx.fillRect(-0.3*R,-0.3*R,0.6*R,0.3*R);ctx.fillStyle='#dfe1ea';ctx.fillRect(-0.3*R,-0.08*R,0.6*R,0.08*R);
  }else if(id==='helmet'){
    ctx.fillStyle='#f2c230';ctx.beginPath();ctx.arc(0,0,0.52*R,Math.PI,0);ctx.closePath();ctx.fill();ctx.fillStyle='#d9a516';ctx.fillRect(-0.06*R,-0.52*R,0.12*R,0.5*R);ell(ctx,0,0,0.62*R,0.08*R,0);ctx.fillStyle='#fff7c2';circ(ctx,0.2*R,-0.3*R,0.05*R);
  }else if(id==='wizard'){
    ctx.fillStyle='#5b4bd6';ctx.beginPath();ctx.moveTo(-0.4*R,0);ctx.lineTo(0.4*R,0);ctx.lineTo(0.12*R,-1.0*R);ctx.closePath();ctx.fill();ctx.fillStyle='#463bb0';ell(ctx,0,0,0.62*R,0.1*R,0);ctx.fillStyle='#ffe066';starPath(ctx,-0.05*R,-0.38*R,0.1*R);ctx.fill();circ(ctx,0.1*R,-0.66*R,0.05*R);
  }else if(id==='propeller'){
    ctx.fillStyle='#e8465a';ctx.beginPath();ctx.arc(0,0,0.42*R,Math.PI,0);ctx.closePath();ctx.fill();ctx.fillStyle='#4aa8ff';ell(ctx,-0.26*R,-0.52*R,0.3*R,0.05*R,-0.12);ctx.fillStyle='#ffd84a';ell(ctx,0.26*R,-0.52*R,0.3*R,0.05*R,0.12);ctx.fillStyle='#333';ctx.fillRect(-0.03*R,-0.5*R,0.06*R,0.1*R);circ(ctx,0,-0.52*R,0.06*R);
  }else if(id==='halo'){
    ctx.strokeStyle='rgba(255,224,102,0.35)';ctx.lineWidth=0.2*R;ctx.beginPath();ctx.ellipse(0,-0.5*R,0.4*R,0.11*R,0,0,TAU);ctx.stroke();ctx.strokeStyle='#ffe066';ctx.lineWidth=0.09*R;ctx.beginPath();ctx.ellipse(0,-0.5*R,0.4*R,0.11*R,0,0,TAU);ctx.stroke();
  }else if(id==='foil'){
    ctx.fillStyle='#cfd6df';ctx.beginPath();ctx.moveTo(-0.36*R,0);ctx.lineTo(-0.22*R,-0.5*R);ctx.lineTo(-0.02*R,-0.34*R);ctx.lineTo(0.18*R,-0.62*R);ctx.lineTo(0.36*R,0);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=0.04*R;ctx.beginPath();ctx.moveTo(-0.22*R,-0.5*R);ctx.lineTo(-0.1*R,-0.1*R);ctx.moveTo(0.18*R,-0.62*R);ctx.lineTo(0.1*R,-0.1*R);ctx.stroke();
  }else if(id==='crown'){`);

/* ================= 5. Магазин шляп ================= */
rep('Магазин: секретные шляпы скрыты, пока не найдены', t => t.includes('!h.secret||save.owned.includes(h.id)'),
  `'<div class="hh-hatgrid">'+HATS.map(h=>{`,
  `'<div class="hh-hatgrid">'+HATS.filter(h=>!h.secret||save.owned.includes(h.id)).map(h=>{`);
rep('Магазин: описание свойства шляпы', t => t.includes('class="hh-perk"'),
  `<b>'+h.name+'</b><span>'`, `<b>'+h.name+'</b>'+(h.perk?'<small class="hh-perk">'+h.perk+'</small>':'')+'<span>'`);
rep('CSS свойства шляпы', t => t.includes('.hh-hat .hh-perk'),
  '@media (prefers-reduced-motion:reduce){.hh-prev{animation:none;}}',
  '.hh-hat .hh-perk{font-size:.66rem;color:var(--muted);text-align:center;line-height:1.25;min-height:2.5em}\n@media (prefers-reduced-motion:reduce){.hh-prev{animation:none;}}');

/* ================= 6. Пасхалки ================= */
rep('Пасхалки в забеге: 42 кувырка, 7 идеальных, чистый забег, «ещё пять минуточек»', t => t.includes('eggs(){'),
  'easter(){',
  `eggs(){
    const r=this.run,c=this.center(this.hog);
    if(r.flips>=42&&!this.ms.e42){this.ms.e42=1;this.addBanner('🌀 42 кувырка — ответ на всё! +42 🍓');this.save.berries+=42;r.berries+=42;this.audio.sfx('unlock');this.burst(c.x,c.y,18,{type:'star',col:'#ffe066',size:6,sp:260,life:0.9,g:0});}
    if(r.perfect>=7&&!this.ms.e7){this.ms.e7=1;this.addBanner('🍀 Семь идеальных приземлений! +7 🍓');this.save.berries+=7;r.berries+=7;this.audio.sfx('goal');}
    if(r.stumbles===0&&this.dist>=150&&!this.ms.ecl){this.ms.ecl=1;this.addBanner('✨ 150 м без единого бонка! +20 🍓');this.save.berries+=20;r.berries+=20;this.audio.sfx('goal');}
    if(this.sleep>=0.9&&this.state==='play'&&!this.ms.enap){this.ms.enap=1;this.text(c.x,c.y-R*2.4,'Ещё пять минуточек…','#c9d6ff',24);}
  }
  word(w){
    if(this.state!=='play')return;
    const h=this.hog,c=this.center(h),T=this.world.terrain;
    if(w==='fyr'){this.snort();if(!this.ms.wfyr){this.ms.wfyr=1;h.boostT=Math.max(h.boostT,2.5);}return;}
    const k='w'+w;if(this.ms[k])return;this.ms[k]=1;
    if(w==='itmo'){this.rainT=5;this.addBanner('🎓 Университет ИТМО! +10 🍓');this.save.berries+=10;this.run.berries+=10;this.audio.sfx('unlock');this.flash=0.4;}
    else if(w==='kot'){this.text(c.x,c.y-R*2.6,'Мяу.','#ffe9c2',30);this.addBanner('🐈 Кот одобряет! +7 🍓');this.save.berries+=7;this.run.berries+=7;this.audio.sfx('flower');}
    else if(w==='git'){this.addBanner('git commit -m "ягоды"');for(let i=0;i<12;i++){const a=i/12*TAU,x=c.x+320+Math.cos(a)*90;this.world.pickups.push({x,y:T.y(x)-110+Math.sin(a)*70,kind:'berry',got:false,ph:i});}this.audio.sfx('mush');}
  }
  easter(){`);
rep('Вызов eggs() каждый шаг', t => t.includes('this.eggs();'),
  'this.score=Math.floor(this.dist)+this.trick;', 'this.score=Math.floor(this.dist)+this.trick;this.eggs();');
rep('Слова-пасхалки: ITMO, FYR, KOT, GIT (без W/A/S/D/P, чтобы не мешать управлению)', t => t.includes('const WORDS='),
  'const CTRL=new Set(', `const WORDS={'KeyI,KeyT,KeyM,KeyO':'itmo','KeyF,KeyY,KeyR':'fyr','KeyK,KeyO,KeyT':'kot','KeyG,KeyI,KeyT':'git'};\nconst CTRL=new Set(`);
rep('Обработка слов при вводе', t => t.includes('Object.keys(WORDS).find'),
  "if(st==='play'&&kbuf.join()===KON){kbuf.length=0;game.easter();}",
  "if(st==='play'&&kbuf.join()===KON){kbuf.length=0;game.easter();}\n    {const tail=kbuf.join(),hit=Object.keys(WORDS).find(w=>tail.endsWith(w));if(hit&&st==='play'){kbuf.length=0;game.word(WORDS[hit]);}}");
rep('Счётчик кликов по эмодзи в заголовке', t => t.includes('let pc=0,ec=0;'), 'let pc=0;', 'let pc=0,ec=0;');
rep('Пасхалка: 7 кликов по 🦔 в заголовке — кувырок и +7 ягод (один раз)', t => t.includes('save.eggs.spin'),
  "const pv=e.target.closest('.hh-prev');",
  `const te=e.target.closest('.hh-emo');
    if(te&&container.contains(te)){ec++;te.style.display='inline-block';te.style.transition='transform .5s';te.style.transform='rotate('+(ec*360)+'deg)';audio.sfx('flip',ec);if(ec===7&&!(save.eggs||(save.eggs={})).spin){save.eggs.spin=1;save.berries+=7;persist(save);$('.hh-name').textContent='Ёжик-кувырок ×7';renderStart();}return;}
    const pv=e.target.closest('.hh-prev');`);
rep('Пасхалка: 25 кликов по ёжику на старте — секретная шапочка из фольги', t => t.includes("pc===25&&!save.owned.includes('foil')"),
  'if(pv&&container.contains(pv)){pc++;',
  "if(pv&&container.contains(pv)){pc++;if(pc===25&&!save.owned.includes('foil')){save.owned.push('foil');persist(save);audio.sfx('unlock');const sb2=$('.hh-start .hh-sub');if(sb2)sb2.innerHTML='🧢 Секретная шапочка из фольги найдена!<br>Загляни в «Шляпы».';}");

/* ================= sw.js: поднять кэш ================= */
let swNew = swOrig;
if (html !== indexOrig) {
  const m = /const CACHE = 'm3102-shell-v(\d+)';/.exec(swNew);
  if (m) { swNew = swNew.replace(m[0], `const CACHE = 'm3102-shell-v${Number(m[1]) + 1}';`); log('ok', `sw.js: CACHE v${m[1]} → v${Number(m[1]) + 1}`); }
  else console.warn('! sw.js: строка const CACHE = … не найдена — поднимите номер кэша вручную.');
}

if (failed) { console.error('\nНичего не записано: исправьте замечания выше.'); process.exit(1); }
if (html === indexOrig) { console.log('\nВсё уже применено.'); process.exit(0); }
if (dry) { console.log('\n--dry: файлы не изменены.'); process.exit(0); }
if (!existsSync(indexPath + '.hh.bak')) copyFileSync(indexPath, indexPath + '.hh.bak');
writeFileSync(indexPath, html);
if (swNew !== swOrig) { if (!existsSync(swPath + '.hh.bak')) copyFileSync(swPath, swPath + '.hh.bak'); writeFileSync(swPath, swNew); }
console.log('\nГотово. Откройте «Ещё → Ёжик-кувырок», проверьте игру; удалите *.hh.bak, когда убедитесь, что всё работает.');
