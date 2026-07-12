import { chromium, devices } from 'playwright';
import path from 'path'; import fs from 'fs'; import http from 'http';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.webp':'image/webp','.png':'image/png'};
const server = http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const fp=path.join(ROOT,p);if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));
const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx = await browser.newContext({...devices['iPhone 12'], hasTouch:true});
const page = await ctx.newPage();
page.on('pageerror', e=>console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:${server.address().port}/index.html`, {waitUntil:'load'});
await page.waitForFunction(()=>!!window.__dbg);
await page.evaluate(()=>{ window.__dbg.pause(true); window.__dbg.press.primary(); window.__dbg.step(2); window.__dbg.press.primary(); window.__dbg.step(30); });
// now in play at level start; step a bit so HUD settles
await page.evaluate(()=>window.__dbg.step(10));
await page.screenshot({path:path.join(__dirname,'shots','liberty-start.png')});
// walk right a bit to see it under parallax
await page.evaluate(()=>{ window.__dbg.press.right(true); window.__dbg.step(240); window.__dbg.press.right(false); window.__dbg.step(5); });
await page.screenshot({path:path.join(__dirname,'shots','liberty-mid.png')});
// photo screen fully faded in
await page.evaluate(()=>{ window.__dbg.state='photo'; window.__dbg.step(60); });
await page.screenshot({path:path.join(__dirname,'shots','photo-full.png')});
await browser.close(); server.close(); console.log('done');
