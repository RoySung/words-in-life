const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const cases = [
      ['different-field-of-view', 900, 1200], ['capture-reconfigures-stream', 1600, 900],
      ['capture-throws', 1200, 1200], ['unsupported', 900, 1600],
      ['high-resolution-preview', 1920, 2560], ['capped-preview', 3600, 4800],
    ];
    for (const [mode, width, height] of cases) {
      for (const zoom of [1, 2]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(({ mode, width, height, zoom }) => {
          localStorage.setItem('words-in-life-gemini-key-v1', 'test-key');
          window.photoCalls = 0;
          window.cameraRequests = 0;
          window.liveTracks = [];
          navigator.mediaDevices.getUserMedia = async options => {
            window.cameraRequests++;
            window.cameraOptions = options;
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e8dac5'; ctx.fillRect(0, 0, width, height);
            const w = Math.min(width, height * 3 / 4) / zoom, h = w * 4 / 3;
            const x = (width - w) / 2, y = (height - h) / 2;
            ctx.fillStyle = '#ff0000'; ctx.fillRect(x, y, 60, h);
            ctx.fillStyle = '#0000ff'; ctx.fillRect(x + w - 60, y, 60, h);
            ctx.fillStyle = '#00ff00'; ctx.fillRect(x, y, w, 60);
            ctx.fillStyle = '#ffff00'; ctx.fillRect(x, y + h - 60, w, 60);
            window.changePreview = () => { ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, width, height); };
            const stream = canvas.captureStream(10);
            window.liveTracks.push(...stream.getTracks());
            return stream;
          };
          Object.defineProperty(window, 'ImageCapture', { configurable: true, value: mode === 'unsupported' ? undefined : class {
            async takePhoto() {
              window.photoCalls++;
              if (mode === 'capture-throws') throw new Error('capture unsupported');
              // Real devices can change the live view and expose a wider still-photo view.
              if (mode === 'capture-reconfigures-stream') window.changePreview();
              const canvas = document.createElement('canvas'); canvas.width = 3600; canvas.height = 4800;
              const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 3600, 4800);
              return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .98));
            }
          } });
        }, { mode, width, height, zoom });
        let uploaded;
        let uploads = 0;
        await page.route('https://generativelanguage.googleapis.com/**', route => {
          uploads++;
          uploaded = route.request().postDataJSON().contents[0].parts.find(part => part.inlineData).inlineData;
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ isRecognizable: false, unrecognizableReason: '取景一致測試', items: [] }) }] } }],
          }) });
        });
        await page.goto(baseURL);
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
        assert.equal(await page.evaluate(() => window.cameraOptions.video.height.ideal), 2560);
        if (zoom === 2) await page.getByRole('button', { name: '目前 1 倍，切換至 2 倍' }).click();
        assert.equal(await page.evaluate(() => window.cameraRequests), 1, 'zoom must not restart the camera');
        await page.getByRole('button', { name: '拍攝照片', exact: true }).evaluate(button => { button.click(); button.click(); });
        await page.getByRole('heading', { name: '取景一致測試' }).waitFor();
        const source = await page.locator('.failure-page .vs-polaroid img').getAttribute('src');
        const images = await page.evaluate(async ({ source, uploaded }) => {
          const inspect = async source => {
            const img = new Image(); img.src = source; await img.decode();
            const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
            const w = canvas.width, h = canvas.height;
            return { width: w, height: h, edges: [[10, h / 2], [w - 10, h / 2], [w / 2, 10], [w / 2, h - 10]]
              .map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3)) };
          };
          return [await inspect(source), await inspect(`data:${uploaded.mimeType};base64,${uploaded.data}`)];
        }, { source, uploaded });
        const expectedWidth = Math.round(Math.min(Math.min(width, height * 3 / 4) / zoom, 4096 * 3 / 4));
        assert.equal(images[0].width, expectedWidth, `${mode}: capture must use the preview source, not a different camera view`);
        assert.equal(images[0].height, Math.round(Math.min(Math.min(height, width * 4 / 3) / zoom, 4096)));
        for (const image of images) {
          const colors = [[255, 0, 0], [0, 0, 255], [0, 255, 0], [255, 255, 0]];
          image.edges.forEach((pixel, i) => pixel.forEach((channel, c) => assert.ok(Math.abs(channel - colors[i][c]) < 15, `${mode} ${zoom}x: photo and AI upload must match viewfinder edges`)));
        }
        assert.equal(await page.evaluate(() => window.photoCalls), 0, 'shutter must never reconfigure camera through takePhoto');
        assert.equal(uploads, 1, 'double shutter must submit only once');
        assert.equal(await page.evaluate(() => window.liveTracks.every(track => track.readyState === 'ended')), true);
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`${mode} ${zoom}x: preview framing, capture/upload pixels, no mode switch and duplicate protection passed`);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
