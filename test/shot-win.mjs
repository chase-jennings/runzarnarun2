import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import http from 'http';
const root = process.cwd();
const srv = http.createServer((req,res)=>{
  const f = path.join(root, req.url.split('?')[0].replace(/^\//,'') || 'index.html');
  try { res.end(fs.readFileSync(f)); } catch(e){ res.statusCode=404; res.end(); }
}).listen(8903);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [name, viewport, dsf] of [
  ['win-portrait', {width:390, height:844}, 3],
  ['win-desktop',  {width:1440,height:900}, 2],
]) {
  const p = await b.newPage({ viewport, deviceScaleFactor:dsf, hasTouch:true });
  await p.goto('http://127.0.0.1:8903/index.html');
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    window.__dbg.pause(true);
    window.__dbg.resetRun(); window.__dbg.state = 'play';
    window.__dbg.score = 11850; window.__dbg.hearts = 3;
    window.__dbg.killBoss();
    const h = window.__dbg.hero, L = window.__dbg.leah;
    h.x = L.x; h.y = L.y - 16; h.inv = 99999;
    for (let i=0;i<12;i++){ window.__dbg.step(1); if (window.__dbg.state==='photo') break; }
    window.__dbg.step(40);
    window.__dbg.press.primary(); window.__dbg.step(1);   // photo -> win
    // land on a blink-on frame so the prompt shows
    for (let i=0;i<40;i++){ window.__dbg.step(1); if ((window.__dbg.frame>>5)&1) break; }
  });
  await p.waitForTimeout(80);
  await p.screenshot({ path: `test/shots/${name}.png` });
  await p.close();
}
await b.close(); srv.close();
console.log('done');
