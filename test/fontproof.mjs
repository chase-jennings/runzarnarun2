import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Candidate glyphs to compare, drawn large.
const cands = {
  'M_a': "#.#\n###\n###\n#.#\n#.#",
  'M_b': "#.#\n###\n#.#\n#.#\n#.#",
  'M_c': "#.#\n###\n#.#\n#.#\n#.#".replace('#.#','#.#'),
  'M_d': "###\n###\n#.#\n#.#\n#.#",
  'M_e': "#.#\n###\n###\n###\n#.#",
  'N_a': "#.#\n##.\n#.#\n#.#\n#.#",
  'N_b': "##.\n#.#\n#.#\n#.#\n#.#",
  'N_c': "#.#\n#.#\n###\n#.#\n#.#",  // this is H really
  'N_d': "#.#\n##.\n#.#\n.##\n#.#",
  'N_e': "##.\n#.#\n#.#\n#.#\n..#".replace('..#','.##'),
  'N_f': "#.#\n##.\n###\n.##\n#.#",
  'K_ref': "#.#\n#.#\n##.\n#.#\n#.#",
  'H_ref': "#.#\n#.#\n###\n#.#\n#.#",
};
const html = `<!doctype html><body style="background:#222"><canvas id=c width=600 height=400></canvas>
<script>
const cands=${JSON.stringify(cands)};
const ctx=document.getElementById('c').getContext('2d');
ctx.imageSmoothingEnabled=false;
ctx.fillStyle='#fff';
const sc=8; let i=0;
for(const k in cands){
  const rows=cands[k].split('\\n');
  const ox=(i%4)*150+20, oy=Math.floor(i/4)*90+30;
  ctx.fillStyle='#8ff'; ctx.font='12px monospace'; ctx.fillText(k, ox, oy-6);
  ctx.fillStyle='#fff';
  for(let y=0;y<5;y++)for(let x=0;x<3;x++) if(rows[y][x]==='#') ctx.fillRect(ox+x*sc,oy+y*sc,sc,sc);
  i++;
}
window.done=true;
</script></body>`;
import fs from 'fs';
const fp = path.join(__dirname,'fontproof.html');
fs.writeFileSync(fp, html);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto('file://'+fp);
await page.waitForFunction(()=>window.done);
await page.screenshot({ path: path.join(__dirname,'shots','fontproof.png') });
await browser.close();
console.log('done');
