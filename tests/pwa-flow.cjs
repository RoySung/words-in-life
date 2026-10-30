const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

(async () => {
  const root = path.resolve('dist');
  let release = 1;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    // Cloudflare's HTML canonicalization redirects index.html to the root.
    if (pathname === '/index.html') {
      res.writeHead(308, { Location: '/' }).end();
      return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    try {
      let body = await fs.readFile(file);
      if (pathname === '/sw.js' && release > 1) body = Buffer.from(body.toString().replace(/words-in-life-shell-([a-f0-9]+)/g, `words-in-life-shell-$1-r${release}`));
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = process.env.PWA_BROWSER === 'webkit'
      ? await webkit.launch({ headless: true })
      : await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => { try { localStorage.setItem('words-in-life-camera-enabled-v1', 'false'); } catch {} });
    let page = await context.newPage();
    const errors = [];
    context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const manifest = await page.evaluate(async () => (await fetch('/site.webmanifest')).json());
    assert.equal(manifest.id, '/');
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) {
      const dimensions = await page.evaluate(async src => { const img = new Image(); img.src = src; await img.decode(); return `${img.naturalWidth}x${img.naturalHeight}`; }, icon.src);
      assert.equal(dimensions, icon.sizes);
    }
    await page.evaluate(async () => { await caches.open('unrelated-cache'); });
    const cacheBefore = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('words-in-life-shell-')));
    assert.equal(cacheBefore.length, 1);
    const shell = await page.evaluate(async name => {
      const response = await (await caches.open(name)).match('/index.html');
      return { redirected: response.redirected, status: response.status };
    }, cacheBefore[0]);
    assert.equal(shell.redirected, false, 'cached shell must be safe for Safari navigation after an HTML redirect');
    assert.equal(shell.status, 200);
    const cacheUrls = await page.evaluate(async name => (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname), cacheBefore[0]);
    assert(cacheUrls.includes('/sample-images/cafe_scene.jpg'));
    assert(cacheUrls.every(url => !url.startsWith('/api') && !url.startsWith('/docs') && !url.startsWith('/social')));
    if (process.env.PWA_SHELL_ONLY === '1') {
      // Isolate document navigation from application startup and UI features.
      for (const offline of [false, true]) {
        await context.setOffline(offline);
        for (const pathname of ['/', '/index.html', '/?launch=pwa']) {
          const response = await page.goto(base + pathname, { waitUntil: 'domcontentloaded' });
          assert.equal(response.status(), 200);
          assert((await response.text()).includes('<div id="root"></div>'));
        }
      }
      console.log('PWA shell: redirected precache and controlled navigation to /, /index.html and /?launch=pwa passed online and offline.');
      return;
    }
    // Finish initial library setup before testing a subsequent offline launch.
    await page.getByRole('button', { name: /^我的單字/ }).waitFor();
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^我的單字/ }).click();
    await page.getByRole('button', { name: '切換列表檢視' }).click();
    await page.getByRole('button', { name: '查看 coffee 咖啡', exact: true }).click();
    await page.getByRole('dialog', { name: 'coffee 單字詳情' }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('dialog img')].some(img => img.complete && img.naturalWidth > 0));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '開始翻卡複習' }).click();
    await page.getByRole('button', { name: '翻卡查看解答' }).click();
    await page.getByRole('dialog').getByRole('heading', { name: 'coffee', exact: true }).waitFor();
    await page.getByRole('button', { name: '記住了', exact: true }).click();
    await page.getByRole('button', { name: '結束複習' }).click();
    await page.getByRole('button', { name: '拍攝照片', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles('public/sample-images/cafe_scene.jpg');
    await page.getByRole('alert').filter({ hasText: '目前離線，照片辨識需要網路' }).waitFor();
    await page.getByRole('button', { name: '尚未設定 API key，前往設定' }).click();
    await page.getByText('目前離線，仍可查看收藏與翻卡複習。').waitFor();
    await fs.mkdir('test-results', { recursive: true });
    for (const width of [320, 390, 844, 1440]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}px`);
      if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/pwa-settings-${width}.png`, fullPage: true });
    }
    await context.setOffline(false);
    release = 2;
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    await page.getByText(/新版已準備好/).waitFor();
    // Open clients must keep the original release even after an update is downloaded.
    assert.equal(await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('words-in-life-shell-')).length), 2);
    await page.close();
    page = await context.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(async () => {
      const names = (await caches.keys()).filter(k => k.startsWith('words-in-life-shell-'));
      return names.length === 1 && names[0].endsWith('-r2');
    });
    assert((await page.evaluate(() => caches.keys())).includes('unrelated-cache'));
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^我的單字/ }).click();
    await page.getByRole('heading', { name: /^我的單字/ }).waitFor();
    assert.equal(await page.locator('.collection-card').count(), 4);
    assert.deepEqual(errors, []);
    console.log('PWA: redirected HTML shell, manifest/icons, precache boundary, offline reload/photos/quiz, recognition guard, responsive settings, waiting update, activation, cache cleanup and collection persistence passed.');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
