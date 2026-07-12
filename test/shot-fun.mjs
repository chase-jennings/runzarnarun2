import { chromium, devices } from 'playwright';
import path from 'path'; import fs from 'fs'; import http from 'http';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.webp':'image/webp','.png':'image/png'};
const server = http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const fp=path.join(ROOT,p);if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));
const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const S = path.join(__dirname,'shots');
const errs = [];
const ctx = await browser.newContext({...devices['iPhone 12'], hasTouch:true});
const page = await ctx.newPage();
page.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
page.on('pageerror', e=>errs.push(e.message));
await page.goto(`http://localhost:${server.address().port}/index.html`, {waitUntil:'load'});
await page.waitForFunction(()=>!!window.__dbg);
await page.waitForFunction(()=>window.__dbg.photoReady===true,{timeout:6000}).catch(()=>{});
await page.evaluate(()=>{ window.__dbg.pause(true); window.__dbg.step(1); });

async function scene(name, fn){ await page.evaluate(fn); await page.screenshot({path:path.join(S,`fun-${name}.png`)}); }

// title on blink-on frame
await scene('01-title', ()=>{ while((( window.__dbg.frame>>5)&1)!==1) window.__dbg.step(1); });
// into play
await page.evaluate(()=>{ window.__dbg.press.primary(); window.__dbg.step(30); window.__dbg.press.primary(); window.__dbg.step(5); });
// act1: rat + billboard zone
await scene('02-act1-rat-billboard', ()=>{ const h=window.__dbg.hero; h.x=20*16; h.y=8*16; h.inv=99999; window.__dbg.step(40); });
// taxi + name tag zone
await scene('03-act1-taxi', ()=>{ const h=window.__dbg.hero; h.x=27*16; h.y=8*16; window.__dbg.step(35); });
// act2: SPICY platform + cones
await scene('04-act2-spicy', ()=>{ const h=window.__dbg.hero; h.x=76*16; h.y=8*16; window.__dbg.step(30); });
// act2: hot-dog cart
await scene('05-act2-hotcart', ()=>{ const h=window.__dbg.hero; h.x=94*16; h.y=8*16; window.__dbg.step(35); });
// chai perch + Super Auntie
await scene('06-chai-perch', ()=>{ const h=window.__dbg.hero; h.x=110*16; h.y=8*16; window.__dbg.step(25); });
await scene('07-super-auntie', ()=>{ const h=window.__dbg.hero; h.x=118*16; h.y=8*16; window.__dbg.requestWolf(); window.__dbg.step(20); });
// act3: countdown sign
await scene('08-act3-sign', ()=>{ const h=window.__dbg.hero; h.x=140*16; h.y=8*16; window.__dbg.step(30); });
// act4: stage door + family
await scene('09-act4-door', ()=>{ const h=window.__dbg.hero; h.x=220*16; h.y=8*16; h.inv=99999; window.__dbg.step(30); });
// win + photo
await scene('10-photo', ()=>{ const h=window.__dbg.hero; const L=window.__dbg.leah; h.x=L.x; h.y=L.y-16; for(let i=0;i<10;i++){window.__dbg.step(1); if(window.__dbg.state==='photo')break;} window.__dbg.step(50); });
await ctx.close();

// landscape gameplay
const c2 = await browser.newContext({viewport:{width:780,height:360}, hasTouch:true, isMobile:true});
const p2 = await c2.newPage();
p2.on('pageerror', e=>errs.push(e.message));
await p2.goto(`http://localhost:${server.address().port}/index.html`, {waitUntil:'load'});
await p2.waitForFunction(()=>!!window.__dbg);
await p2.evaluate(()=>{ window.__dbg.pause(true); window.__dbg.press.primary(); window.__dbg.step(30); window.__dbg.press.primary(); window.__dbg.step(5); const h=window.__dbg.hero; h.x=27*16; h.y=8*16; window.__dbg.step(35); });
await p2.screenshot({path:path.join(S,'fun-11-landscape.png')});
await c2.close();

await browser.close(); server.close();
console.log(errs.length ? 'ERRORS:\n'+errs.join('\n') : 'zero console/page errors');
