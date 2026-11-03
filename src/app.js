const $=id=>document.getElementById(id);const MOB=matchMedia('(max-width:900px)').matches;
const I18N={zh:{title:'互联网情报系统',sub:'INTERNET INTELLIGENCE SYSTEM · 全球AI热点实时地图',ev:'实时事件流',events:'事件',countries:'国家/地区',orgs:'机构',updated:'更新',byC:'按国家/地区统计',byO:'按公司/机构统计',lb:'主流 AI 模型榜',q:'$ search 中英全文搜索…',allCat:'全部类别',allReg:'全部地区',allT:'全部时间',h24:'24小时内',d3:'3天内',d7:'7天内',
 cat:{model:'模型发布',funding:'融资',policy:'政策',paper:'论文',product:'产品',other:'其他'},arena:'LMArena 综合',orr:'OpenRouter 调用量',src:'来源',login:'登录',reg:'注册',user:'用户名',pw:'密码',enter:'[ 接入系统 ]',create:'[ 创建账号 ]',logout:'退出',
 aNote:'本地门禁：账号仅存于本浏览器，密码经 PBKDF2-SHA256 哈希。',aSub:'身份验证 // AUTH REQUIRED',noUser:'用户不存在，请先注册',badPw:'密码错误',exists:'用户名已存在',short:'用户名≥3位，密码≥6位',ok:'注册成功，正在接入…',mode2d:'2D 模式',mode3d:'3D 地球',unk:'未定位'},
 en:{title:'Internet Intelligence System',sub:'互联网情报系统 · Global AI hotspots, live',ev:'Live Event Stream',events:'Events',countries:'Countries',orgs:'Orgs',updated:'Updated',byC:'By Country/Region',byO:'By Company/Org',lb:'Top AI Model Leaderboards',q:'$ search full-text (EN/中文)…',allCat:'All categories',allReg:'All regions',allT:'Any time',h24:'Last 24h',d3:'Last 3 days',d7:'Last 7 days',
 cat:{model:'Model release',funding:'Funding',policy:'Policy',paper:'Paper',product:'Product',other:'Other'},arena:'LMArena Overall',orr:'OpenRouter usage',src:'Source',login:'Login',reg:'Register',user:'Username',pw:'Password',enter:'[ ACCESS ]',create:'[ CREATE ACCOUNT ]',logout:'Logout',
 aNote:'Local gate only: account stored in this browser, password hashed with PBKDF2-SHA256.',aSub:'AUTH REQUIRED // 身份验证',noUser:'User not found — register first',badPw:'Wrong password',exists:'Username taken',short:'Username ≥3, password ≥6 chars',ok:'Registered, connecting…',mode2d:'2D mode',mode3d:'3D globe',unk:'Unlocated'}};
const CN={US:['美国','United States'],CN:['中国','China'],GB:['英国','UK'],FR:['法国','France'],DE:['德国','Germany'],JP:['日本','Japan'],KR:['韩国','Korea'],IN:['印度','India'],CA:['加拿大','Canada'],IL:['以色列','Israel'],SG:['新加坡','Singapore'],AE:['阿联酋','UAE'],SA:['沙特','Saudi Arabia'],TW:['中国台湾','Taiwan, China'],HK:['中国香港','Hong Kong, China'],RU:['俄罗斯','Russia'],BR:['巴西','Brazil'],AU:['澳大利亚','Australia'],NL:['荷兰','Netherlands'],SE:['瑞典','Sweden'],CH:['瑞士','Switzerland'],IT:['意大利','Italy'],ES:['西班牙','Spain'],EU:['欧盟','EU'],IE:['爱尔兰','Ireland']};
let L=localStorage.lang||'zh',T=I18N[L],EV=[],MD=null,view=[],G=null,mode=null,lbTab='arena',ms=null;
const cn=c=>c?(CN[c]?CN[c][L=='zh'?0:1]:c):T.unk;const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const COL={model:'#00e5ff',funding:'#ffc400',policy:'#ff3b5c',paper:'#b98cff',product:'#00ff9c',other:'#678'};

/* ---------- intro ---------- */
function intro(done){const box=$('intro'),cv=$('rainI'),x=cv.getContext('2d');let w,h,cols,drops,run=true;
 const rs=()=>{w=cv.width=innerWidth;h=cv.height=innerHeight;cols=Math.floor(w/(MOB?18:14));drops=Array(cols).fill(0).map(()=>Math.random()*-50)};rs();
 const ch='01アイウエオカキクケコ<>/{}#$%AI情报';let last=0;
 (function f(t){if(!run)return;if(t-last>(MOB?60:40)){last=t;x.fillStyle='rgba(0,0,0,.09)';x.fillRect(0,0,w,h);x.fillStyle='#00ff9c';x.font=(MOB?14:13)+'px monospace';
  drops.forEach((d,i)=>{x.fillText(ch[Math.random()*ch.length|0],i*(MOB?18:14),d*14);drops[i]=d*14>h&&Math.random()>.97?0:d+1})}requestAnimationFrame(f)})(0);
 const lines=['> establishing uplink ........ [OK]','> handshake 14 CN feeds + 6 global feeds ... [OK]','> LiteLLM classifier @ local node ... [OK]','> geolocating events ... [OK]','','#BIG#','','> ACCESS CONTROL ENGAGED_'];
 const el=$('introTxt');let li=0,ci=0,out='';const big=`<span class="big">${T.title}</span>`;
 const tick=()=>{if(!run)return;if(li>=lines.length){setTimeout(end,700);return}const l=lines[li];if(l=='#BIG#'){out+=big;li++;el.innerHTML=out;setTimeout(tick,500);return}
  if(ci<l.length){ci+=3;el.innerHTML=out+esc(l.slice(0,ci))+'█';setTimeout(tick,14)}else{out+=esc(l)+'\n';li++;ci=0;el.innerHTML=out;setTimeout(tick,90)}};tick();
 const end=()=>{if(!run)return;run=false;box.style.opacity=0;setTimeout(()=>{box.remove();done()},500)};$('skip').onclick=end;box.addEventListener('click',e=>{if(e.target.id!='skip')end()});}

/* ---------- local auth (gate only) ---------- */
const enc=new TextEncoder(),hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function hashPw(pw,salt){const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:150000,hash:'SHA-256'},k,256))}
const users=()=>JSON.parse(localStorage.iis_users||'{}');let aMode='login';
function authUI(){$('aT').textContent=T.title;$('aSub').textContent=T.aSub;$('tL').textContent=T.login;$('tR').textContent=T.reg;$('lU').textContent=T.user;$('lP').textContent=T.pw;$('aGo').textContent=aMode=='login'?T.enter:T.create;$('aNote').textContent=T.aNote;$('tL').classList.toggle('on',aMode=='login');$('tR').classList.toggle('on',aMode=='reg')}
function auth(done){if(sessionStorage.iis_session&&users()[sessionStorage.iis_session])return done();const a=$('auth');a.style.display='flex';authUI();
 $('tL').onclick=()=>{aMode='login';authUI()};$('tR').onclick=()=>{aMode='reg';authUI()};
 a.querySelector('form').onsubmit=async e=>{e.preventDefault();const u=$('aU').value.trim(),p=$('aP').value,m=$('aMsg');if(u.length<3||p.length<6){m.textContent=T.short;return}
  const db=users();if(aMode=='reg'){if(db[u]){m.textContent=T.exists;return}const salt=hex(crypto.getRandomValues(new Uint8Array(16)));db[u]={salt,h:await hashPw(p,salt),t:Date.now()};localStorage.iis_users=JSON.stringify(db);m.textContent=T.ok}
  else{if(!db[u]){m.textContent=T.noUser;return}if(await hashPw(p,db[u].salt)!==db[u].h){m.textContent=T.badPw;return}}
  sessionStorage.iis_session=u;a.style.display='none';done()}}

/* ---------- data ---------- */
async function race(path){const base=location.hostname.endsWith('github.io')||location.hostname=='localhost'?[path+'?_='+Date.now()]:[path];
 const M=[...base,...['cdn.jsdmirror.com','gcore.jsdelivr.net','fastly.jsdelivr.net','cdn.jsdelivr.net'].map(h=>`https://${h}/gh/zeta-bat-2030/ai-radar-map@main/${path}`)];
 return new Promise((res,rej)=>{let n=M.length,got=0;M.forEach((u,i)=>setTimeout(()=>{if(got)return;fetch(u).then(r=>r.ok?r.json():Promise.reject()).then(j=>{if(!got){got=1;res(j)}}).catch(()=>{if(--n==0)rej()})},i*300))})}
function tok(s){const out=[];String(s).toLowerCase().split(/[\s,.;:!?，。；：！？、"'“”‘’()（）\[\]【】《》<>|/\\-]+/).forEach(w=>{if(!w)return;if(/[\u4e00-\u9fff]/.test(w)){const c=[...w];c.forEach((x,i)=>{out.push(x);if(i<c.length-1)out.push(x+c[i+1])})}else out.push(w)});return out}
function buildIndex(){ms=new MiniSearch({fields:['title','zh','en','org','src'],storeFields:['id'],tokenize:tok,searchOptions:{tokenize:tok,prefix:true,fuzzy:.15,combineWith:'AND'}});ms.addAll(EV)}

/* ---------- render ---------- */
function i18n(){T=I18N[L];document.documentElement.lang=L=='zh'?'zh-CN':'en';document.title=T.title;$('ttl').textContent=T.title;$('sub').textContent=T.sub;$('hEv').textContent='> '+T.ev+' tail -f';$('hC').textContent='> '+T.byC;$('hO').textContent='> '+T.byO;$('hLb').textContent='> '+T.lb;
 $('q').placeholder=T.q;$('lang').textContent=L=='zh'?'EN':'中文';$('out').textContent=T.logout;
 $('fCat').innerHTML=`<option value="">${T.allCat}</option>`+Object.keys(T.cat).map(k=>`<option value="${k}">${T.cat[k]}</option>`).join('');
 const regs=[...new Set(EV.map(e=>e.country).filter(Boolean))].sort();const rv=$('fReg').value;$('fReg').innerHTML=`<option value="">${T.allReg}</option>`+regs.map(r=>`<option value="${r}">${cn(r)}</option>`).join('');$('fReg').value=rv;
 $('fT').innerHTML=[['',T.allT],['24',T.h24],['72',T.d3],['168',T.d7]].map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
 $('legend').innerHTML=Object.keys(COL).map(k=>`<span style="color:${COL[k]}">■ ${T.cat[k]}</span>`).join('');$('sL').textContent=T.events;$('sC').textContent=T.countries;$('sO').textContent=T.orgs;$('sU').textContent=T.updated}
function filter(){const q=$('q').value.trim(),c=$('fCat').value,r=$('fReg').value,t=+$('fT').value;let base=EV;
 if(q){const ids=new Set(ms.search(q).map(x=>x.id));base=EV.filter(e=>ids.has(e.id))}const now=Date.now();
 view=base.filter(e=>(!c||e.cat==c)&&(!r||e.country==r)&&(!t||!e.ts||now-e.ts<t*3600e3));render()}
function stat(key,el){const m={};view.forEach(e=>{const k=e[key];if(k)m[k]=(m[k]||0)+1});const a=Object.entries(m).sort((x,y)=>y[1]-x[1]).slice(0,10),mx=a[0]?a[0][1]:1;
 $(el).innerHTML=a.map(([k,v])=>`<div class="row"><span class="n" title="${esc(k)}">${esc(key=='country'?cn(k):k)}</span><span class="bar2"><i style="width:${v/mx*100}%"></i></span><span class="v">${v}</span></div>`).join('')||'<div class="row">—</div>';return a.length}
function evHTML(e){const s=L=='zh'?(e.zh||e.title):(e.en||e.title);const ago=e.ts?Math.max(0,Math.round((Date.now()-e.ts)/36e5))+'h':'';
 return `<div class="ev" data-id="${e.id}"><div class="t"><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(s)}</a></div><div class="m"><span class="tag c-${e.cat}">${T.cat[e.cat]||e.cat}</span><span>📍${esc(cn(e.country))}${e.city?' · '+esc(e.city):''}</span>${e.org?`<span>◆${esc(e.org)}</span>`:''}<span>${T.src}: ${esc(e.src)}</span><span>${ago}</span></div></div>`}
function render(){$('evs').innerHTML=view.slice(0,150).map(evHTML).join('');$('sE').textContent=view.length;$('sCn').textContent=stat('country','byC');$('sOr').textContent=stat('org','byO');geo()}
function lb(){if(!MD)return;const A=MD.lmarena||[],O=MD.openrouter||[];const fmt=n=>n>1e12?(n/1e12).toFixed(1)+'T':(n/1e9).toFixed(0)+'B';
 $('lbBody').innerHTML=lbTab=='arena'?`<ol>${A.map(m=>`<li><a href="${MD.lmarena_src}" target="_blank" rel="noopener">${esc(m.model)}</a> <span class="src">${esc(m.org)}</span><em>${m.score}</em></li>`).join('')}</ol><div class="src">${T.src}: <a href="${MD.lmarena_src}" target="_blank">lmarena.ai</a> · <a href="${MD.lmarena_data}" target="_blank">HF dataset</a> · ${A[0]?A[0].date:''}</div>`
 :`<ol>${O.map(m=>`<li><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.model)}</a><em>${fmt(m.tokens)}</em></li>`).join('')}</ol><div class="src">${T.src}: <a href="${MD.openrouter_src}" target="_blank">openrouter.ai/rankings</a> · ${esc(MD.openrouter_range||'')} tokens</div>`;
 $('tA').textContent=T.arena;$('tO').textContent=T.orr;$('tA').classList.toggle('on',lbTab=='arena');$('tO').classList.toggle('on',lbTab!='arena')}

/* ---------- globe / 2D ---------- */
const HUBS={US:[37.77,-122.42],CN:[39.9,116.4]};
function arcsOf(pts){const a=[];pts.forEach((p,i)=>{const h=p.country=='CN'?HUBS.US:HUBS.CN;if(i%2==0)a.push({startLat:p.lat,startLng:p.lng,endLat:h[0],endLng:h[1],color:[COL[p.cat],'rgba(0,229,255,.25)']});else if(pts[i-1])a.push({startLat:pts[i-1].lat,startLng:pts[i-1].lng,endLat:p.lat,endLng:p.lng,color:['rgba(0,255,156,.2)',COL[p.cat]]})});return a.slice(0,60)}
function weak(){const c=document.createElement('canvas');const gl=c.getContext('webgl')||c.getContext('experimental-webgl');if(!gl)return true;if(/[?&]2d/.test(location.search))return true;
 return MOB&&((navigator.deviceMemory&&navigator.deviceMemory<=3)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4))}
function initMap(){if(!weak()&&window.Globe){mode='3d';const el=$('globe');G=Globe({rendererConfig:{antialias:!MOB,powerPreference:'high-performance'}})(el).globeImageUrl('vendor/earth-night.jpg').bumpImageUrl(MOB?null:'vendor/earth-topology.png').backgroundColor('rgba(0,0,0,0)')
  .atmosphereColor('#00ff9c').atmosphereAltitude(.18).pointAltitude(.02).pointRadius(.45).pointColor(d=>COL[d.cat]).pointLabel(d=>`<div style="background:#000c;border:1px solid #0f9;padding:5px;max-width:260px">${esc(L=='zh'?d.zh||d.title:d.en||d.title)}</div>`).onPointClick(d=>open(d.url,'_blank'))
  .arcColor('color').arcDashLength(.4).arcDashGap(2).arcDashAnimateTime(()=>1800+Math.random()*2500).arcStroke(.5)
  .ringColor(d=>t=>`rgba(0,255,156,${1-t})`).ringMaxRadius(3.5).ringPropagationSpeed(2.5).ringRepeatPeriod(1400);
  const fit=()=>G.width(el.clientWidth).height(el.clientHeight);fit();addEventListener('resize',fit);G.controls().autoRotate=true;G.controls().autoRotateSpeed=.45;G.pointOfView({lat:30,lng:100,altitude:MOB?2.6:2.1});$('map2d').style.display='none'}
 else{mode='2d';$('globe').style.display='none';img.src='vendor/earth-night.jpg';img.onload=draw2d;addEventListener('resize',draw2d);(function loop(){draw2d();setTimeout(()=>requestAnimationFrame(loop),MOB?80:40)})()}
 $('mapInfo').textContent=(mode=='3d'?T.mode3d:T.mode2d)+' · drag / zoom · ?2d'}
const img=new Image();let t2=0;
function draw2d(){const c=$('map2d'),r=c.getBoundingClientRect();if(!r.width)return;const dpr=Math.min(devicePixelRatio,2);if(c.width!=r.width*dpr){c.width=r.width*dpr;c.height=r.height*dpr}const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);
 const W=r.width,H=r.height;x.fillStyle='#000';x.fillRect(0,0,W,H);const s=Math.min(W/2,H)*1,mw=s*2,mh=s,ox=(W-mw)/2,oy=(H-mh)/2;if(img.complete)x.drawImage(img,ox,oy,mw,mh);
 const P=(la,ln)=>[ox+(ln+180)/360*mw,oy+(90-la)/180*mh];t2+=.012;const pts=view.filter(e=>e.lat!=null);
 arcsOf(pts).forEach((a,i)=>{const[x1,y1]=P(a.startLat,a.startLng),[x2,y2]=P(a.endLat,a.endLng),mx=(x1+x2)/2,my=(y1+y2)/2-Math.hypot(x2-x1,y2-y1)*.3;x.strokeStyle='rgba(0,229,255,.18)';x.lineWidth=1;x.beginPath();x.moveTo(x1,y1);x.quadraticCurveTo(mx,my,x2,y2);x.stroke();
  const k=(t2+i*.13)%1,qx=(1-k)*(1-k)*x1+2*(1-k)*k*mx+k*k*x2,qy=(1-k)*(1-k)*y1+2*(1-k)*k*my+k*k*y2;x.fillStyle=a.color[0];x.beginPath();x.arc(qx,qy,2,0,7);x.fill()});
 pts.forEach((p,i)=>{const[px,py]=P(p.lat,p.lng),k=(t2*1.5+i*.07)%1;x.strokeStyle=`rgba(0,255,156,${1-k})`;x.beginPath();x.arc(px,py,2+k*10,0,7);x.stroke();x.fillStyle=COL[p.cat];x.beginPath();x.arc(px,py,2.5,0,7);x.fill()})}
function geo(){const pts=view.filter(e=>e.lat!=null);if(mode=='3d'&&G){G.pointsData(pts).arcsData(arcsOf(pts)).ringsData(pts.slice(0,MOB?12:30))}}

/* ---------- live stream ticker: 新事件逐条“推入” ---------- */
function live(){let i=0;setInterval(()=>{if(!view.length||$('q').value)return;const box=$('evs');if(box.children.length<2)return;const n=box.lastElementChild,e=EV.find(x=>x.id==n.dataset.id)||{};n.style.animation='none';n.offsetWidth;n.style.animation='';n.style.borderLeft='2px solid '+COL[e.cat];box.prepend(n);box.scrollTop=0;
 if(mode=='3d'&&G&&e.lat!=null&&!MOB)G.pointOfView({lat:e.lat,lng:e.lng,altitude:2.1},1600)},4000)}

function loadScript(src){return new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=j;document.head.appendChild(s)})}
async function start(){$('app').style.display=MOB?'flex':'grid';i18n();
 const [ev,md]=await Promise.all([race('data/events.json'),race('data/models.json').catch(()=>null),loadScript('vendor/minisearch.min.js')]);
 EV=ev.items.sort((a,b)=>(b.ts||0)-(a.ts||0));MD=md;$('sUv').textContent=new Date(ev.generated_at).toLocaleString(L=='zh'?'zh-CN':'en-US',{hour12:false});i18n();buildIndex();lb();filter();live();
 if(!weak())loadScript('vendor/globe.gl.min.js').then(()=>{initMap();geo()}).catch(()=>{initMap()});else{initMap()}}
['q','fCat','fReg','fT'].forEach(id=>$(id).addEventListener(id=='q'?'input':'change',filter));
$('lang').onclick=()=>{L=L=='zh'?'en':'zh';localStorage.lang=L;i18n();authUI();render();lb()};$('tA').onclick=()=>{lbTab='arena';lb()};$('tO').onclick=()=>{lbTab='or';lb()};
$('out').onclick=()=>{delete sessionStorage.iis_session;location.reload()};
const skipIntro=sessionStorage.iis_intro;sessionStorage.iis_intro=1;(skipIntro?f=>{$('intro').remove();f()}:intro)(()=>auth(start));
