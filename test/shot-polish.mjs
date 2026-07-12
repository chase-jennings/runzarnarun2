import { chromium, devices } from 'playwright';
import path from 'path'; import fs from 'fs'; import http from 'http';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.webp':'image/webp','.png':'image/png'};
const server = http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const fp=path.join(ROOT,p);if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));
const URL = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const S = path.join(__dirname,'shots');
const errs = [];

async function open(name, opts){
  const c = await browser.newContext(opts);
  const p = await c.newPage();
  p.on('console', m=>{ if(m.type()==='error') errs.push(`[${name}] ${m.text()}`); });
  p.on('pageerror', e=>errs.push(`[${name}] ${e.message}`));
  await p.goto(URL, {waitUntil:'load'});
  await p.waitForFunction(()=>!!window.__dbg);
  await p.waitForFunction(()=>window.__dbg.photoReady===true,{timeout:6000}).catch(()=>{});
  await p.evaluate(()=>window.__dbg.pause(true));
  return {c,p};
}

// --- portrait: title on a blink-ON frame ---
let {c,p} = await open('portrait', {...devices['iPhone 12'], hasTouch:true});
await p.evaluate(()=>{ while(((window.__dbg.frame>>5)&1)!==1) window.__dbg.step(1); });
await p.screenshot({path:path.join(S,'p-title.png')});
// intro beats
await p.evaluate(()=>{ window.__dbg.press.primary(); window.__dbg.step(1); });
await p.evaluate(()=>window.__dbg.step(120));   // t~120: taxi arriving
await p.screenshot({path:path.join(S,'p-intro-arrive.png')});
await p.evaluate(()=>window.__dbg.step(75));    // t~195: phone buzz
await p.screenshot({path:path.join(S,'p-intro-buzz.png')});
await p.evaluate(()=>window.__dbg.step(70));    // t~265: driving off
await p.screenshot({path:path.join(S,'p-intro-depart.png')});
// gameplay: rat at 13
await p.evaluate(()=>{ window.__dbg.step(140); });   // into play
await p.evaluate(()=>{ const h=window.__dbg.player; h.x=10*16; window.__dbg.step(30); });
await p.screenshot({path:path.join(S,'p-play-rat-cart.png')});
// taxi at 42-46 zone
await p.evaluate(()=>{ const h=window.__dbg.player; h.x=39*16; h.y=8*16; window.__dbg.step(40); });
await p.screenshot({path:path.join(S,'p-play-taxi.png')});
// statue performer at 64 (ghost(64,4)) — face away (walk right past it) then look at it
await p.evaluate(()=>{ const h=window.__dbg.player; h.x=61*16; h.y=8*16; h.dir=-1; window.__dbg.step(50); });
await p.screenshot({path:path.join(S,'p-play-statue-creep.png')});   // facing away: it creeps
await p.evaluate(()=>{ const h=window.__dbg.player; h.dir=1; window.__dbg.step(10); });
await p.screenshot({path:path.join(S,'p-play-statue-frozen.png')});  // looking: frozen pose
// AC unit dropper at 26 (spider(26,7,24))
await p.evaluate(()=>{ const h=window.__dbg.player; h.x=25*16; h.y=9*16; window.__dbg.step(50); });
await p.screenshot({path:path.join(S,'p-play-ac.png')});
await c.close();

// --- landscape title ---
{
  const {c:c2,p:p2} = await open('landscape', {viewport:{width:780,height:360}, hasTouch:true, isMobile:true});
  await p2.evaluate(()=>{ while(((window.__dbg.frame>>5)&1)!==1) window.__dbg.step(1); });
  await p2.screenshot({path:path.join(S,'l-title.png')});
  await c2.close();
}

await browser.close(); server.close();
console.log(errs.length ? 'ERRORS:\n'+errs.join('\n') : 'zero console/page errors');
