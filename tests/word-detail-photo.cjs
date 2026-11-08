const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseURL}/design-system/preview?screen=detail`);
    await page.getByRole('button', { name: '關閉單字詳情', exact: true }).click();
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: { flushSync } } = await import('/node_modules/.vite/deps/react-dom.js');
      const { WordDetailModal } = await import('/src/components/WordDetailModal.tsx');
      const { createPhotoUrls } = await import('/src/repository/photos.ts');
      const { SAMPLE_SCENES } = await import('/src/data/sampleScenes.ts');
      const original = document.createElement('canvas'); original.width = 1600; original.height = 1200;
      const context = original.getContext('2d'); context.fillStyle = '#00ff00'; context.fillRect(0, 0, 1600, 1200);
      for (let x = 400; x < 1200; x += 2) {
        context.fillStyle = x % 4 === 0 ? '#000' : '#fff'; context.fillRect(x, 300, 2, 600);
      }
      const thumbnail = document.createElement('canvas'); thumbnail.width = thumbnail.height = 280;
      const thumb = thumbnail.getContext('2d'); thumb.fillStyle = '#ff0000'; thumb.fillRect(0, 0, 280, 280);
      const blue = document.createElement('canvas'); blue.width = 1600; blue.height = 1200;
      const blueContext = blue.getContext('2d'); blueContext.fillStyle = '#0000ff'; blueContext.fillRect(0, 0, 1600, 1200);
      window.original = original.toDataURL(); window.thumbnail = thumbnail.toDataURL(); window.blue = blue.toDataURL();
      const bytes = new Uint8Array(await (await fetch(window.original)).arrayBuffer());
      window.reads = [];
      const urls = createPhotoUrls({ readPhoto: async id => {
        window.reads.push(id);
        if (id === 'missing') throw new Error('missing original');
        if (id === 'delayed') await new Promise(resolve => { window.releaseOriginal = resolve; });
        return { bytes, mimeType: 'image/png' };
      } });
      const host = document.createElement('div'); host.className = 'vs-theme words-in-life-app detail-photo-fixture';
      document.getElementById('root').style.display = 'none'; document.body.append(host);
      const root = createRoot(host);
      window.renderDetail = mode => {
        const item = { ...SAMPLE_SCENES[0].items[0], id: 'same-word', stickerUrl: window.thumbnail,
          originalImageUrl: window.original, boundingBox: { left: 25, top: 25, right: 75, bottom: 75 } };
        if (mode === 'legacy') delete item.boundingBox;
        if (mode === 'missing') { item.photo = { kind: 'stored', photoId: 'missing' }; delete item.originalImageUrl; }
        if (mode === 'stored' || mode === 'delayed') { item.photo = { kind: 'stored', photoId: mode === 'stored' ? 'original' : 'delayed' }; delete item.originalImageUrl; }
        if (mode === 'blue') item.originalImageUrl = window.blue;
        flushSync(() => root.render(React.createElement(WordDetailModal, { item, photoUrls: urls, isSaved: false, onClose() {}, onToggleSave() {} })));
      };
    });
    const image = page.locator('.detail-photo-fixture .detail-polaroid > img');
    const inspect = () => image.evaluate(async img => {
      await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
      const w = canvas.width, h = canvas.height;
      const row = context.getImageData(0, h / 2, w, 1).data;
      let transitions = 0;
      for (let x = 200; x < w - 200; x++) if (Math.abs(row[x * 4] - row[(x - 1) * 4]) > 80) transitions++;
      return { width: w, height: h, transitions, padding: [...context.getImageData(w / 2, 0, 1, 1).data], center: [...context.getImageData(w / 2, h / 2, 1, 1).data] };
    });
    for (const mode of ['original', 'stored']) {
      await page.evaluate(mode => window.renderDetail(mode), mode);
      await page.waitForFunction(() => document.querySelector('.detail-photo-fixture .detail-polaroid img')?.naturalWidth === 1200);
      const info = await inspect();
      assert.equal(info.width, 1200); assert.equal(info.height, 1200);
      assert(info.transitions > 300, 'detail must retain fine original detail rather than enlarge a thumbnail');
      assert.deepEqual(info.padding, [255, 249, 239, 255], 'keep the same object framing and padding');
    }
    assert.deepEqual(await page.evaluate(() => window.reads), ['original']);
    for (const mode of ['missing', 'legacy']) {
      await page.evaluate(mode => window.renderDetail(mode), mode);
      await page.waitForFunction(() => document.querySelector('.detail-photo-fixture .detail-polaroid img')?.naturalWidth === 280);
      const info = await inspect();
      assert.deepEqual(info.center, [255, 0, 0, 255], 'missing originals and old records keep their existing crop');
    }
    await page.evaluate(() => window.renderDetail('delayed'));
    await page.waitForFunction(() => !!window.releaseOriginal);
    await page.evaluate(() => window.renderDetail('blue'));
    await page.waitForFunction(() => document.querySelector('.detail-photo-fixture .detail-polaroid img')?.naturalWidth === 1200);
    await page.evaluate(() => window.releaseOriginal());
    await page.waitForTimeout(150);
    assert.deepEqual((await inspect()).center, [0, 0, 255, 255], 'a late original must not replace a newer word/source');
    // Keep the origin image node stable if an original finishes while its share dialog is open.
    await page.evaluate(() => { window.releaseOriginal = undefined; window.renderDetail('delayed'); });
    await page.waitForFunction(() => !!window.releaseOriginal);
    await image.evaluate(img => { window.shareOrigin = img; });
    await page.locator('.detail-photo-fixture').getByRole('button', { name: '分享單字', exact: true }).click();
    await page.getByRole('dialog', { name: '分享單字', exact: true }).waitFor();
    await page.evaluate(() => window.releaseOriginal());
    await page.waitForTimeout(150);
    assert(await image.evaluate(img => img === window.shareOrigin), 'photo upgrades must not detach an active share animation origin');
    await page.getByRole('button', { name: '關閉分享', exact: true }).click();
    await page.getByRole('dialog', { name: '分享單字', exact: true }).waitFor({ state: 'detached' });
    await page.evaluate(() => window.renderDetail('original'));
    await page.waitForFunction(() => document.querySelector('.detail-photo-fixture .detail-polaroid img')?.naturalWidth === 1200);
    const output = process.env.TEST_OUTPUT_DIR || 'test-results'; fs.mkdirSync(output, { recursive: true });
    for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }]]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `word-detail-high-resolution-${name}.png`) });
    }
    assert.deepEqual(errors, []);
    console.log('Detail photo: original/stored fine detail, crop geometry, legacy/missing fallback, stale result, share origin and responsive layout passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
