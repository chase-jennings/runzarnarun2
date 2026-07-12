import { chromium, devices } from 'playwright';
import path from 'path'; import fs from 'fs'; import http from 'http';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.webp':'image/webp','.png':'image/png'};
const server = http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const fp=path.join(ROOT,p);if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));
const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const S = path.join(__dirname,'shots'); const errs=[];
const ctx = await browser.newContext({...devices['iPhone 12'], hasTouch:true});
const page = await ctx.newPage();
page.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
page.on('pageerror', e=>errs.push(e.message));
await page.goto(`http://localhost:${server.address().port}/index.html`, {waitUntil:'load'});
await page.waitForFunction(()=>!!window.__dbg);
await page.evaluate(()=>{ window.__dbg.pause(true); window.__dbg.press.primary(); window.__dbg.step(30); window.__dbg.press.primary(); window.__dbg.step(5); });
// approach boss: full HP, arms crossed
await page.evaluate(()=>{ const h=window.__dbg.hero, b=window.__dbg.boss; h.x=b.x-70; h.y=b.y+20; h.inv=99999; window.__dbg.step(30); });
await page.screenshot({path:path.join(S,'boss-1-intro.png')});
// mid-fight: shoot ~8 times, redder, wristband likely in air
await page.evaluate(()=>{ const b=window.__dbg.boss; while(b.hp>7){ window.__dbg.press.fire(true); window.__dbg.step(1); window.__dbg.press.fire(false); window.__dbg.step(1);} window.__dbg.step(6); });
await page.screenshot({path:path.join(S,'boss-2-midfight.png')});
// force a wristband in the air for the shot
await page.evaluate(()=>{ const b=window.__dbg.boss; b.throwCd=0; b.windup=0; for(let i=0;i<40 && window.__dbg.bossShots.length===0;i++) window.__dbg.step(1); });
await page.screenshot({path:path.join(S,'boss-3-wristband.png')});
// defeat + family appears
await page.evaluate(()=>{ window.__dbg.killBoss(); window.__dbg.step(30); });
await page.screenshot({path:path.join(S,'boss-4-defeated.png')});
// run to family / photo
await page.evaluate(()=>{ const h=window.__dbg.hero, L=window.__dbg.leah; h.x=L.x; h.y=L.y-16; for(let i=0;i<10;i++){window.__dbg.step(1); if(window.__dbg.state==='photo')break;} window.__dbg.step(30); });
await page.screenshot({path:path.join(S,'boss-5-photo.png')});
await ctx.close(); await browser.close(); server.close();
console.log(errs.length ? 'ERRORS:\n'+errs.join('\n') : 'zero console/page errors');
