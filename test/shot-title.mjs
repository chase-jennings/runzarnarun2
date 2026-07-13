import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
import http from 'http';
const root = process.cwd();
const srv = http.createServer((req,res)=>{
  const f = path.join(root, req.url.split('?')[0].replace(/^\//,'') || 'index.html');
  try { res.end(fs.readFileSync(f)); } catch(e){ res.statusCode=404; res.end(); }
}).listen(8901);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3, hasTouch:true });
await p.goto('http://127.0.0.1:8901/index.html');
await p.waitForTimeout(900);
await p.screenshot({ path: 'test/shots/title-hires.png' });
// photo screen
await p.evaluate(() => { window.__dbg.pause(true); window.__dbg.resetRun(); window.__dbg.state='photo'; for(let i=0;i<50;i++) window.__dbg.step(1); });
await p.waitForTimeout(100);
await p.screenshot({ path: 'test/shots/photo-hires.png' });
await b.close(); srv.close();
console.log('done');
