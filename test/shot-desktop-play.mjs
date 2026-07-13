import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import http from 'http';
const root = process.cwd();
const srv = http.createServer((req,res)=>{
  const f = path.join(root, req.url.split('?')[0].replace(/^\//,'') || 'index.html');
  try { res.end(fs.readFileSync(f)); } catch(e){ res.statusCode=404; res.end(); }
}).listen(8902);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
await p.goto('http://127.0.0.1:8902/index.html');
await p.waitForTimeout(500);
await p.evaluate(() => {
  window.__dbg.pause(true);
  window.__dbg.resetRun(); window.__dbg.state = 'play';
  const h = window.__dbg.hero;
  h.x = 40*16; h.y = 3*16; h.vx = 0; h.vy = 0; h.inv = 99999;   // high platform area
  window.__dbg.step(40);
});
await p.screenshot({ path: 'test/shots/desktop-play-high.png' });
await b.close(); srv.close();
console.log('done');
