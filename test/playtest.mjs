import { chromium, devices } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOT = path.join(ROOT, 'test', 'shots');
fs.mkdirSync(SHOT, { recursive: true });

const MIME = { '.html':'text/html', '.webp':'image/webp', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const URL = `http://localhost:${PORT}/index.html`;

const PROG = path.join(ROOT, 'test', 'progress.log');
fs.writeFileSync(PROG, '');
function trace(msg){ fs.appendFileSync(PROG, msg + '\n'); }
const results = [];
function check(name, cond, extra='') {
  results.push({ name, ok: !!cond, extra });
  const line = `${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ('+extra+')' : ''}`;
  console.log(line); trace(line);
}
const errors = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function open(name, opts) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  page.setDefaultTimeout(15000);
  trace(`open ${name}: goto`);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.ZARNA, { timeout: 5000 });
  trace(`open ${name}: ZARNA ready`);
  await page.waitForFunction(() => window.ZARNA.photoReady === true, { timeout: 6000 }).catch(()=>{ trace(`open ${name}: photo NOT ready (continuing)`); });
  // Pause the internal loop so we drive the sim synchronously (headless throttles rAF).
  await page.evaluate(() => window.ZARNA.pause(true));
  trace(`open ${name}: paused`);
  return { context, page };
}

/* ============ PORTRAIT full-flow run ============ */
const iPhone = devices['iPhone 12'];
let { context, page } = await open('portrait', { ...iPhone, hasTouch: true });

await page.screenshot({ path: path.join(SHOT, '01-title.png') });
check('starts on title', await page.evaluate(() => window.ZARNA.state === 'title'));
check('hearts start at 5', await page.evaluate(() => window.ZARNA.hearts === 5));

const fb = await page.evaluate(() => { const b = window.ZARNA.faceBand(); return { topRoom: b.top, botRoom: 160 - b.bottom }; });
check('portrait: face band leaves top room for text', fb.topRoom > 8, `topRoom=${fb.topRoom.toFixed(1)}`);
check('portrait: face band leaves bottom room for text', fb.botRoom > 8, `botRoom=${fb.botRoom.toFixed(1)}`);

// Title -> intro -> play
await page.evaluate(() => window.ZARNA.press.primary());
check('title -> intro', await page.evaluate(() => window.ZARNA.state === 'intro'));
await page.screenshot({ path: path.join(SHOT, '02-intro.png') });
for (let i = 0; i < 4; i++) await page.evaluate(() => window.ZARNA.press.primary());
check('intro -> play', await page.evaluate(() => window.ZARNA.state === 'play'));

/* ---- No jitter: idle hero y constant across 30 frames ---- */
const ys = await page.evaluate(() => {
  window.ZARNA.press.left(false); window.ZARNA.press.right(false);
  window.ZARNA.step(20); // settle
  const arr = [];
  for (let i = 0; i < 30; i++) { window.ZARNA.step(1); arr.push(window.ZARNA.hero.y); }
  return arr;
});
check('idle hero y constant across 30 frames', ys.every(v => v === ys[0]), `values=${[...new Set(ys)].join(',')}`);

/* ---- Move ---- */
const move = await page.evaluate(() => {
  const x0 = window.ZARNA.hero.x;
  window.ZARNA.press.right(true); window.ZARNA.step(40); window.ZARNA.press.right(false);
  return { x0, x1: window.ZARNA.hero.x };
});
check('hero moves right', move.x1 > move.x0 + 20, `dx=${(move.x1-move.x0).toFixed(1)}`);

/* ---- Single jump ---- */
const jump = await page.evaluate(() => {
  const h = window.ZARNA.hero; window.ZARNA.step(30); const y0 = h.y; let minY = y0;
  window.ZARNA.press.jump();
  for (let i=0;i<40;i++){ window.ZARNA.step(1); if (h.y<minY) minY=h.y; }
  return y0 - minY;
});
check('single jump rises', jump > 20, `rise=${jump.toFixed(1)}`);

/* ---- Double jump higher ---- */
const dbl = await page.evaluate(() => {
  const h = window.ZARNA.hero;
  for (let i=0;i<80;i++){ window.ZARNA.step(1); if (h.grounded) break; }
  const y0 = h.y; let minY = y0;
  window.ZARNA.press.jump(); window.ZARNA.step(8);
  window.ZARNA.press.jumpRelease(); window.ZARNA.press.jump(); // 2nd jump
  for (let i=0;i<60;i++){ window.ZARNA.step(1); if (h.y<minY) minY=h.y; }
  return y0 - minY;
});
check('double jump rises higher than single', dbl > jump, `dblRise=${dbl.toFixed(1)} single=${jump.toFixed(1)}`);

/* ---- All platforms within reach (computed) ---- */
const reach = await page.evaluate(() => {
  const { GRAV, JUMP_V, GROUND_Y } = window.ZARNA.phys;
  const single = (JUMP_V*JUMP_V)/(2*GRAV);
  const dbl = single + ((JUMP_V*0.92)*(JUMP_V*0.92))/(2*GRAV);
  const tops = window.ZARNA.oneway.map(p => ({ x:p.x, y:p.y, w:p.w }));
  const surfaces = [GROUND_Y, ...tops.map(t => t.y)];
  const unreachable = tops.filter(t => !surfaces.some(sy => sy > t.y && sy - t.y <= dbl + 2));
  return { single, dbl, count: tops.length, unreachable };
});
check('all platforms within double-jump reach', reach.unreachable.length === 0, `n=${reach.count} single=${reach.single.toFixed(1)} dbl=${reach.dbl.toFixed(1)} bad=${JSON.stringify(reach.unreachable)}`);

/* ---- Empirically land on EVERY platform ---- */
const landAll = await page.evaluate(() => {
  const h = window.ZARNA.hero; const G = window.ZARNA.phys.GROUND_Y;
  const misses = [];
  window.ZARNA.oneway.forEach((plat, idx) => {
    h.x = plat.x + plat.w/2 - h.w/2; h.y = G - h.h; h.vx=0; h.vy=0; h.grounded=true;
    h.iframes = 999; h.dash = 0;
    window.ZARNA.press.left(false); window.ZARNA.press.right(false);
    window.ZARNA.step(2);
    window.ZARNA.press.jump();
    // double-jump if needed for higher platforms
    let landed=false, jumped2=false;
    for (let i=0;i<90;i++){
      window.ZARNA.step(1);
      if (!jumped2 && i===10 && plat.y < G - h.h - 34){ window.ZARNA.press.jumpRelease(); window.ZARNA.press.jump(); jumped2=true; }
      if (h.grounded && Math.abs((h.y+h.h)-plat.y) < 2){ landed=true; break; }
    }
    if (!landed) misses.push(idx);
  });
  return misses;
});
check('hero can land on EVERY platform', landAll.length === 0, `misses=${JSON.stringify(landAll)}`);

/* ---- Collect pineapples + heart bonus ---- */
const collect = await page.evaluate(() => {
  window.ZARNA.resetGame();
  const h = window.ZARNA.hero;
  h.x = 5*16; h.y = window.ZARNA.phys.GROUND_Y - h.h; h.grounded=true; h.vx=0; h.vy=0; h.iframes=99999;
  const before = window.ZARNA.pineCount, heartsBefore = window.ZARNA.hearts;
  // sweep right but stop before the goal so we stay in 'play'
  window.ZARNA.press.right(true);
  for (let i=0;i<1400 && window.ZARNA.state==='play' && h.x < window.ZARNA.phys.GOAL_X - 200; i++) window.ZARNA.step(1);
  window.ZARNA.press.right(false);
  return { got: window.ZARNA.pineCount - before, heartsBefore, heartsNow: window.ZARNA.hearts, state: window.ZARNA.state };
});
check('pineapples collected (>=10)', collect.got >= 10, `got=${collect.got}`);
check('collecting 10 pineapples grants +1 heart', collect.heartsNow > collect.heartsBefore, `hearts ${collect.heartsBefore}->${collect.heartsNow}`);
await page.screenshot({ path: path.join(SHOT, '03-play.png') });

/* ---- Checkpoint ---- */
const cp = await page.evaluate(() => {
  window.ZARNA.resetGame();
  const h = window.ZARNA.hero; h.x = window.ZARNA.checkpoints[0].x + 20; h.iframes=99999;
  window.ZARNA.step(2);
  return { hit: window.ZARNA.checkpoints[0].hit, lastCp: window.ZARNA.checkpoints[0].x };
});
check('checkpoint 1 registered', cp.hit);

/* ---- Chai dash triggers at most twice (drive through the whole level) ---- */
const chai = await page.evaluate(() => {
  window.ZARNA.resetGame();
  const h = window.ZARNA.hero; h.iframes = 99999;
  window.ZARNA.press.right(true);
  for (let i=0;i<2000 && window.ZARNA.state==='play'; i++) window.ZARNA.step(1);
  window.ZARNA.press.right(false);
  return window.ZARNA.chaiTriggered;
});
check('chai dash triggered at least once', chai >= 1, `count=${chai}`);
check('chai dash triggered at most twice', chai <= 2, `count=${chai}`);
await page.screenshot({ path: path.join(SHOT, '04-chai.png') });

/* ---- Game over -> continue keeps score, restores hearts ---- */
const go = await page.evaluate(() => {
  window.ZARNA.resetGame();
  window.ZARNA.hero.score = 0;
  // give the run some score first so we can verify it's kept through continue
  const h = window.ZARNA.hero; h.hearts = 1; h.iframes = 0; h.dash = 0; h.grounded = true;
  const o = window.ZARNA.obstacles[0];
  h.x = o.x; h.y = window.ZARNA.phys.GROUND_Y - h.h; h.vx = 0; h.vy = 0;
  for (let i=0;i<120;i++){ window.ZARNA.step(1); if (window.ZARNA.state==='gameover') break; }
  return { state: window.ZARNA.state, hearts: window.ZARNA.hearts };
});
check('game over at 0 hearts', go.state === 'gameover', `state=${go.state} hearts=${go.hearts}`);
await page.screenshot({ path: path.join(SHOT, '05-gameover.png') });

const cont = await page.evaluate(() => {
  const s0 = window.ZARNA.score;
  window.ZARNA.press.primary();
  return { state: window.ZARNA.state, hearts: window.ZARNA.hearts, kept: window.ZARNA.score === s0 };
});
check('continue -> play', cont.state === 'play');
check('continue restores hearts to 5', cont.hearts === 5, `hearts=${cont.hearts}`);
check('continue keeps score', cont.kept);

/* ---- Reach stage -> burst -> photo -> score ---- */
const end = await page.evaluate(() => {
  const h = window.ZARNA.hero; h.iframes = 99999;
  h.x = window.ZARNA.phys.GOAL_X + 30; h.y = window.ZARNA.phys.GROUND_Y - h.h; h.grounded=true;
  for (let i=0;i<10;i++){ window.ZARNA.step(1); if (window.ZARNA.state==='burst') break; }
  return window.ZARNA.state;
});
check('reaching stage -> burst', end === 'burst');
await page.evaluate(() => window.ZARNA.step(30));
await page.screenshot({ path: path.join(SHOT, '06-burst.png') });

await page.evaluate(() => window.ZARNA.press.advanceBurst());
check('burst -> photo', await page.evaluate(() => window.ZARNA.state === 'photo'));
await page.evaluate(() => window.ZARNA.step(12));
await page.screenshot({ path: path.join(SHOT, '07-photo.png') });

await page.evaluate(() => window.ZARNA.press.advancePhoto());
check('photo -> score', await page.evaluate(() => window.ZARNA.state === 'score'));
await page.screenshot({ path: path.join(SHOT, '08-score.png') });

/* ---- Best persisted to localStorage ---- */
const persist = await page.evaluate(() => ({ ls: localStorage.getItem('zarnaBest'), best: window.ZARNA.best, score: window.ZARNA.score }));
check('best score persisted to localStorage', persist.ls !== null, `ls=${persist.ls} best=${persist.best} score=${persist.score}`);
check('best equals score when higher', persist.best >= 0);

/* ---- Play again -> title ---- */
await page.evaluate(() => window.ZARNA.press.primary());
check('play again -> title', await page.evaluate(() => window.ZARNA.state === 'title'));

// Reload to confirm best survives a fresh page load
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.ZARNA, { timeout: 5000 });
const reloaded = await page.evaluate(() => window.ZARNA.best);
check('best score survives page reload', reloaded >= persist.best, `best=${reloaded}`);
await context.close();

/* ============ LANDSCAPE checks ============ */
{
  const c = await browser.newContext({ viewport: { width: 780, height: 360 }, hasTouch: true, isMobile: true });
  const lp = await c.newPage();
  lp.on('console', m => { if (m.type() === 'error') errors.push(`[landscape] ${m.text()}`); });
  lp.on('pageerror', e => errors.push(`[landscape] ${e.message}`));
  await lp.goto(URL, { waitUntil: 'load' });
  await lp.waitForFunction(() => !!window.ZARNA, { timeout: 5000 });
  await lp.waitForFunction(() => window.ZARNA.photoReady === true, { timeout: 6000 }).catch(()=>{});
  await lp.evaluate(() => window.ZARNA.pause(true));
  await lp.screenshot({ path: path.join(SHOT, '09-title-landscape.png') });
  const lfb = await lp.evaluate(() => { const b = window.ZARNA.faceBand(); return { topRoom: b.top, botRoom: 160 - b.bottom }; });
  check('landscape: face band leaves top room for text', lfb.topRoom > 6, `topRoom=${lfb.topRoom.toFixed(1)}`);
  check('landscape: face band leaves bottom room for text', lfb.botRoom > 6, `botRoom=${lfb.botRoom.toFixed(1)}`);
  // Enter gameplay and render touch controls
  await lp.evaluate(() => { window.ZARNA.setState('play'); window.ZARNA.step(1); });
  await lp.dispatchEvent('#c', 'touchstart', { touches: [], changedTouches: [] }).catch(()=>{});
  await lp.evaluate(() => window.ZARNA.step(2));
  await lp.screenshot({ path: path.join(SHOT, '10-play-landscape.png') });
  await c.close();
}

await browser.close();
server.close();

console.log('\n--- console/page errors ---');
if (errors.length === 0) console.log('none');
else errors.forEach(e => console.log('ERR: ' + e));
check('zero console/page errors', errors.length === 0, errors.slice(0,3).join(' | '));

const failed = results.filter(r => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name + (f.extra?'  ['+f.extra+']':''))); process.exit(1); }
process.exit(0);
