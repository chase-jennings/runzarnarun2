import { chromium } from 'playwright';
import path from 'path'; import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseFont = {
 'S':".##\n#..\n.#.\n..#\n##.",'H':"#.#\n#.#\n###\n#.#\n#.#",'O':".#.\n#.#\n#.#\n#.#\n.#.",
 'W':"#.#\n#.#\n###\n###\n#.#",'T':"###\n.#.\n.#.\n.#.\n.#.",'I':"###\n.#.\n.#.\n.#.\n###",
 'E':"###\n#..\n##.\n#..\n###",'N':"#.#\n##.\n###\n.##\n#.#",'C':".##\n#..\n#..\n#..\n.##",
 'A':".#.\n#.#\n###\n#.#\n#.#",'D':"##.\n#.#\n#.#\n#.#\n##.",'U':"#.#\n#.#\n#.#\n#.#\n###",
 'R':"##.\n#.#\n##.\n#.#\n#.#",'Z':"###\n..#\n.#.\n#..\n###",' ':"...\n...\n...\n...\n...",
};
const Mopts = {
  'M1':"#.#\n###\n#.#\n#.#\n#.#",
  'M2':"#.#\n###\n###\n#.#\n#.#",
  'M3':"#.#\n#.#\n###\n#.#\n#.#".replace('###\n#.#\n#.#','#.#\n#.#\n#.#'), // placeholder
  'M4':"#.#\n###\n#.#\n###\n#.#",
  'M5':"#.#\n#.#\n#.#\n#.#\n#.#",
  'M6':"###\n#.#\n#.#\n#.#\n#.#",
};
// A genuinely M-like design attempt with inner peaks using 5 cols is impossible in 3; try "hollow top"
Mopts['M7'] = "#.#\n###\n#.#\n#.#\n#.#"; // same as M1 for ref

const words = ['SHOWTIME','MIC','MADE','ZARNA','RUN','MINUTES'.replace('MINUTES','MINUTE')];
function draw(ctx, str, font, x, y, sc){
  for(let i=0;i<str.length;i++){
    const g=(font[str[i]]||"...\n...\n...\n...\n...").split('\n');
    for(let r=0;r<5;r++)for(let c=0;c<3;c++) if(g[r][c]==='#') ctx.fillRect(x+i*(3*sc+sc)+c*sc, y+r*sc, sc, sc);
  }
}
const html=`<!doctype html><body style=background:#123><canvas id=c width=900 height=700></canvas><script>
const base=${JSON.stringify(baseFont)}, Mo=${JSON.stringify(Mopts)}, words=${JSON.stringify(words)};
const ctx=document.getElementById('c').getContext('2d');ctx.imageSmoothingEnabled=false;
function draw(str,font,x,y,sc){for(let i=0;i<str.length;i++){const g=(font[str[i]]||'...\\n...\\n...\\n...\\n...').split('\\n');for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(g[r][c]==='#')ctx.fillRect(x+i*(3*sc+sc)+c*sc,y+r*sc,sc,sc);}}
let y=20;
for(const mk in Mo){
  const font=Object.assign({},base,{M:Mo[mk]});
  ctx.fillStyle='#7ff';ctx.font='14px monospace';ctx.fillText(mk,10,y+18);
  ctx.fillStyle='#fff';
  draw('SHOWTIME',font,90,y,3);
  draw('MIC MADE',font,90,y+22,3);
  y+=64;
}
window.done=1;
</script></body>`;
const fp=path.join(__dirname,'wordproof.html'); fs.writeFileSync(fp,html);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage(); await p.goto('file://'+fp); await p.waitForFunction(()=>window.done);
await p.screenshot({path:path.join(__dirname,'shots','wordproof.png')}); await b.close(); console.log('ok');
