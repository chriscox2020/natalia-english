/* Natalia Shtefan English Program. No Google services. Audio by local Piper; ASR by self-hosted Whisper (transformers.js). */
(function(){
const $=id=>document.getElementById(id);
let D=null;
let LS=null; try{LS=window.localStorage}catch(e){LS=null}
const S={get:(k,d)=>{try{if(!LS)return d;const v=LS.getItem('ns_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{if(LS)LS.setItem('ns_'+k,JSON.stringify(v))}catch(e){}}};
const STREAK_KEY='natalia_daily_streak';
function localISODate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function addCalendarDays(iso,delta){const [y,m,day]=iso.split('-').map(Number);const dt=new Date(y,m-1,day);dt.setDate(dt.getDate()+delta);return localISODate(dt);}
function ruDayWord(n){const a=Math.abs(Math.trunc(n))%100,b=a%10;if(a>=11&&a<=14)return 'дней';if(b===1)return 'день';if(b>=2&&b<=4)return 'дня';return 'дней';}
function readStreak(){try{if(!LS)return {count:0,last:''};const v=JSON.parse(LS.getItem(STREAK_KEY)||'null');if(v&&typeof v.count==='number'&&typeof v.last==='string')return {count:v.count,last:v.last};}catch(e){}return {count:0,last:''};}
function writeStreak(v){try{if(LS)LS.setItem(STREAK_KEY,JSON.stringify(v));}catch(e){}}
function shownStreak(){const s=readStreak();if(!s.last||s.count<1)return 0;const today=localISODate(new Date());if(s.last===today||s.last===addCalendarDays(today,-1))return s.count;return 0;}
function renderStreak(){const el=$('streak');if(!el)return;const n=shownStreak();el.textContent='🔥 '+n+' '+ruDayWord(n)+' подряд';}
function recordStreak(){const today=localISODate(new Date());const s=readStreak();if(s.last===today&&s.count>0){renderStreak();return;}
  const count=(s.last===addCalendarDays(today,-1)&&s.count>0)?s.count+1:1;writeStreak({count:count,last:today});renderStreak();}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const player=new Audio(); player.preload='auto'; player.id='lessonPlayer'; player.style.display='none'; document.body.appendChild(player);
let stopFlag=false, runId=0, audioUnlocked=false;
function unlockAudio(){
  if(audioUnlocked)return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(AC){if(!unlockAudio.ctx)unlockAudio.ctx=new AC();unlockAudio.ctx.resume&&unlockAudio.ctx.resume();}
  }catch(e){}
  try{const p=player.play();if(p&&p.catch)p.catch(()=>{});player.pause();player.currentTime=0;}catch(e){}
  audioUnlocked=true;
}
function play(src){return new Promise(res=>{if(!src){res(0);return}player.onended=()=>res(1);player.onerror=()=>res(0);player.src=src;const pr=player.play();if(pr&&pr.catch)pr.catch(()=>res(0));});}
function stopAudio(){try{player.pause()}catch(e){}}
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));const el=$(id);if(el)el.classList.add('active');window.scrollTo(0,0);}

function copyToClipboard(text){
  // Sync fallback first so iOS keeps the user gesture
  try{
    const ta=document.createElement('textarea');
    ta.value=text; ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0.01;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try{ta.setSelectionRange(0,text.length)}catch(e){}
    const ok=document.execCommand('copy');
    document.body.removeChild(ta);
    if(ok)return Promise.resolve(true);
  }catch(e){}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).then(()=>true).catch(()=>false);
  }
  return Promise.resolve(false);
}
function copySync(text){
  try{
    const ta=document.createElement('textarea');
    ta.value=text; ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0.01;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try{ta.setSelectionRange(0,text.length)}catch(e){}
    const ok=document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  }catch(e){return false;}
}
function showCopied(ok){
  const st=$('copyStatus'); if(!st)return;
  st.textContent=ok?'Скопировано! Теперь вставьте в Grok.':'Не получилось скопировать. Выделите текст и скопируйте сами.';
  st.classList.remove('hidden');
}
function copyAgentText(){
  const text=(typeof NATALIA_AGENT_COPY==='string'&&NATALIA_AGENT_COPY)||'';
  if(!text){console.warn('copy text missing');return;}
  unlockAudio();
  const clip='audio/ru/copied.mp3';
  // Prefer a synchronous copy + play in the same tap so iOS allows both.
  if(copySync(text)){showCopied(true);play(clip);return;}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    // Start the clip during the gesture, then confirm clipboard.
    play(clip);
    navigator.clipboard.writeText(text).then(()=>showCopied(true)).catch(()=>{stopAudio();showCopied(false);});
    return;
  }
  showCopied(false);
}
const allItems=()=>D.lessons.flatMap(l=>l.items.map(it=>({...it,lesson:l})));

/* ---------- Praise: English + Russian mix, never the same twice in a row ---------- */
let lastPraise=null, successStreak=0, lessonDoneToggle=S.get('ldt',0);
function praiseClip(){const pool=[...Object.entries(D.praiseEn).filter(([k])=>k!=='lesson_done').map(([k,v])=>v.audio),
  ...Object.entries(D.praiseRu).filter(([k])=>k!=='lesson_done').map(([k,v])=>v.audio)];
  // roughly half English / half Russian: pick language first
  const lang=Math.random()<0.5?'en':'ru';let cand=pool.filter(a=>a.includes('/'+lang+'/')&&a!==lastPraise);
  if(!cand.length)cand=pool.filter(a=>a!==lastPraise);const c=cand[Math.floor(Math.random()*cand.length)];lastPraise=c;return c;}
async function praise(kind){ // kind: 'line' | 'fixed' | 'lesson'
  if(kind==='lesson'){lessonDoneToggle^=1;S.set('ldt',lessonDoneToggle);await play(lessonDoneToggle?D.praiseEn.lesson_done.audio:D.praiseRu.lesson_done.audio);await sleep(700);return;}
  if(kind==='line'){successStreak++;const need=successStreak>=2&&(successStreak>=3||Math.random()<0.5);if(!need)return;successStreak=0;}
  if(kind==='fixed')successStreak=0;
  await play(praiseClip());await sleep(600);
}

/* ---------- Leitner spaced repetition ---------- */
const INTERVAL=[0,10*60e3,864e5,3*864e5,7*864e5,14*864e5];
function rec(id){const r=S.get('srs',{});return r[id]||{box:0,due:0,hard:0,ok:0};}
function mark(id,ok){const r=S.get('srs',{});const c=r[id]||{box:0,due:0,hard:0,ok:0};
  if(ok){c.box=Math.min(5,c.box+1);c.ok++;}else{c.box=1;c.hard++;}c.due=Date.now()+INTERVAL[c.box];r[id]=c;S.set('srs',r);
  const days=S.get('days',{});const d=new Date().toISOString().slice(0,10);days[d]=(days[d]||0)+1;S.set('days',days);}
function weakItems(n){const r=S.get('srs',{});return allItems().filter(it=>r[it.id]&&r[it.id].box<=2).sort((a,b)=>(r[b.id].hard-r[a.id].hard)||(r[a.id].due-r[b.id].due)).slice(0,n);}
function dueItems(n){const r=S.get('srs',{});const now=Date.now();return allItems().filter(it=>r[it.id]&&r[it.id].due<=now).slice(0,n);}

/* ---------- Session building ---------- */
function lessonById(id){return D.lessons.find(l=>l.id===id)||D.lessons[0];}
function nextLessonId(){const done=S.get('done',[]);const l=D.lessons.find(l=>!done.includes(l.id));return (l||D.lessons[S.get('rot',0)%D.lessons.length]).id;}
function sessionFor(kind,lessonId){
  if(kind==='lesson'){const l=lessonById(lessonId);return {kind,lessonId:l.id,title:l.title,topicAudio:l.topicAudio,items:l.items.map(i=>i.id)};}
  if(kind==='weak'){let it=weakItems(10);if(it.length<4)it=it.concat(dueItems(10-it.length));if(!it.length)it=lessonById(nextLessonId()).items;
    return {kind,title:'Слабые места',items:[...new Set(it.map(i=>i.id))]};}
  if(kind==='busy'){let it=weakItems(4).concat(dueItems(4));const l=lessonById(nextLessonId());it=it.concat(l.items.slice(0,8-it.length));
    return {kind,title:'Занятой день: 10 минут',items:[...new Set(it.map(i=>i.id))].slice(0,10)};}
}
/* Hands-free pass: English line, speak window, English line, speak window. */
function carExposureSeconds(dur){const en=dur>0?dur:3;const rep=Math.max(2.5,en*1.5);return en+rep+en+rep+0.5;}
function repeatsFor(items){let base=0;for(const id of items){const it=itemById(id);base+=carExposureSeconds(it&&it.dur);}
  const overhead=3.8+4.5+7.6;let best=1,score=1e9,fallback=1,fall=1e9;
  for(let k=1;k<=12;k++){const t=overhead+k*base,diff=Math.abs(t-12.5*60);if(diff<fall){fall=diff;fallback=k;}
    if(t<10*60||t>15*60)continue;if(diff<score){score=diff;best=k;}}
  return score<1e9?best:fallback;}
function sizedLesson(lessonId){const sess=sessionFor('lesson',lessonId);sess.reps=repeatsFor(sess.items);return sess;}
function anotherLessonId(id){const i=D.lessons.findIndex(l=>l.id===id);return D.lessons[(i<0?0:i+1)%D.lessons.length].id;}
const itemById=id=>allItems().find(i=>i.id===id);
function saveState(mode,sess,idx){S.set('resume',{mode,sess,idx,t:Date.now()});}
function clearState(){try{if(LS)LS.removeItem('ns_resume')}catch(e){}}
function pushHistory(sess){if(sess.kind!=='lesson')return;const h=S.get('hist',[]);if(h[h.length-1]!==sess.lessonId)h.push(sess.lessonId);S.set('hist',h.slice(-30));}
function previousLesson(currentId){const h=S.get('hist',[]);for(let i=h.length-1;i>=0;i--)if(h[i]!==currentId)return h[i];return currentId||h[h.length-1]||D.lessons[0].id;}
function finishLesson(sess){recordStreak();if(sess&&sess.kind==='lesson'){const d=S.get('done',[]);if(!d.includes(sess.lessonId))d.push(sess.lessonId);else S.set('rot',S.get('rot',0)+1);S.set('done',d);}clearState();}

/* ---------- Normal lesson (audio only, no lesson text on screen) ---------- */
let L=null;
async function startLesson(sess,idx=0){stopAll();unlockAudio();L={sess,idx,run:++runId};pushHistory(sess);$('lessonTitle').textContent=sess.title;$('lessonCount').textContent=(idx+1)+' / '+sess.items.length;$('lessonBar').style.width=(100*idx/sess.items.length)+'%';$('lessonStatus').textContent='🔊';show('lesson');
  if(idx===0&&sess.topicAudio){await play(D.cues.listen_repeat);await play(sess.topicAudio);}else if(idx>0)await play(D.cues.resume);
  lessonStep();}
async function lessonStep(){const my=L.run;const it=itemById(L.sess.items[L.idx]);saveState('lesson',L.sess,L.idx);
  $('lessonCount').textContent=(L.idx+1)+' / '+L.sess.items.length;$('lessonBar').style.width=(100*L.idx/L.sess.items.length)+'%';
  $('lessonStatus').textContent='🔊';if(!it)return lessonDone();
  await play(it.ruAudio);if(my!==runId)return;await sleep(500);await play(it.audio);if(my!==runId)return;
  $('lessonStatus').textContent='🗣️';}
async function lessonAnswer(ok){if(!L)return;const it=itemById(L.sess.items[L.idx]);mark(it.id,ok);if(ok)await praise('line');L.idx++;
  if(L.idx>=L.sess.items.length)return lessonDone();lessonStep();}
async function lessonDone(){$('lessonBar').style.width='100%';$('lessonStatus').textContent='🎉';finishLesson(L.sess);await praise('lesson');await play(D.cues.done);L=null;goHome();}

/* ---------- Audio capture + VAD + Whisper ---------- */
const MIC={stream:null,ctx:null,buf:[],rec:false,rms:0,noise:0.01,ok:false};
async function micInit(){if(MIC.ok)return true;try{
  MIC.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  MIC.ctx=new (window.AudioContext||window.webkitAudioContext)();const src=MIC.ctx.createMediaStreamSource(MIC.stream);
  const proc=MIC.ctx.createScriptProcessor(4096,1,1);src.connect(proc);const g=MIC.ctx.createGain();g.gain.value=0;proc.connect(g);g.connect(MIC.ctx.destination);
  proc.onaudioprocess=e=>{const x=e.inputBuffer.getChannelData(0);let s=0;for(let i=0;i<x.length;i++)s+=x[i]*x[i];MIC.rms=Math.sqrt(s/x.length);if(MIC.rec)MIC.buf.push(new Float32Array(x));};
  MIC.ok=true;return true;}catch(e){console.warn('mic',e);return false;}}
async function calibrate(){let v=[];for(let i=0;i<8;i++){await sleep(60);v.push(MIC.rms);}v.sort();MIC.noise=Math.max(0.004,v[3]);}
// Wait for her to speak (never talk over her). Returns Float32Array 16k or null on timeout.
async function listen(maxWaitMs,my){if(MIC.ctx.state==='suspended')await MIC.ctx.resume();await calibrate();
  const thr=()=>Math.max(0.02,MIC.noise*3.2);MIC.buf=[];MIC.rec=true;let started=false,t0=Date.now(),lastVoice=0,startAt=0;
  while(true){await sleep(50);if(my!==runId||stopFlag){MIC.rec=false;return null;}const now=Date.now();
    if(MIC.rms>thr()){if(!started){started=true;startAt=now;}lastVoice=now;}
    if(!started){if(now-t0>maxWaitMs){MIC.rec=false;return null;}if(MIC.buf.length>12)MIC.buf=MIC.buf.slice(-6);}
    else if(now-lastVoice>1300||now-startAt>15000)break;}
  MIC.rec=false;const sr=MIC.ctx.sampleRate;let n=0;MIC.buf.forEach(b=>n+=b.length);const all=new Float32Array(n);let o=0;MIC.buf.forEach(b=>{all.set(b,o);o+=b.length;});
  const ratio=sr/16000,m=Math.floor(n/ratio),out=new Float32Array(m);for(let i=0;i<m;i++){const p=i*ratio,k=Math.floor(p),f=p-k;out[i]=(all[k]||0)*(1-f)+(all[k+1]||0)*f;}return out;}
let ASR=null,asrState='none';
async function asrInit(){if(ASR)return ASR;asrState='loading';const t0=Date.now();try{
  const T=await import('./vendor/transformers.min.js');T.env.allowRemoteModels=false;T.env.allowLocalModels=true;T.env.localModelPath=new URL('./models/',location.href).href;
  T.env.backends.onnx.wasm.wasmPaths=new URL('./vendor/',location.href).href;
  T.env.backends.onnx.wasm.numThreads=1;
  T.env.backends.onnx.wasm.proxy=false;
  ASR=await T.pipeline('automatic-speech-recognition','Xenova/whisper-tiny.en',{device:'wasm',dtype:{encoder_model:'q8',decoder_model_merged:'q8'}});
  asrState='ready';console.log('ASR ready in',Date.now()-t0,'ms');return ASR;}catch(e){console.warn('asr',e);asrState='failed';return null;}}
async function transcribe(a){if(!ASR||!a||a.length<4000)return '';try{const r=await ASR(a);return (r.text||'').replace(/\[[^\]]*\]|\([^)]*\)/g,'').trim();}catch(e){return '';}}

/* ---------- Car Mode ---------- */
let C=null,wake=null;
async function keepAwake(){try{if('wakeLock' in navigator)wake=await navigator.wakeLock.request('screen');}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(C&&document.visibilityState==='visible')keepAwake();});
function setCar(status,heard){if(status!=null)$('carStatus').textContent=status;if(heard!=null)$('carHeard').textContent=heard;}
async function startCar(sess,idx=0){recordStreak();stopAll();stopFlag=false;unlockAudio();const my=++runId;C={sess,idx,run:my,paused:false,smart:false};pushHistory(sess);
  if($('carTitle'))$('carTitle').textContent=sess.title;show('car');keepAwake();setCar('','');
  // Play a cue immediately so iOS allows later audio (gesture is lost after model load).
  const primed=play((idx===0&&D&&D.cues)?D.cues.start:D&&D.cues?D.cues.resume:'');
  const micOk=await micInit();let eng='Повторяйте за голосом.';
  if(micOk){if($('carEngine'))$('carEngine').textContent='Загружаю проверку речи…';await asrInit();if(ASR){C.smart=true;eng='Проверка речи включена.';}}
  if(!C.smart)eng='Повторяйте за голосом.';
  if($('carEngine'))$('carEngine').textContent=eng;if(my!==runId)return;
  await primed;
  if(idx===0&&sess.topicAudio)await play(sess.topicAudio);
  carLoop(my);}
async function carCommand(text,my){const c=Cmp.command(text);if(c==='stop'){await carStop();return true;}
  if(c==='back'){await carBack();return true;}return false;}
let finishSess=null;
function showFinish(sess){finishSess=sess;if($('finishInfo'))$('finishInfo').textContent=sess.title||'';show('finish');}
async function carLoop(my){
  while(C&&my===runId&&C.idx<C.sess.items.length){const it=itemById(C.sess.items[C.idx]);saveState('car',C.sess,C.idx);
    const reps=C.sess.reps||1,n=C.sess.items.length;
    if(!it){C.idx++;continue;}
    for(let r=0;r<reps;r++){if(!C||my!==runId)return;
      if($('carCount'))$('carCount').textContent=(C.idx+1)+' / '+n+(reps>1?' · повтор '+(r+1)+' / '+reps:'');
      if($('carBar'))$('carBar').style.width=(100*C.idx/n)+'%';
      const ok=(C.smart&&r===0)?await carSmartItem(it,my):await carTimedItem(it,my);
      if(my!==runId)return;if(r===0)mark(it.id,!!ok);}
    if(!C||my!==runId)return;C.idx++;await sleep(500);}
  if(C&&my===runId){const sess=C.sess;if($('carBar'))$('carBar').style.width='100%';setCar('Готово','');finishLesson(sess);await praise('lesson');await play(D.cues.done);releaseCar();
    if(sess.reps>1)showFinish(sess);else goHome();}}
async function carTimedItem(it,my){setCar('Слушайте','');await play(it.audio);if(my!==runId)return false;setCar('Говорите','');await sleep(Math.max(2500,it.dur*1500));
  if(my!==runId)return false;setCar('Слушайте','');await play(it.audio);if(my!==runId)return false;setCar('Говорите','');await sleep(Math.max(2500,it.dur*1500));return true;}
async function hear(my,wait){let a=await listen(wait,my);if(my!==runId)return null;
  if(!a){await play(D.cues.gentle);if(my!==runId)return null;a=await listen(25000,my);if(!a||my!==runId)return null;}
  setCar('Проверка',null);const t=await transcribe(a);if(my!==runId)return null;setCar(null,t||'…');return t;}
async function carSmartItem(it,my){let hadError=false;
  for(let attempt=0;attempt<3;attempt++){setCar('Слушайте','');await play(it.audio);if(my!==runId)return false;setCar('Говорите','');
    const t=await hear(my,Math.max(8000,it.dur*3000));if(my!==runId||t===null)return false;
    if(await carCommand(t,my))return false;
    const r=Cmp.compare(it.en,t);
    if(r.verdict==='ok'){await praise(hadError?'fixed':'line');return !hadError;}
    hadError=true;
    if(r.verdict==='unclear'){await play(D.cues.unclear);continue;}
    // word drill: say the missed word, she repeats it 3 times correctly (max 6 tries)
    const w=r.key,wa=D.words[w];await play(D.cues.almost);if(wa)await play(wa);if(my!==runId)return false;
    let good=0;for(let k=0;k<6&&good<3;k++){await play(D.cues.sayword);if(wa)await play(wa);if(my!==runId)return false;setCar('Говорите','');
      const tw=await hear(my,8000);if(my!==runId||tw===null)return false;if(await carCommand(tw,my))return false;
      if(Cmp.hasWord(w,tw)){good++;if(good<3)await play(D.cues.good_word);}else await play(D.cues.again);}
    if(good>=3)await praise('fixed');
    await play(D.cues.full_again);if(my!==runId)return false;}
  await play(D.cues.move_on);return false;}
async function carStop(){if(!C)return;saveState('car',C.sess,C.idx);runId++;stopFlag=true;MIC.rec=false;stopAudio();
  const cue=D&&D.cues&&D.cues.paused;releaseCar();show('home');if(cue)await play(cue);}
async function carBack(){const cur=C&&C.sess.lessonId;runId++;stopFlag=true;stopAudio();if(D&&D.cues&&D.cues.back)await play(D.cues.back);const id=previousLesson(cur);startCar(sessionFor('lesson',id),0);}
function releaseCar(){try{wake&&wake.release()}catch(e){}wake=null;C=null;}

/* ---------- Common ---------- */
function stopAll(){runId++;stopAudio();MIC.rec=false;}
function goHome(){stopAll();if(C)releaseCar();L=null;renderStreak();show('home');}
function renderTopics(){const box=$('topicList');if(!box||!D)return;box.innerHTML='';const done=S.get('done',[]);D.lessons.forEach(l=>{const b=document.createElement('button');b.className='topic';b.type='button';
  b.innerHTML=l.title+'<br><small>'+l.track+'</small>';b.onclick=()=>{unlockAudio();startCar(sessionFor('lesson',l.id),0);};box.appendChild(b);});}
function renderWeak(){const r=S.get('srs',{});const w=weakItems(30);const box=$('weakList');box.innerHTML='';
  if(!w.length){box.innerHTML='<div class="wk">Пока слабых мест нет. Отлично! 🎉</div>';return;}
  w.forEach(it=>{const d=document.createElement('div');d.className='wk';d.innerHTML='🔊 '+it.lesson.title+' · «Трудно»: '+r[it.id].hard;d.onclick=()=>play(it.audio);box.appendChild(d);});}
function renderProgress(){const r=S.get('srs',{});const ids=Object.keys(r);const learned=ids.filter(i=>r[i].box>=3).length;const days=S.get('days',{});
  let streak=0;for(let i=0;;i++){const d=new Date(Date.now()-i*864e5).toISOString().slice(0,10);if(days[d])streak++;else if(i>0)break;else continue;if(i>400)break;}
  const done=S.get('done',[]);$('progList').innerHTML=`<div class="wk">Уроков пройдено: <b>${done.length} / ${D.lessons.length}</b></div>
  <div class="wk">Фраз начато: <b>${ids.length}</b> · выучено: <b>${learned}</b></div><div class="wk">Дней подряд: <b>${streak}</b> 🔥</div>
  <div class="wk">Слабых мест: <b>${weakItems(999).length}</b></div>`;}

/* ---------- Wire up ---------- */
async function onStart(){
  unlockAudio();
  if(!D)return;
  // Ask for the mic during the same tap so iOS allows it; lessons still run if it fails.
  const micP=micInit();
  const first=!S.get('heardIntro',false);
  if(first){
    await play('intro_en.mp3');
    S.set('heardIntro',true);
  }
  const r=S.get('resume',null);
  const sess=(r&&r.sess)?r.sess:sizedLesson(nextLessonId());
  const idx=(r&&r.sess)?(r.idx||0):0;
  await micP;
  startCar(sess,idx);
}
function on(id,fn){const el=$(id);if(el)el.onclick=fn;}
async function init(){
  // Always keep the home screen and the green START button visible, even if data fails.
  show('home');
  try{
    D=await (await fetch('data.json?v=202611151700',{cache:'no-cache'})).json();
    if($('introEn1')){$('introEn1').textContent=D.intro[0].en;$('introRu1').textContent=D.intro[0].ru;$('introEn2').textContent=D.intro[1].en;$('introRu2').textContent=D.intro[1].ru;}
  }catch(e){
    console.warn('data.json',e);
    const err=document.createElement('p');err.className='load-err';err.textContent='Не удалось загрузить уроки. Проверьте интернет и обновите страницу.';
    const home=$('home');if(home)home.insertBefore(err,$('btnStart'));
  }
  on('btnStart',()=>onStart());
  on('btnCopyAgent',()=>copyAgentText());
  on('btnMore',()=>show('more'));
  on('btnIntro',async()=>{if($('introText'))$('introText').classList.remove('hidden');stopAll();unlockAudio();await play('intro_en.mp3');});
  on('btnListen',()=>{const a=$('instrAudio');if(!a)return;a.classList.remove('hidden');stopAll();unlockAudio();const pr=a.play();if(pr&&pr.catch)pr.catch(()=>{});});
  on('btnProgress',()=>{renderProgress();show('progress');});
  on('btnTopics',()=>{renderTopics();show('topics');});
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{const n=b.getAttribute('data-nav');if(n==='home')goHome();else show(n);});
  on('carStop',()=>carStop());
  on('carBack',()=>carBack());
  on('btnRepeat',()=>{if(!finishSess||!finishSess.lessonId)return;unlockAudio();startCar(sizedLesson(finishSess.lessonId),0);});
  on('btnAnother',()=>{if(!finishSess||!finishSess.lessonId)return;unlockAudio();startCar(sizedLesson(anotherLessonId(finishSess.lessonId)),0);});
  on('btnFinishHome',()=>goHome());
  renderStreak();
}
const COPY_TEXT='Скопируйте эту ссылку и вставьте в вашего агента Grok: https://chriscox2020.github.io/natalia-english/';
let copyTimer=0;
function fallbackCopy(text){const ta=$('copyFallback');if(!ta)return false;ta.value=text;try{ta.focus();ta.select();ta.setSelectionRange(0,text.length);return document.execCommand('copy');}catch(e){return false;}}
const copyBtn=$('btnCopy');
if(copyBtn)copyBtn.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();let ok=false;
  try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(COPY_TEXT);ok=true;}}catch(err){ok=false;}
  if(!ok)ok=copySync(COPY_TEXT)||fallbackCopy(COPY_TEXT);
  if(!ok)return;copyBtn.textContent='Скопировано';clearTimeout(copyTimer);copyTimer=setTimeout(()=>{copyBtn.textContent='Копировать';},2000);});
renderStreak();
init();
})();
