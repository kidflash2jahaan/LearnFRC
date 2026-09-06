const { chromium } = require('playwright');
const OUT = '/private/tmp/claude-501/-Users-jahaan-Desktop-learnfrc/99c05c12-e43a-4096-8815-2248511a4520/scratchpad';
const URL = 'http://localhost:3000/guides/programming-software/prerequisites/variables-data-types-operators';
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h] of [['m', 390, 844], ['t', 768, 1000]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForTimeout(2500);
    const ov = await p.evaluate(() => {
      const d = document.documentElement;
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > d.clientWidth + 1 || r.left < -1)) {
          bad.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 70), left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
      return { scrollW: d.scrollWidth, clientW: d.clientWidth, offenders: bad.slice(0, 12) };
    });
    console.log(name, JSON.stringify(ov, null, 1));
    const H = await p.evaluate(() => document.body.scrollHeight);
    for (let i = 0, y = 0; y < H && i < 12; i++, y += h) {
      await p.evaluate((yy) => window.scrollTo(0, yy), y);
      await p.waitForTimeout(350);
      await p.screenshot({ path: `${OUT}/${name}-${String(i).padStart(2,'0')}.png` });
    }
    await ctx.close();
  }
  await b.close();
})();
