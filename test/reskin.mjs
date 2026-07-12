import { chromium, devices } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOT = path.join(ROOT, 'test', 'shots');
fs.mkdirSync(SHOT, { recursive: true });

const MIME = { '.html':'text/html', '.webp':'image/webp', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
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

const results = [];
function check(name, cond, extra='') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ('+extra+')' : ''}`);
}
const errors = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function open(name, opts) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  page.setDefaultTimeout(15000);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__dbg, { timeout: 5000 });
  await page.waitForFunction(() => window.__dbg.photoReady === true, { timeout: 6000 }).catch(()=>{});
  await page.evaluate(() => window.__dbg.pause(true));
  await page.evaluate(() => window.__dbg.step(1));
  return { context, page };
}

/* ============ PORTRAIT full flow ============ */
const iPhone = devices['iPhone 12'];
let { context, page } = await open('portrait', { ...iPhone, hasTouch: true });

await page.screenshot({ path: path.join(SHOT, 'reskin-01-title.png') });
check('starts on title', await page.evaluate(() => window.__dbg.state === 'title'));
check('hearts start at 3', await page.evaluate(() => window.__dbg.hearts === 3),
      `hearts=${await page.evaluate(() => window.__dbg.hearts)}`);

// title -> intro
await page.evaluate(() => { window.__dbg.press.primary(); window.__dbg.step(1); });
check('title -> intro', await page.evaluate(() => window.__dbg.state === 'intro'));
await page.evaluate(() => window.__dbg.step(30));
await page.screenshot({ path: path.join(SHOT, 'reskin-02-intro.png') });

// intro -> play (skip after t>20)
await page.evaluate(() => { window.__dbg.press.primary(); window.__dbg.step(1); });
check('intro -> play', await page.evaluate(() => window.__dbg.state === 'play'));

/* idle hero y constant across 30 frames */
const ys = await page.evaluate(() => {
  window.__dbg.press.right(false);
  window.__dbg.step(20);
  const arr = [];
  for (let i = 0; i < 30; i++) { window.__dbg.step(1); arr.push(window.__dbg.hero.y); }
  return arr;
});
check('idle hero y constant across 30 frames', ys.every(v => v === ys[0]), `vals=${[...new Set(ys)].join(',')}`);

/* move right */
const move = await page.evaluate(() => {
  const x0 = window.__dbg.hero.x;
  window.__dbg.press.right(true); window.__dbg.step(50); window.__dbg.press.right(false);
  return { x0, x1: window.__dbg.hero.x };
});
check('hero moves right', move.x1 > move.x0 + 20, `dx=${(move.x1-move.x0).toFixed(1)}`);
await page.screenshot({ path: path.join(SHOT, 'reskin-03-play.png') });

/* jump rises */
const jump = await page.evaluate(() => {
  const h = window.__dbg.hero; window.__dbg.step(20); const y0 = h.y; let minY = y0;
  window.__dbg.press.jump();
  for (let i=0;i<40;i++){ window.__dbg.step(1); if (h.y<minY) minY=h.y; }
  window.__dbg.press.jumpRelease();
  return y0 - minY;
});
check('jump rises', jump > 15, `rise=${jump.toFixed(1)}`);

/* samosa in flight (fire from spawn into open ground so it can't
   instantly connect with a patrolling enemy and despawn same-tick) */
const samosa = await page.evaluate(() => {
  window.__dbg.resetRun();
  window.__dbg.state = 'play';
  const h = window.__dbg.hero;
  h.x = 2*16; h.y = 8*16; h.vx = 0; h.vy = 0; h.dir = 1;
  window.__dbg.step(10);
  window.__dbg.press.fire(true);
  window.__dbg.step(3);
  const n = window.__dbg.fireballs.length;
  window.__dbg.press.fire(false);
  return n;
});
check('samosa spawns in flight', samosa >= 1, `count=${samosa}`);
await page.screenshot({ path: path.join(SHOT, 'reskin-04-samosa.png') });

/* Super Saiyan (chai) + invincibility */
const chai = await page.evaluate(() => {
  window.__dbg.resetRun();
  window.__dbg.state = 'play';
  const h = window.__dbg.hero;
  // stand on open ground
  h.x = 5*16; h.y = 8*16; h.vx = 0; h.vy = 0;
  window.__dbg.step(10);            // settle on ground
  window.__dbg.requestWolf();
  for (let i=0;i<30 && window.__dbg.wolfT===0;i++) window.__dbg.step(1);
  const wolfActive = window.__dbg.wolfT > 0;
  const tallH = h.h;
  // overlap a live enemy for many frames; invincible => no heart loss, enemy dies
  const heartsBefore = window.__dbg.hearts;
  const e = window.__dbg.enemies.find(en => !en.dead);
  let enemyDied = false;
  if (e) {
    for (let i=0;i<20;i++){
      h.x = e.x; h.y = e.y; h.inv = 0; h.vy = 0;
      window.__dbg.step(1);
      if (e.dead) { enemyDied = true; break; }
    }
  }
  return { wolfActive, tallH, heartsBefore, heartsAfter: window.__dbg.hearts, enemyDied, wolfT: window.__dbg.wolfT };
});
check('chai triggers Super Saiyan form', chai.wolfActive, `wolfT=${chai.wolfT} h=${chai.tallH}`);
check('Super Saiyan grants invincibility (no heart loss)', chai.heartsAfter >= chai.heartsBefore,
      `${chai.heartsBefore}->${chai.heartsAfter}`);
check('Super Saiyan kills enemies on contact', chai.enemyDied);
await page.screenshot({ path: path.join(SHOT, 'reskin-05-supersaiyan.png') });

/* checkpoint */
const cp = await page.evaluate(() => {
  window.__dbg.resetRun(); window.__dbg.state = 'play';
  const h = window.__dbg.hero; const c = window.__dbg.checkpoints[0];
  h.x = c.x; h.y = 8*16; h.inv = 99999;
  window.__dbg.step(3);
  return { hit: c.hit };
});
check('checkpoint registers', cp.hit);

/* every one-way platform is within single-jump reach of the surface below it */
const reach = await page.evaluate(() => {
  // jump apex from engine constants: v^2 / 2g with JUMP_V 5.4, GRAV 0.28 => ~52px
  const APEX = (5.4 * 5.4) / (2 * 0.28);
  const g = window.__dbg.grid, COLS = g[0].length, ROWS = g.length, T = 16;
  const bad = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (g[y][x] !== '-') continue;
    // find the nearest standable surface below within a small horizontal window
    let ok = false;
    for (let xx = Math.max(0, x-2); xx <= Math.min(COLS-1, x+2) && !ok; xx++) {
      for (let yy = y+1; yy < ROWS; yy++) {
        const ch = g[yy][xx];
        if (ch === '-' || ch === '#' || ch === 'B' || ch === '?' || ch === 'D') {
          if ((yy - y) * T <= APEX + 4) ok = true;
          break;
        }
      }
    }
    if (!ok) bad.push(x + ',' + y);
  }
  return bad;
});
check('all platforms within single-jump reach', reach.length === 0, `bad=${reach.join(' ')}`);

/* SPICY mode: samosa cooldown drops while crossT active */
const spicy = await page.evaluate(() => {
  window.__dbg.resetRun(); window.__dbg.state = 'play';
  const h = window.__dbg.hero;
  h.x = 2*16; h.y = 8*16; h.vx = 0; h.vy = 0; h.dir = 1; h.inv = 99999;
  window.__dbg.step(10);
  window.__dbg.setCross(600);
  window.__dbg.press.fire(true);
  window.__dbg.step(30);
  const rapid = window.__dbg.fireballs.length;
  window.__dbg.press.fire(false);
  return rapid;
});
check('SPICY mode rapid-fires samosas (>=4 in 30 frames)', spicy >= 4, `count=${spicy}`);
await page.screenshot({ path: path.join(SHOT, 'reskin-06-checkpoint.png') });

/* forced game over on cones/spikes */
const go = await page.evaluate(() => {
  window.__dbg.resetRun(); window.__dbg.state = 'play';
  window.__dbg.score = 4200;
  window.__dbg.hearts = 1;
  const h = window.__dbg.hero;
  h.x = 84*16; h.y = 138; h.vx = 0; h.vy = 0; h.inv = 0;   // stand on the traffic cones
  for (let i=0;i<160;i++){ window.__dbg.step(1); if (window.__dbg.state==='gameover') break; }
  return { state: window.__dbg.state, score: window.__dbg.score };
});
check('reaches game over at 0 hearts', go.state === 'gameover', `state=${go.state}`);
await page.evaluate(() => window.__dbg.step(2));
await page.screenshot({ path: path.join(SHOT, 'reskin-07-gameover.png') });

/* continue keeps score, restores hearts to 3 */
const cont = await page.evaluate(() => {
  const s0 = window.__dbg.score;
  window.__dbg.press.primary(); window.__dbg.step(1);
  return { state: window.__dbg.state, hearts: window.__dbg.hearts, kept: window.__dbg.score === s0 };
});
check('continue -> play', cont.state === 'play', `state=${cont.state}`);
check('continue restores hearts to 3', cont.hearts === 3, `hearts=${cont.hearts}`);
check('continue keeps score', cont.kept);

/* reach family -> photo */
const resc = await page.evaluate(() => {
  window.__dbg.resetRun(); window.__dbg.state = 'play';
  const h = window.__dbg.hero; const L = window.__dbg.leah;
  h.x = L.x; h.y = L.y - 16; h.inv = 99999;
  for (let i=0;i<10;i++){ window.__dbg.step(1); if (window.__dbg.state==='photo') break; }
  return window.__dbg.state;
});
check('reaching family -> photo (rescue)', resc === 'photo', `state=${resc}`);
await page.evaluate(() => window.__dbg.step(20));
await page.screenshot({ path: path.join(SHOT, 'reskin-08-rescue-photo.png') });

/* photo -> win */
const win = await page.evaluate(() => {
  window.__dbg.step(35);
  window.__dbg.press.primary(); window.__dbg.step(1);
  return window.__dbg.state;
});
check('photo -> win/score', win === 'win', `state=${win}`);
await page.evaluate(() => window.__dbg.step(4));
await page.screenshot({ path: path.join(SHOT, 'reskin-09-win.png') });

/* best persisted */
const persist = await page.evaluate(() => ({
  ls: localStorage.getItem('graverunner.best'), best: window.__dbg.best
}));
check('best score persisted to localStorage', persist.ls !== null, `ls=${persist.ls} best=${persist.best}`);

/* survives reload */
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__dbg, { timeout: 5000 });
const reloaded = await page.evaluate(() => window.__dbg.best);
check('best survives page reload', reloaded >= (persist.best || 0), `best=${reloaded}`);
await context.close();

/* ============ LANDSCAPE (controls + tutorial) ============ */
{
  const c = await browser.newContext({ viewport: { width: 780, height: 360 }, hasTouch: true, isMobile: true });
  const lp = await c.newPage();
  lp.on('console', m => { if (m.type() === 'error') errors.push(`[landscape] ${m.text()}`); });
  lp.on('pageerror', e => errors.push(`[landscape] ${e.message}`));
  await lp.goto(URL, { waitUntil: 'load' });
  await lp.waitForFunction(() => !!window.__dbg, { timeout: 5000 });
  await lp.waitForFunction(() => window.__dbg.photoReady === true, { timeout: 6000 }).catch(()=>{});
  await lp.evaluate(() => window.__dbg.pause(true));
  await lp.evaluate(() => window.__dbg.step(1));
  await lp.screenshot({ path: path.join(SHOT, 'reskin-10-title-landscape.png') });
  // drive into gameplay so joystick + JUMP/FIRE + tutorial hint render
  await lp.evaluate(() => { window.__dbg.press.primary(); window.__dbg.step(1); });   // intro
  await lp.evaluate(() => window.__dbg.step(25));
  await lp.evaluate(() => { window.__dbg.press.primary(); window.__dbg.step(1); });   // play
  await lp.evaluate(() => window.__dbg.step(3));
  const tut = await lp.evaluate(() => ({ tutT: window.__dbg.tutT, state: window.__dbg.state }));
  check('landscape reaches play with tutorial hint', tut.state === 'play' && tut.tutT > 0, `tutT=${tut.tutT}`);
  await lp.screenshot({ path: path.join(SHOT, 'reskin-11-play-landscape.png') });
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
