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


await page.evaluate(()=>{ window.__dbg.press.primary(); window.__dbg.step(30); window.__dbg.press.primary(); window.__dbg.step(5); });
// fixed crate zone (no stair, no cones)
await page.evaluate(()=>{ const h=window.__dbg.hero; h.x=100*16; h.y=8*16; h.inv=99999; window.__dbg.step(35); });
await page.screenshot({path:path.join(S,'fam-1-fixedzone.png')});
// stage door + family
await page.evaluate(()=>{ const h=window.__dbg.hero; h.x=226*16; h.y=8*16; window.__dbg.step(140); });
await page.screenshot({path:path.join(S,'fam-2-door.png')});
// intro curbside
await page.evaluate(()=>{ window.__dbg.state='title'; window.__dbg.step(1); window.__dbg.press.primary(); window.__dbg.step(150); });
await page.screenshot({path:path.join(S,'fam-3-intro.png')});
// intro departing
await page.evaluate(()=>{ window.__dbg.step(110); });
await page.screenshot({path:path.join(S,'fam-4-depart.png')});
// win screen
await page.evaluate(()=>{ window.__dbg.press.primary(); window.__dbg.step(5); const h=window.__dbg.hero; const L=window.__dbg.leah; h.x=L.x; h.y=L.y-16; h.inv=99999; for(let i=0;i<10;i++){window.__dbg.step(1); if(window.__dbg.state==='photo')break;} window.__dbg.step(40); window.__dbg.press.primary(); window.__dbg.step(5); });
await page.screenshot({path:path.join(S,'fam-5-win.png')});
await ctx.close(); await browser.close(); server.close();
console.log(errs.length ? 'ERRORS:\n'+errs.join('\n') : 'zero console/page errors');
