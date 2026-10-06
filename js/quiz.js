// Интерактивные тесты для конспектов: блок ```quiz внутри .md-файла.
// Типы вопросов: один ответ, несколько ответов, ввод текста. Синтаксис — в quiz-example.md.

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=a=>a[Math.floor(Math.random()*a.length)];

/* ---------- форматирование: `код`, **жирный**, *курсив*, $формулы$, блоки ~~~ ---------- */
function inline(s){
  const slots=[], keep=h=>'\u0000'+(slots.push(h)-1)+'\u0000';
  s=s.replace(/`([^`\n]+)`/g,(_,c)=>keep('<code>'+esc(c)+'</code>'));
  s=s.replace(/\$([^$\n]+?)\$/g,(m,t)=>{
    try{if(window.katex)return keep(katex.renderToString(t.trim(),{throwOnError:false}));}catch(e){}
    return m;
  });
  s=esc(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>slots[+i]).replace(/\n/g,'<br>');
}
function fmt(s){
  const re=/~~~([\w+-]*)[ \t]*\n([\s\S]*?)\n[ \t]*~~~/g, out=[];
  const para=t=>{t=t.replace(/^\n+|\n+$/g,'');if(t)out.push('<div class="quiz-p">'+inline(t)+'</div>');};
  let last=0,m;
  while((m=re.exec(s))){
    para(s.slice(last,m.index));
    let h;
    try{h=(m[1]&&window.hljs&&hljs.getLanguage(m[1]))?hljs.highlight(m[2],{language:m[1]}).value:esc(m[2]);}catch(e){h=esc(m[2]);}
    out.push('<pre><code class="hljs">'+h+'</code></pre>');
    last=re.lastIndex;
  }
  para(s.slice(last));
  return out.join('');
}

/* ---------- разбор текстового формата ---------- */
const KEYS={title:'title',название:'title',заголовок:'title',type:'type',тип:'type',
  explain:'explain',объяснение:'explain',пояснение:'explain',correct:'correct',верно:'correct',wrong:'wrong',неверно:'wrong'};
const TYPES={single:'single',один:'single',multi:'multi',несколько:'multi',text:'text',текст:'text',ввод:'text'};

export function parseQuiz(src){
  const lines=String(src).replace(/\r/g,'').split('\n');
  const data={title:'',questions:[]};
  let q=null,field=null,opt=null,fence=false;
  const fail=(n,msg)=>{throw new Error('строка '+(n+1)+': '+msg);};
  lines.forEach((raw,n)=>{
    const line=raw.replace(/\s+$/,''),t=line.trim();
    if(fence){field.push(/^~~~$/.test(t)?'~~~':line);if(t==='~~~')fence=false;return;}
    if(!t){if(field)field.push('');return;}
    let m;
    if(/^~~~[\w+-]*$/.test(t)){if(!field)fail(n,'блок ~~~ вне вопроса');field.push(t);fence=true;return;}
    if((m=/^\?\s*(.*)$/.exec(t))){
      q={q:[],type:null,options:[],answers:[],explain:[],correct:[],wrong:[]};
      data.questions.push(q);field=q.q;opt=null;if(m[1])field.push(m[1]);return;
    }
    if((m=/^[-*+]\s*\[([ xXхХ])\]\s*(.*)$/.exec(t))){
      if(!q)fail(n,'вариант ответа вне вопроса');
      const [text,...note]=m[2].split(/\s+::\s*/);
      opt={tl:[text],nl:note.length?[note.join(' :: ')]:null,ok:m[1]!==' '};
      q.options.push(opt);field=opt.nl||opt.tl;return;
    }
    if((m=/^=\s*(.+)$/.exec(t))){
      if(!q)fail(n,'ответ «=» вне вопроса');
      q.answers.push(...m[1].split('|').map(s=>s.trim()).filter(Boolean));field=null;opt=null;return;
    }
    if(!q&&(m=/^(mode|режим)\s*:/i.exec(t))){field=null;return;}
    if(!q&&(m=/^(description|описание)\s*:\s*(.*)$/i.exec(t))){data.description=m[2].trim();field=null;return;}
    if((m=/^([A-Za-zА-Яа-яЁё]+)\s*:\s*(.*)$/.exec(t))&&KEYS[m[1].toLowerCase()]){
      const k=KEYS[m[1].toLowerCase()];
      if(k==='title'&&!q){data.title=m[2].trim();field=null;return;}
      if(q&&k==='type'){
        q.type=TYPES[m[2].trim().toLowerCase()]||fail(n,'неизвестный тип «'+m[2]+'» (single, multi, text)');
        field=null;opt=null;return;
      }
      if(q&&k!=='title'){field=q[k];opt=null;if(m[2])field.push(m[2]);return;}
    }
    if(field){field.push(raw.replace(/^( {1,4}|\t)/,'').replace(/\s+$/,''));return;}
    fail(n,'не понимаю «'+t.slice(0,40)+'»');
  });
  if(fence)throw new Error('не закрыт блок ~~~');
  if(!data.questions.length)throw new Error('нет ни одного вопроса (вопрос начинается с «?»)');
  const J=a=>a.join('\n').trim();
  data.questions=data.questions.map((q,i)=>{
    const bad=m=>{throw new Error('вопрос '+(i+1)+': '+m);};
    const o={q:J(q.q),options:q.options.map(x=>({t:J(x.tl),note:x.nl?J(x.nl):'',ok:x.ok})),answers:q.answers,
      explain:J(q.explain),correct:J(q.correct),wrong:J(q.wrong)};
    if(!o.q)bad('пустой текст вопроса');
    if(q.answers.length&&q.options.length)bad('нельзя смешивать варианты [ ] и ответы «=»');
    if(q.answers.length)o.type='text';
    else{
      if(o.options.length<2)bad('нужно минимум 2 варианта «- [ ]» либо ответ «= …»');
      const k=o.options.filter(x=>x.ok).length;
      if(!k)bad('не отмечен верный вариант (поставьте [x])');
      o.type=k>1?'multi':'single';
      if(q.type==='single'&&k>1)bad('тип single, но верных вариантов несколько');
      if(q.type==='text')bad('тип text требует строку «= ответ»');
    }
    return o;
  });
  return data;
}

// Файл — тест на всю страницу, если он начинается с «mode: quiz» (обычной первой строкой
// или внутри блока --- … --- в самом начале). Возвращает текст теста или null.
const MODE_RE=/^[ \t]*(mode|режим)[ \t]*:[ \t]*(quiz|тест|викторина)[ \t]*$/i;
export function quizPageSource(raw){
  let s=String(raw).replace(/^\uFEFF/,'').replace(/\r/g,'').replace(/^(\s*\n)+/,'');
  let out=null;
  const fm=/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(s);
  if(fm){
    const head=fm[1].split('\n');
    if(head.some(l=>MODE_RE.test(l)))
      out=head.filter(l=>/^\s*(title|название|заголовок|description|описание)\s*:/i.test(l)).join('\n')+'\n\n'+s.slice(fm[0].length);
  }else{
    const nl=s.indexOf('\n'),first=nl<0?s:s.slice(0,nl);
    if(MODE_RE.test(first))out=nl<0?'':s.slice(nl+1);
  }
  if(out===null)return null;
  const fence=/^\s*```quiz[ \t]*\n([\s\S]*?)\n```\s*$/.exec(out);
  return fence?fence[1]:out;
}

export function quizFigure(code){
  try{return '<div class="quiz" data-quiz="'+esc(JSON.stringify(parseQuiz(code)))+'"></div>';}
  catch(e){return '<div class="quiz-err">Ошибка в тесте — '+esc(e.message)+'</div>';}
}

/* ---------- проверка ответа ---------- */
const norm=s=>String(s).trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').replace(/[.!?]+$/,'');
const num=s=>{const t=String(s).trim().replace(',','.').replace(/\s/g,'');return /^[-+]?\d+(\.\d+)?$/.test(t)?parseFloat(t):null;};
const matchText=(q,v)=>q.answers.some(a=>norm(a)===norm(v)||(num(v)!==null&&num(a)===num(v)));

/* ---------- спецэффекты: конфетти на canvas ---------- */
const COLORS=['#5b5fef','#7c7ffb','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899'];
let cv=null,cx=null,parts=[],raf=0;
const calm=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function stage(){
  if(!cv){cv=document.createElement('canvas');cv.className='quiz-fx';cv.setAttribute('aria-hidden','true');document.body.appendChild(cv);cx=cv.getContext('2d');}
  if(cv.width!==innerWidth||cv.height!==innerHeight){cv.width=innerWidth;cv.height=innerHeight;}
}
function tick(){
  cx.clearRect(0,0,cv.width,cv.height);
  parts=parts.filter(p=>p.life>0&&p.y<cv.height+30);
  for(const p of parts){
    p.vy+=p.g;p.vx*=.992;p.vy*=.992;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.life--;
    cx.save();cx.globalAlpha=Math.min(1,p.life/25);cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.c;
    if(p.round){cx.beginPath();cx.arc(0,0,p.w/2,0,7);cx.fill();}else cx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
    cx.restore();
  }
  if(parts.length)raf=requestAnimationFrame(tick);else{raf=0;cv.remove();cv=cx=null;}
}
function burst(x,y,n,radial){
  if(calm())return;
  stage();
  for(let i=0;i<n;i++){
    const a=radial?Math.random()*6.283:-Math.PI/2+(Math.random()-.5)*Math.PI*1.2,s=(radial?3:4)+Math.random()*(radial?7:9);
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,g:.28,rot:Math.random()*6,vr:(Math.random()-.5)*.4,
      w:6+Math.random()*6,h:4+Math.random()*5,c:COLORS[i%COLORS.length],round:Math.random()<.25,life:70+Math.random()*50});
  }
  if(!raf)raf=requestAnimationFrame(tick);
}
function rain(n){
  if(calm())return;
  stage();
  for(let i=0;i<n;i++)parts.push({x:Math.random()*innerWidth,y:-Math.random()*500,vx:(Math.random()-.5)*2,vy:2+Math.random()*3,g:.04,
    rot:Math.random()*6,vr:(Math.random()-.5)*.3,w:6+Math.random()*6,h:4+Math.random()*5,c:COLORS[i%COLORS.length],round:Math.random()<.2,life:420});
  if(!raf)raf=requestAnimationFrame(tick);
}

/* ---------- интерактивный тест ---------- */
const OK_MSG=['Верно!','Отлично!','В точку!','Так держать!'],BAD_MSG=['Неверно','Не совсем','Мимо'];

function mount(el,data,opts={}){
  const full=!!opts.full;
  const Q=data.questions;
  let order=Q.map((_,i)=>i),pos=0,res={},streak=0,best=0,sel=new Set(),locked=false,retry=false;
  el.innerHTML='<div class="quiz-head"><div class="quiz-title"><span aria-hidden="true">🧠</span> '+esc(data.title||'Проверь себя')+
    '</div><div class="quiz-meta"><span class="quiz-streak" hidden></span><span class="quiz-count"></span></div></div>'+
    '<div class="quiz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><span></span></div><div class="quiz-body"></div>';
  const $=s=>el.querySelector(s),body=$('.quiz-body'),barEl=$('.quiz-bar'),count=$('.quiz-count'),streakEl=$('.quiz-streak');
  const progress=p=>{barEl.firstElementChild.style.width=p+'%';barEl.setAttribute('aria-valuenow',Math.round(p));};
  const smooth=()=>calm()?'auto':'smooth';
  const keepInView=()=>{if(full){scrollTo({top:0,behavior:smooth()});return;}const r=el.getBoundingClientRect();if(r.top<0||r.top>innerHeight*.6)el.scrollIntoView({block:'start',behavior:smooth()});};
  function showStreak(bump){
    streakEl.hidden=streak<2;streakEl.textContent='🔥 '+streak;
    if(bump&&streak>=2){streakEl.classList.remove('bump');void streakEl.offsetWidth;streakEl.classList.add('bump');}
  }

  function showIntro(){
    const n=Q.length,tx=Q.filter(q=>q.type==='text').length,mu=Q.filter(q=>q.type==='multi').length,sg=n-tx-mu;
    const chips=[sg&&sg+' с одним ответом',mu&&mu+' с несколькими ответами',tx&&tx+' с вводом ответа'].filter(Boolean);
    count.textContent='';progress(0);streakEl.hidden=true;
    body.innerHTML='<div class="quiz-intro">'+(data.description?'<div class="quiz-intro-desc">'+inline(data.description)+'</div>':'')+
      '<div class="quiz-intro-count"><strong>'+n+'</strong> '+(n%10===1&&n%100!==11?'вопрос':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'вопроса':'вопросов')+'</div>'+
      '<div class="quiz-chips">'+chips.map(c=>'<span>'+c+'</span>').join('')+'</div>'+
      '<div class="quiz-hint">Клавиши: <kbd>1</kbd>–<kbd>9</kbd> — выбрать вариант, <kbd>Enter</kbd> — проверить / далее</div>'+
      '<div class="quiz-actions center"><button type="button" class="btn2 btn-primary quiz-start">Начать</button></div></div>';
    const b=body.querySelector('.quiz-start');b.onclick=()=>{showQuestion();keepInView();};b.focus({preventScroll:true});
  }
  if(full){
    el.classList.add('quiz-full');
    const kh=e=>{
      if(!el.isConnected){removeEventListener('keydown',kh);return;}
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      const t=e.target,tag=t&&t.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA')return;
      if(/^[1-9]$/.test(e.key)&&!locked){
        const b=body.querySelectorAll('.quiz-opt')[+e.key-1];
        if(b){b.click();e.preventDefault();}
      }else if(e.key==='Enter'&&tag!=='BUTTON'){
        const b=body.querySelector('.quiz-check:not(:disabled),.quiz-next,.quiz-start');
        if(b){b.click();e.preventDefault();}
      }
    };
    addEventListener('keydown',kh);
  }

  function showQuestion(){
    const q=Q[order[pos]],isText=q.type==='text',single=q.type==='single';
    locked=false;sel=new Set();
    count.textContent=(retry?'Повтор ошибок · ':'')+(pos+1)+' / '+order.length;
    progress(pos/order.length*100);showStreak(false);
    body.innerHTML='<div class="quiz-card"><div class="quiz-kind">'+(isText?'Введите ответ':single?'Выберите один ответ':'Выберите все верные ответы')+
      '</div><div class="quiz-q">'+fmt(q.q)+'</div>'+
      (isText?'<input class="quiz-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ваш ответ…">'
      :'<div class="quiz-opts" data-type="'+q.type+'" role="'+(single?'radiogroup':'group')+'">'+q.options.map((o,i)=>
        '<button type="button" class="quiz-opt" data-i="'+i+'" role="'+(single?'radio':'checkbox')+'" aria-checked="false"><span class="quiz-mark"></span>'+
        '<span class="quiz-opt-body"><span>'+inline(o.t)+'</span><span class="quiz-opt-note" hidden></span></span></button>').join('')+'</div>')+
      '<div class="quiz-fb" aria-live="polite" hidden></div><div class="quiz-actions"><button type="button" class="btn2 btn-primary quiz-check" disabled>Проверить</button></div></div>';
    const card=body.firstElementChild,check=card.querySelector('.quiz-check');
    check.onclick=doCheck;
    if(isText){
      const inp=card.querySelector('.quiz-input');
      inp.oninput=()=>{check.disabled=!inp.value.trim();};
      inp.onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();if(locked)next();else if(!check.disabled)doCheck();};
      if(pos>0)inp.focus({preventScroll:true});
    }else card.querySelectorAll('.quiz-opt').forEach(b=>b.onclick=()=>{
      if(locked)return;
      const i=+b.dataset.i;
      if(single)sel=new Set([i]);else if(sel.has(i))sel.delete(i);else sel.add(i);
      card.querySelectorAll('.quiz-opt').forEach((x,j)=>{
        const on=sel.has(j);x.classList.toggle('is-sel',on);x.setAttribute('aria-checked',on);
        x.firstElementChild.textContent=on&&!single?'✓':'';
      });
      check.disabled=!sel.size;
    });
  }

  function doCheck(){
    if(locked)return;
    const q=Q[order[pos]],card=body.firstElementChild,isText=q.type==='text';
    let ok;
    if(isText)ok=matchText(q,card.querySelector('.quiz-input').value);
    else{const want=q.options.map((o,i)=>o.ok?i:-1).filter(i=>i>=0);ok=sel.size===want.length&&want.every(i=>sel.has(i));}
    locked=true;res[order[pos]]=ok;streak=ok?streak+1:0;best=Math.max(best,streak);
    card.classList.add('is-locked',ok?'fx-ok':'fx-bad');
    setTimeout(()=>card.classList.remove('fx-ok','fx-bad'),900);
    let anchor=card.querySelector('.quiz-input');
    if(isText)anchor.readOnly=true,anchor.classList.add(ok?'is-correct':'is-wrong');
    else card.querySelectorAll('.quiz-opt').forEach((b,i)=>{
      const o=q.options[i],s=sel.has(i),st=o.ok&&s?'is-correct':s?'is-wrong':o.ok?'is-missed':'is-dim';
      b.classList.remove('is-sel');b.classList.add(st);
      b.firstElementChild.textContent=st==='is-wrong'?'✕':st==='is-dim'?'':'✓';
      if(o.note&&(s||o.ok)){const n=b.querySelector('.quiz-opt-note');n.innerHTML=inline(o.note);n.hidden=false;}
      if(st==='is-correct'&&!anchor)anchor=b;
    });
    const why=ok?(q.correct||q.explain):(q.wrong||q.explain);
    const ans=ok?'':'<div class="quiz-fb-ans">Правильный ответ: <strong>'+(isText?esc(q.answers[0])+(q.answers.length>1?
      ' <span>(также: '+q.answers.slice(1).map(esc).join(', ')+')</span>':''):q.options.filter(o=>o.ok).map(o=>inline(o.t)).join(' · '))+'</strong></div>';
    const fb=card.querySelector('.quiz-fb');
    fb.className='quiz-fb '+(ok?'ok':'bad');
    fb.innerHTML='<div class="quiz-fb-title">'+(ok?'✓ '+pick(OK_MSG):'✕ '+pick(BAD_MSG))+'</div>'+ans+(why?'<div class="quiz-fb-text">'+fmt(why)+'</div>':'');
    fb.hidden=false;
    const last=pos===order.length-1,act=card.querySelector('.quiz-actions');
    act.innerHTML='<button type="button" class="btn2 btn-primary quiz-next">'+(last?'Результат':'Далее →')+'</button>';
    const nb=act.firstElementChild;nb.onclick=next;nb.focus({preventScroll:true});
    showStreak(true);
    if(ok&&anchor){
      const r=anchor.getBoundingClientRect();
      burst(Math.min(r.left+40,innerWidth-20),r.top+r.height/2,26+Math.min(streak,6)*8);
      if(streak>=3)burst(innerWidth-60,innerHeight*.6,40);
    }
    fb.scrollIntoView({block:'nearest',behavior:smooth()});
  }

  function next(){
    if(++pos>=order.length)showResult();else showQuestion();
    keepInView();
  }

  function showResult(){
    const total=order.length,good=order.filter(i=>res[i]).length,pct=good/total,wrong=order.filter(i=>!res[i]);
    const T=pct===1?['Безупречно!','🏆','--q-ok']:pct>=.8?['Отличный результат!','🎉','--q-ok']:
      pct>=.5?['Неплохо, но есть что повторить','👍','--q-warn']:['Стоит перечитать конспект','📚','--q-bad'];
    const C=2*Math.PI*52;
    progress(100);count.textContent=total+' / '+total;streakEl.hidden=true;
    body.innerHTML='<div class="quiz-result" style="--rc:var('+T[2]+')"><div class="quiz-ring"><svg viewBox="0 0 120 120" aria-hidden="true">'+
      '<circle class="quiz-ring-bg" cx="60" cy="60" r="52"/><circle class="quiz-ring-fg" cx="60" cy="60" r="52" stroke-dasharray="'+C.toFixed(1)+
      '" stroke-dashoffset="'+C.toFixed(1)+'"/></svg><div class="quiz-ring-num">'+good+'/'+total+'</div></div>'+
      '<div class="quiz-result-title">'+T[1]+' '+T[0]+'</div><div class="quiz-result-sub">Верно: '+Math.round(pct*100)+'%'+(best>=2?' · лучшая серия: '+best+' 🔥':'')+'</div>'+
      '<div class="quiz-actions center">'+(wrong.length?'<button type="button" class="btn2 btn-primary" data-act="retry">Повторить ошибки ('+wrong.length+')</button>':'')+
      '<button type="button" class="btn2'+(wrong.length?'':' btn-primary')+'" data-act="again">Пройти заново</button></div></div>';
    const ring=body.querySelector('.quiz-ring-fg');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ring.style.strokeDashoffset=(C*(1-pct)).toFixed(1);}));
    body.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
      retry=b.dataset.act==='retry';
      order=retry?wrong:Q.map((_,i)=>i);pos=0;res={};streak=0;best=0;
      showQuestion();keepInView();
    });
    if(pct>=.8){
      const r=body.querySelector('.quiz-ring').getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      burst(x,y,90);rain(pct===1?170:70);
      if(pct===1)[350,800].forEach(d=>setTimeout(()=>burst(innerWidth*(.2+Math.random()*.6),innerHeight*(.2+Math.random()*.3),70,true),d));
    }
  }
  if(full)showIntro();else showQuestion();
}

export function mountQuizPage(el,src){
  let data;
  try{data=parseQuiz(src);}
  catch(e){el.innerHTML='<div class="quiz-err">Ошибка в тесте — '+esc(e.message)+'</div>';return;}
  el.classList.add('quiz');
  mount(el,data,{full:true});
}

export function bindQuizzes(root){
  root.querySelectorAll('.quiz[data-quiz]:not([data-ready])').forEach(el=>{
    let data;
    try{data=JSON.parse(el.dataset.quiz);}catch(e){return;}
    el.dataset.ready='1';mount(el,data);
  });
}

// Для PDF: интерактив заменяется статичным списком вопросов с отмеченными верными ответами.
// Каждый вопрос — отдельный блок верхнего уровня, чтобы вёрстальщик страниц мог переносить их между страницами.
export function printifyQuizzes(root){
  root.querySelectorAll('.quiz[data-quiz]').forEach(el=>{
    let d;
    try{d=JSON.parse(el.dataset.quiz);}catch(e){return;}
    const mk=h=>{const b=document.createElement('div');b.innerHTML=h;return b;};
    const nodes=[mk('<div class="quiz-print-title">'+esc(d.title||'Вопросы для самопроверки')+'</div>')];
    d.questions.forEach((q,n)=>{
      const body=q.type==='text'?'<div class="quiz-print-ans">Ответ: <strong>'+q.answers.map(esc).join(' / ')+'</strong></div>'
        :q.options.map(o=>'<div class="quiz-print-opt'+(o.ok?' ok':'')+'"><span>'+(o.ok?'✓':'○')+'</span>'+inline(o.t)+'</div>').join('');
      const why=q.explain||q.correct;
      nodes.push(mk('<div class="quiz-print-q"><div class="quiz-print-qt">'+(n+1)+'. '+fmt(q.q)+'</div>'+body+(why?'<div class="quiz-print-why">'+fmt(why)+'</div>':'')+'</div>'));
    });
    el.replaceWith(...nodes);
  });
}
