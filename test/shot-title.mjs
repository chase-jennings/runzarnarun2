import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import http from 'http';
const root = process.cwd();
const srv = http.createServer((req,res)=>{
  const f = path.join(root, req.url.split('?')[0].replace(/^\//,'') || 'index.html');
  try { res.end(fs.readFileSync(f)); } catch(e){ res.statusCode=404; res.end(); }
}).listen(8901);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const shots = [
  ['title-portrait',  {width:390, height:844},  3],
  ['title-landscape', {width:844, height:390},  3],
  ['title-desktop',   {width:1440,height:900},  2],
];
for (const [name, viewport, dsf] of shots) {
  const p = await b.newPage({ viewport, deviceScaleFactor: dsf, hasTouch:true });
  await p.goto('http://127.0.0.1:8901/index.html');
  await p.waitForTimeout(700);
  await p.screenshot({ path: `test/shots/${name}.png` });
  await p.close();
}
// ending photo (desktop) for good measure
const pe = await b.newPage({ viewport:{width:1440,height:900}, deviceScaleFactor:2, hasTouch:true });
await pe.goto('http://127.0.0.1:8901/index.html');
await pe.waitForTimeout(500);
await pe.evaluate(() => { window.__dbg.pause(true); window.__dbg.resetRun(); window.__dbg.state='photo'; for(let i=0;i<50;i++) window.__dbg.step(1); });
await pe.waitForTimeout(80);
await pe.screenshot({ path: 'test/shots/photo-desktop.png' });
await pe.close();
await b.close(); srv.close();
console.log('done');
