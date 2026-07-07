import { chromium, devices } from 'playwright';
import path from 'path'; import fs from 'fs'; import http from 'http';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname,'..');
const MIME={'.html':'text/html','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const fp=path.join(ROOT,p);if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));
const URL=`http://localhost:${server.address().port}/index.html`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const S=path.join(__dirname,'shots');
// portrait title
let ctx=await browser.newContext({...devices['iPhone 12'],hasTouch:true});
let page=await ctx.newPage();
await page.goto(URL,{waitUntil:'load'});
await page.waitForFunction(()=>window.ZARNA&&window.ZARNA.photoReady===true,{timeout:6000}).catch(()=>{});
await page.evaluate(()=>window.ZARNA.pause(true));
await page.screenshot({path:path.join(S,'r-title.png')});
// gameplay mid-level
await page.evaluate(()=>{window.ZARNA.setState('play');window.ZARNA.resetGame();const h=window.ZARNA.hero;h.x=56*16;h.y=window.ZARNA.phys.GROUND_Y-h.h;window.ZARNA.step(2);});
await page.screenshot({path:path.join(S,'r-play.png')});
// burst stage scene
await page.evaluate(()=>{window.ZARNA.setState('burst');window.ZARNA.step(20);});
await page.screenshot({path:path.join(S,'r-burst.png')});
// score
await page.evaluate(()=>{window.ZARNA.setState('score');});
await page.screenshot({path:path.join(S,'r-score.png')});
// gameover
await page.evaluate(()=>{window.ZARNA.setState('play');window.ZARNA.resetGame();window.ZARNA.setState('gameover');});
await page.screenshot({path:path.join(S,'r-gameover.png')});
// intro
await page.evaluate(()=>{window.ZARNA.setState('intro');});
await page.screenshot({path:path.join(S,'r-intro.png')});
await browser.close(); server.close(); console.log('shots done');
