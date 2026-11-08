const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const cases = [
      ['landscape', 3200, 2400, 1], ['portrait', 2400, 3200, 1], ['square', 2400, 2400, 2], ['capped', 3600, 4800, 1],
      ['unsupported', 3200, 2400, 1], ['constructor-error', 3200, 2400, 1],
      ['rejected', 3200, 2400, 2], ['invalid', 3200, 2400, 1],
      ['timeout', 3200, 2400, 1], ['smaller', 300, 400, 1], ['cancel', 3200, 2400, 1], ['cancel-navigation', 3200, 2400, 1],
    ];
    for (const [mode, width, height, zoom] of cases) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ mode, width, height, zoom }) => {
        localStorage.setItem('words-in-life-gemini-key-v1', 'test-key');
        window.photoCalls = 0;
        window.liveTracks = [];
        window.createdPhotoUrls = [];
        window.revokedPhotoUrls = [];
        const createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = createURL(blob); window.createdPhotoUrls.push(url); return url; };
        URL.revokeObjectURL = url => { window.revokedPhotoUrls.push(url); revokeURL(url); };
        navigator.mediaDevices.getUserMedia = async options => {
          window.cameraOptions = options;
          const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1200;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e8dac5'; ctx.fillRect(0, 0, 900, 1200);
          window.changePreview = () => { ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 900, 1200); };
          const stream = canvas.captureStream(10);
          window.liveTracks.push(...stream.getTracks());
          return stream;
        };
        Object.defineProperty(window, 'ImageCapture', { configurable: true, value: mode === 'unsupported' ? undefined : class {
          constructor(track) {
            if (mode === 'constructor-error') throw new Error('unsupported');
            if (track !== window.liveTracks.at(-1)) throw new Error('wrong camera track');
          }
          async takePhoto() {
            window.photoCalls++;
            if (mode === 'rejected') throw new Error('capture failed');
            if (mode === 'timeout' || mode.startsWith('cancel')) return new Promise(resolve => { window.releasePhoto = resolve; });
            if (mode === 'invalid') return new Blob(['invalid photo'], { type: 'image/jpeg' });
            await new Promise(resolve => setTimeout(resolve, 100));
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e8dac5'; ctx.fillRect(0, 0, width, height);
            const w = Math.min(width, height * 3 / 4) / zoom, h = w * 4 / 3;
            const x = (width - w) / 2, y = (height - h) / 2;
            ctx.fillStyle = '#ff0000'; ctx.fillRect(x, y, 40, h);
            ctx.fillStyle = '#0000ff'; ctx.fillRect(x + w - 40, y, 40, h);
            ctx.fillStyle = '#00ff00'; ctx.fillRect(x, y, w, 40);
            ctx.fillStyle = '#ffff00'; ctx.fillRect(x, y + h - 40, w, 40);
            return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .98));
          }
        } });
      }, { mode, width, height, zoom });
      let uploads = 0;
      await page.route('https://generativelanguage.googleapis.com/**', route => {
        uploads++;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ isRecognizable: false, unrecognizableReason: '高畫質測試', items: [] }) }] } }],
        }) });
      });
      await page.goto(baseURL);
      await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
      assert.equal(await page.evaluate(() => window.cameraOptions.video.height.ideal), 2560);
      if (zoom === 2) await page.getByRole('button', { name: '目前 1 倍，切換至 2 倍' }).click();
      // Two events in the same turn exercise the lock before React can disable the shutter.
      await page.getByRole('button', { name: '拍攝照片', exact: true }).evaluate(button => { button.click(); button.click(); });
      if (mode === 'timeout') {
        await page.waitForFunction(() => window.photoCalls === 1);
        assert(await page.getByRole('button', { name: '拍攝照片', exact: true }).isDisabled());
        assert(await page.getByRole('button', { name: /^目前 1 倍/ }).isDisabled());
        await page.evaluate(() => window.changePreview());
      }
      if (mode.startsWith('cancel')) {
        await page.waitForFunction(() => window.photoCalls === 1);
        if (mode === 'cancel') {
          await page.getByRole('switch', { name: '鏡頭', exact: true }).click();
          await page.getByText('鏡頭已暫時關閉').waitFor();
        } else {
          await page.getByRole('button', { name: /^我的單字/ }).click();
          await page.waitForFunction(() => window.liveTracks.every(track => track.readyState === 'ended'));
        }
        await page.evaluate(() => window.releasePhoto(new Blob(['late result'])));
        await page.waitForTimeout(200);
        assert.equal(uploads, 0, 'closing the camera must discard a pending photo');
        if (mode === 'cancel') await page.getByRole('switch', { name: '鏡頭', exact: true }).click();
        else await page.getByRole('button', { name: '拍攝照片', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
        assert(await page.getByRole('button', { name: '拍攝照片', exact: true }).isEnabled());
      } else {
        await page.getByRole('heading', { name: '高畫質測試' }).waitFor();
        const info = await page.locator('.failure-page .vs-polaroid img').evaluate(async img => {
          await img.decode();
          const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
          const w = canvas.width, h = canvas.height;
          return { width: w, height: h, edges: [[10, h / 2], [w - 10, h / 2], [w / 2, 10], [w / 2, h - 10]]
            .map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3)) };
        });
        const native = ['landscape', 'portrait', 'square', 'capped'].includes(mode);
        const expectedWidth = native ? Math.min(Math.min(width, height * 3 / 4) / zoom, 4096 * 3 / 4) : 900 / zoom;
        assert.equal(info.width, expectedWidth, mode);
        assert.equal(info.height, expectedWidth * 4 / 3, mode);
        const colors = native ? [[255, 0, 0], [0, 0, 255], [0, 255, 0], [255, 255, 0]] : Array(4).fill([232, 218, 197]);
        info.edges.forEach((pixel, i) => pixel.forEach((channel, c) => assert.ok(Math.abs(channel - colors[i][c]) < 15, `${mode}: centered crop colors`)));
        assert.equal(uploads, 1, 'double shutter must submit only once');
        assert.equal(await page.evaluate(() => window.liveTracks.every(track => track.readyState === 'ended')), true);
        assert.equal(await page.evaluate(() => window.createdPhotoUrls.every(url => window.revokedPhotoUrls.includes(url))), true, 'photo decoding URLs must be released');
        if (mode === 'timeout') {
          await page.evaluate(() => window.releasePhoto(new Blob(['late result'])));
          await page.waitForTimeout(100);
          assert.equal(uploads, 1, 'late photo must not trigger another submission');
        }
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${mode} ${zoom}x: passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
