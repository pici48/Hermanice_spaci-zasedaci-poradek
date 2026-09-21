// Verze zasedaciho poradku: migrace stareho stavu, prepinani, izolace variant.
const PORT=process.env.PORT||9311, sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function t(){for(let i=0;i<40;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
 const p=l.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;}catch{}await sleep(500);}throw new Error('no debugger');}
const ws=new WebSocket(await t());await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(mt,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:mt,params:p}));});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value;
await send('Page.enable');await send('Runtime.enable');
// Nativni alert() v headless blokuje a Runtime.evaluate se nevrati - viz zasek 20. 8.
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
  if(m.method==='Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog',{accept:true});});
await send('Emulation.setDeviceMetricsOverride',{width:1500,height:1100,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:process.argv[2]});await sleep(3000);

let fail=0;
const ok=(n,c,d='')=>{console.log((c?'  OK  ':'  FAIL')+'  '+n+(d?'   '+d:''));if(!c)fail++;};

// --- 1) MIGRACE: nasadime STARY format (seats, zadne seatVers) a reloadneme
await ev(`localStorage.setItem('ubytovani-v1',JSON.stringify({
  assign:{"p01-0":"nevesta_novomanzele"}, spani:{}, caps:{}, floor:{},
  seats:{"t1-h0":"matka-nevesty_rodina-nevesty","t1-h1":"sestra-nevesty_rodina-nevesty","t1-h2":"otec-nevesty_rodina-nevesty"}
}));localStorage.setItem('ubytovani-view','sezeni');location.reload()`);
await sleep(3000);
await ev(`window.__a=null;window.alert=m=>{window.__a=m};window.confirm=()=>true`);
const m=await ev(`({vers:Object.keys(S.seatVers||{}),cur:S.seatCur,
  seats:Object.keys(S.seats||{}).length,inVer:Object.keys((S.seatVers||{})[S.seatCur]||{}).length,
  spani:Object.keys(S.assign).length})`);
ok('migrace vytvorila verzi ze stareho stavu', m.vers.length===1&&m.cur==='Varianta A', JSON.stringify(m));
ok('3 usazeni prezili migraci', m.seats===3&&m.inVer===3);
ok('spani migrace nedotkla', m.spani===1);

// --- 2) UI listy variant
const u=await ev(`({bar:!!document.querySelector('.verbar'),
  opts:[...document.querySelectorAll('.versel option')].map(o=>o.textContent),
  btns:[...document.querySelectorAll('.verbtn')].map(b=>b.textContent)})`);
ok('lista variant se vykreslila', u.bar, JSON.stringify(u.opts));
ok('ctyri tlacitka', u.btns.length===4, u.btns.join(' | '));

// --- 3) lista variant NENI ve spani
await ev(`document.querySelector('#tabs button[data-v=spani]').click()`);await sleep(700);
ok('ve Spani lista variant neni', !(await ev(`!!document.querySelector('.verbar')`)));
await ev(`document.querySelector('#tabs button[data-v=sezeni]').click()`);await sleep(700);

// --- 4) NOVA prazdna varianta: puvodni musi zustat nedotcena
await ev(`window.prompt=()=>'Varianta B'; newVer(false)`);await sleep(800);
const n=await ev(`({cur:S.seatCur,vers:Object.keys(S.seatVers),
  bNow:Object.keys(S.seats||{}).length, aKept:Object.keys(S.seatVers['Varianta A']||{}).length})`);
ok('nova varianta je aktivni a prazdna', n.cur==='Varianta B'&&n.bNow===0, JSON.stringify(n));
ok('Varianta A si drzi svoje 3 usazene', n.aKept===3);

// --- 5) usadit nekoho v B, pak prepnout na A a zpet -> nic se neztrati
await ev(`(()=>{const s=document.querySelector('.ov.seat.empty')||document.querySelector('.ov.seat');
  s.click();const g=document.querySelector('#sheetlist .g');g&&g.click();})()`);
await sleep(900);
const bCount=await ev(`Object.keys(S.seats||{}).length`);
ok('v B se podarilo usadit', bCount>=1, 'usazeno '+bCount);
await ev(`switchVer('Varianta A')`);await sleep(800);
const backA=await ev(`({cur:S.seatCur,n:Object.keys(S.seats||{}).length})`);
ok('prepnuti na A vrati 3 usazene', backA.cur==='Varianta A'&&backA.n===3, JSON.stringify(backA));
await ev(`switchVer('Varianta B')`);await sleep(800);
const backB=await ev(`({cur:S.seatCur,n:Object.keys(S.seats||{}).length})`);
ok('prepnuti zpet na B zachovalo praci', backB.cur==='Varianta B'&&backB.n===bCount, JSON.stringify(backB));

// --- 6) DUPLIKOVAT
await ev(`window.prompt=()=>'Kopie B'; newVer(true)`);await sleep(800);
const d=await ev(`({cur:S.seatCur,n:Object.keys(S.seats||{}).length,vers:Object.keys(S.seatVers).length})`);
ok('duplikat ma stejny obsah', d.cur==='Kopie B'&&d.n===bCount&&d.vers===3, JSON.stringify(d));

// --- 7) SMAZAT az na jednu + pojistka na posledni
while((await ev(`Object.keys(S.seatVers).length`))>1){ await ev(`deleteVer()`); await sleep(500); }
ok('smazat lze az na jednu variantu', (await ev(`Object.keys(S.seatVers).length`))===1);
await ev(`window.__a=null; deleteVer()`); await sleep(500);
const last=await ev(`({vers:Object.keys(S.seatVers).length,alert:window.__a})`);
ok('posledni variantu smazat nejde', last.vers===1&&/Posledn/.test(last.alert||''), JSON.stringify(last));

// --- 8) spani je porad nedotcene
ok('spani zustalo po vsech operacich', (await ev(`Object.keys(S.assign).length`))===1);

console.log(fail?`\n>>> ${fail} TESTU SELHALO <<<`:'\nvsechny testy prosly');
ws.close();process.exit(fail?1:0);
