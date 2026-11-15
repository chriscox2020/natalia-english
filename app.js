/* Natalia Shtefan English Program. No Google services. Audio by local Piper; ASR by self-hosted Whisper (transformers.js). */
(function(){
const $=id=>document.getElementById(id);
let D=null; const LS=localStorage;
const S={get:(k,d)=>{try{return JSON.parse(LS.getItem('ns_'+k))??d}catch(e){return d}},set:(k,v)=>LS.setItem('ns_'+k,JSON.stringify(v))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const player=new Audio(); player.preload='auto';
let stopFlag=false, runId=0;
function play(src){return new Promise(res=>{if(!src){res(0);return}player.onended=()=>res(1);player.onerror=()=>res(0);player.src=src;player.play().catch(()=>res(0));});}
function stopAudio(){try{player.pause()}catch(e){}}
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');window.scrollTo(0,0);}
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
const itemById=id=>allItems().find(i=>i.id===id);
function saveState(mode,sess,idx){S.set('resume',{mode,sess,idx,t:Date.now()});}
function clearState(){LS.removeItem('ns_resume');}
function pushHistory(sess){if(sess.kind!=='lesson')return;const h=S.get('hist',[]);if(h[h.length-1]!==sess.lessonId)h.push(sess.lessonId);S.set('hist',h.slice(-30));}
function previousLesson(currentId){const h=S.get('hist',[]);for(let i=h.length-1;i>=0;i--)if(h[i]!==currentId)return h[i];return currentId||h[h.length-1]||D.lessons[0].id;}
function finishLesson(sess){if(sess.kind==='lesson'){const d=S.get('done',[]);if(!d.includes(sess.lessonId))d.push(sess.lessonId);else S.set('rot',S.get('rot',0)+1);S.set('done',d);}clearState();}

/* ---------- Normal lesson (audio only, no lesson text on screen) ---------- */
let L=null;
async function startLesson(sess,idx=0){stopAll();L={sess,idx,run:++runId};pushHistory(sess);$('lessonTitle').textContent=sess.title;show('lesson');
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
  T.env.backends.onnx.wasm.wasmPaths=new URL('./vendor/',location.href).href;T.env.backends.onnx.wasm.numThreads=1;
  ASR=await T.pipeline('automatic-speech-recognition','Xenova/whisper-tiny.en',{device:'wasm',dtype:{encoder_model:'q8',decoder_model_merged:'q8'}});
  asrState='ready';console.log('ASR ready in',Date.now()-t0,'ms');return ASR;}catch(e){console.warn('asr',e);asrState='failed';return null;}}
async function transcribe(a){if(!ASR||!a||a.length<4000)return '';try{const r=await ASR(a);return (r.text||'').replace(/\[[^\]]*\]|\([^)]*\)/g,'').trim();}catch(e){return '';}}

/* ---------- Car Mode ---------- */
let C=null,wake=null;
async function keepAwake(){try{if('wakeLock' in navigator)wake=await navigator.wakeLock.request('screen');}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(C&&document.visibilityState==='visible')keepAwake();});
function setCar(status,heard){if(status!=null)$('carStatus').textContent=status;if(heard!=null)$('carHeard').textContent=heard;}
async function startCar(sess,idx=0){stopAll();stopFlag=false;const my=++runId;C={sess,idx,run:my,paused:false,smart:false};pushHistory(sess);
  $('carTitle').textContent=sess.title;$('carPause').textContent='⏸ Стоп';show('car');keepAwake();setCar('…','');
  const micOk=await micInit();let eng='Режим: повторяйте за голосом (без проверки).';
  if(micOk){$('carEngine').textContent='Загружаю проверку речи… (первый раз ~1 минута)';await asrInit();if(ASR){C.smart=true;eng='Проверка речи включена (работает на телефоне, без интернета).';}}
  $('carEngine').textContent=eng;if(my!==runId)return;
  if(idx===0){await play(D.cues.start);if(sess.topicAudio)await play(sess.topicAudio);}else await play(D.cues.resume);
  carLoop(my);}
async function carCommand(text,my){const c=Cmp.command(text);if(c==='stop'){await carPause(true);return true;}
  if(c==='back'){await carBack();return true;}return false;}
async function carLoop(my){
  while(C&&my===runId&&C.idx<C.sess.items.length){const it=itemById(C.sess.items[C.idx]);saveState('car',C.sess,C.idx);
    $('carCount').textContent=(C.idx+1)+' / '+C.sess.items.length;$('carBar').style.width=(100*C.idx/C.sess.items.length)+'%';
    let ok=C.smart?await carSmartItem(it,my):await carTimedItem(it,my);if(my!==runId)return;
    mark(it.id,ok);C.idx++;await sleep(500);}
  if(C&&my===runId){$('carBar').style.width='100%';setCar('🎉','');finishLesson(C.sess);await praise('lesson');await play(D.cues.done);releaseCar();goHome();}}
async function carTimedItem(it,my){setCar('🔊','');await play(it.audio);if(my!==runId)return false;setCar('🗣️','');await sleep(Math.max(2500,it.dur*1500));
  if(my!==runId)return false;setCar('🔊','');await play(it.audio);if(my!==runId)return false;setCar('🗣️','');await sleep(Math.max(2500,it.dur*1500));return true;}
async function hear(my,wait){let a=await listen(wait,my);if(my!==runId)return null;
  if(!a){await play(D.cues.gentle);if(my!==runId)return null;a=await listen(25000,my);if(!a||my!==runId)return null;}
  setCar('⏳',null);const t=await transcribe(a);if(my!==runId)return null;setCar(null,t||'…');return t;}
async function carSmartItem(it,my){let hadError=false;
  for(let attempt=0;attempt<3;attempt++){setCar('🔊','');await play(it.audio);if(my!==runId)return false;setCar('🗣️','');
    const t=await hear(my,Math.max(8000,it.dur*3000));if(my!==runId||t===null)return false;
    if(await carCommand(t,my))return false;
    const r=Cmp.compare(it.en,t);
    if(r.verdict==='ok'){await praise(hadError?'fixed':'line');return !hadError;}
    hadError=true;
    if(r.verdict==='unclear'){await play(D.cues.unclear);continue;}
    // word drill: say the missed word, she repeats it 3 times correctly (max 6 tries)
    const w=r.key,wa=D.words[w];await play(D.cues.almost);if(wa)await play(wa);if(my!==runId)return false;
    let good=0;for(let k=0;k<6&&good<3;k++){await play(D.cues.sayword);if(wa)await play(wa);if(my!==runId)return false;setCar('🗣️ '+w,'');
      const tw=await hear(my,8000);if(my!==runId||tw===null)return false;if(await carCommand(tw,my))return false;
      if(Cmp.hasWord(w,tw)){good++;if(good<3)await play(D.cues.good_word);}else await play(D.cues.again);}
    if(good>=3)await praise('fixed');
    await play(D.cues.full_again);if(my!==runId)return false;}
  await play(D.cues.move_on);return false;}
async function carPause(spoken){if(!C)return;if(!C.paused){C.paused=true;const keep={sess:C.sess,idx:C.idx};runId++;stopFlag=true;MIC.rec=false;stopAudio();
    saveState('car',keep.sess,keep.idx);C.keep=keep;$('carPause').textContent='⏵ Продолжить';setCar('⏸','');await play(D.cues.paused);}
  else{const k=C.keep;startCar(k.sess,k.idx);}}
async function carBack(){const cur=C&&C.sess.lessonId;runId++;stopFlag=true;stopAudio();await play(D.cues.back);const id=previousLesson(cur);startCar(sessionFor('lesson',id),0);}
function releaseCar(){try{wake&&wake.release()}catch(e){}wake=null;C=null;}

/* ---------- Common ---------- */
function stopAll(){runId++;stopAudio();MIC.rec=false;}
function goHome(){stopAll();if(C)releaseCar();L=null;refreshHome();show('home');}
function refreshHome(){const r=S.get('resume',null);if(r&&r.sess){$('btnResume').classList.remove('hidden');$('resumeInfo').textContent=r.sess.title+' · '+(r.idx+1)+'/'+r.sess.items.length;}else $('btnResume').classList.add('hidden');}
function renderTopics(){const box=$('topicList');box.innerHTML='';const done=S.get('done',[]);D.lessons.forEach(l=>{const b=document.createElement('button');b.className='topic';
  b.innerHTML=(done.includes(l.id)?'✓ ':'')+l.title+'<br><small>'+l.track+'</small>';b.onclick=()=>chooseMode(l.id);box.appendChild(b);});}
function chooseMode(id){const car=confirm('Режим «В машине» (без рук)? OK = в машине, Отмена = обычный урок.');const s=sessionFor('lesson',id);car?startCar(s):startLesson(s);}
function renderWeak(){const r=S.get('srs',{});const w=weakItems(30);const box=$('weakList');box.innerHTML='';
  if(!w.length){box.innerHTML='<div class="wk">Пока слабых мест нет. Отлично! 🎉</div>';return;}
  w.forEach(it=>{const d=document.createElement('div');d.className='wk';d.innerHTML='🔊 '+it.lesson.title+' · «Трудно»: '+r[it.id].hard;d.onclick=()=>play(it.audio);box.appendChild(d);});}
function renderProgress(){const r=S.get('srs',{});const ids=Object.keys(r);const learned=ids.filter(i=>r[i].box>=3).length;const days=S.get('days',{});
  let streak=0;for(let i=0;;i++){const d=new Date(Date.now()-i*864e5).toISOString().slice(0,10);if(days[d])streak++;else if(i>0)break;else continue;if(i>400)break;}
  const done=S.get('done',[]);$('progList').innerHTML=`<div class="wk">Уроков пройдено: <b>${done.length} / ${D.lessons.length}</b></div>
  <div class="wk">Фраз начато: <b>${ids.length}</b> · выучено: <b>${learned}</b></div><div class="wk">Дней подряд: <b>${streak}</b> 🔥</div>
  <div class="wk">Слабых мест: <b>${weakItems(999).length}</b></div>`;}

/* ---------- Wire up ---------- */
async function init(){D=await (await fetch('data.json',{cache:'no-cache'})).json();
  $('introEn1').textContent=D.intro[0].en;$('introRu1').textContent=D.intro[0].ru;$('introEn2').textContent=D.intro[1].en;$('introRu2').textContent=D.intro[1].ru;
  $('btnIntro').onclick=async()=>{$('introText').classList.remove('hidden');stopAll();await play('intro_en.mp3');};
  $('btnStart').onclick=()=>startLesson(sessionFor('lesson',nextLessonId()));
  $('btnCar').onclick=()=>{const r=S.get('resume',null);if(r&&r.mode==='car')startCar(r.sess,r.idx);else startCar(sessionFor('lesson',nextLessonId()));};
  $('btnWeak').onclick=$('btnWeak2').onclick=()=>startLesson(sessionFor('weak'));
  $('btnBusy').onclick=()=>startLesson(sessionFor('busy'));
  $('btnBack').onclick=async()=>{stopAll();await play(D.cues.back);startLesson(sessionFor('lesson',previousLesson(null)));};
  $('btnResume').onclick=()=>{const r=S.get('resume',null);if(!r)return;r.mode==='car'?startCar(r.sess,r.idx):startLesson(r.sess,r.idx);};
  $('btnListen').onclick=()=>{const a=$('instrAudio');a.classList.remove('hidden');stopAll();a.play();};
  $('btnProgress').onclick=()=>{renderProgress();show('progress');};
  $('btnWeakScreen').onclick=()=>{renderWeak();show('weak');};
  $('btnTopics').onclick=()=>{renderTopics();show('topics');};
  document.querySelectorAll('[data-home]').forEach(b=>b.onclick=goHome);
  $('lAgain').onclick=async()=>{if(!L)return;const it=itemById(L.sess.items[L.idx]);stopAudio();await play(it.audio);};
  $('lGot').onclick=()=>{stopAudio();lessonAnswer(true);};$('lHard').onclick=()=>{stopAudio();lessonAnswer(false);};
  $('lStop').onclick=async()=>{if(L)saveState('lesson',L.sess,L.idx);stopAll();await play(D.cues.paused);goHome();};
  $('lBack').onclick=async()=>{const cur=L&&L.sess.lessonId;stopAll();await play(D.cues.back);startLesson(sessionFor('lesson',previousLesson(cur)));};
  $('carPause').onclick=()=>carPause(false);$('carBack').onclick=carBack;$('carHome').onclick=goHome;
  refreshHome();}
init();
})();
