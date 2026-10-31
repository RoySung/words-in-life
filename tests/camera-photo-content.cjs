const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';
const out = path.resolve(process.env.TEST_OUTPUT_DIR || 'test-results');

// Compute how much of the source survives the browser's replaced-element layout.
function visibleSource(element) {
  const style = getComputedStyle(element);
  const width = parseFloat(style.width), height = parseFloat(style.height);
  const sourceWidth = element.videoWidth || element.naturalWidth;
  const sourceHeight = element.videoHeight || element.naturalHeight;
  const scale = style.objectFit === 'cover' ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight);
  return {
    x: Math.min(1, width / (sourceWidth * scale)),
    y: Math.min(1, height / (sourceHeight * scale)),
    distorted: style.objectFit === 'fill' && Math.abs(width / height - sourceWidth / sourceHeight) > .01,
  };
}
async function assertFullPhoto(locator, label) {
  const visible = await locator.evaluate(visibleSource);
  assert.ok(visible.x > .999 && visible.y > .999 && !visible.distorted,
    `${label} must show the full source without distortion: ${JSON.stringify(visible)}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const reducedMotion of ['reduce', 'no-preference']) {
      for (const [width, height] of [[1600, 900], [900, 1600], [1200, 1200]]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(({ width, height }) => {
          localStorage.setItem('words-in-life-gemini-key-v1', 'test-key');
          navigator.mediaDevices.getUserMedia = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const context = canvas.getContext('2d');
            context.fillStyle = '#e8dac5'; context.fillRect(0, 0, width, height);
            context.fillStyle = '#ff0000'; context.fillRect(0, 0, 60, height);
            context.fillStyle = '#0000ff'; context.fillRect(width - 60, 0, 60, height);
            context.fillStyle = '#00ff00'; context.fillRect(0, 0, width, 60);
            context.fillStyle = '#ffff00'; context.fillRect(0, height - 60, width, 60);
            return canvas.captureStream(10);
          };
        }, { width, height });
        let release;
        const responseGate = new Promise(resolve => { release = resolve; });
        let uploaded;
        await page.route('https://generativelanguage.googleapis.com/**', async route => {
          uploaded = route.request().postDataJSON().contents[0].parts.find(part => part.inlineData).inlineData;
          await responseGate;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ isRecognizable: false, unrecognizableReason: '照片範圍測試', items: [] }) }] } }],
          }) });
        });
        await page.goto(baseURL);
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
        for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1440, height: 1000 }]) {
          await page.setViewportSize(viewport);
          await assertFullPhoto(page.locator('.home-viewfinder video'), `preview ${width}×${height} at ${viewport.width}px`);
          if (reducedMotion === 'reduce' && width === 1600 && viewport.width !== 320) {
            await page.screenshot({ path: `${out}/camera-preview-${viewport.width}.png` });
          }
        }
        await page.setViewportSize({ width: 390, height: 844 });
        const request = page.waitForRequest('https://generativelanguage.googleapis.com/**');
        await page.getByRole('button', { name: '拍攝照片', exact: true }).click();
        await request;
        const print = page.locator('.home-print-photo img');
        await print.evaluate(img => img.decode());
        const capture = await print.getAttribute('src');
        for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['desktop', { width: 1440, height: 1000 }]]) {
          await page.setViewportSize(viewport);
          await assertFullPhoto(print, `print ${width}×${height} at ${viewport.width}px`);
          const cancel = page.getByRole('button', { name: '取消辨識' });
          await cancel.scrollIntoViewIfNeeded();
          assert.equal(await cancel.isVisible(), true);
          if (reducedMotion === 'reduce') await page.screenshot({ path: `${out}/camera-content-${width}-${name}.png` });
        }
        const content = await page.evaluate(async ({ capture, uploaded }) => {
          const inspect = async source => {
            const img = new Image(); img.src = source; await img.decode();
            const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
            const pixel = (x, y) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
            const w = canvas.width, h = canvas.height;
            return { ratio: w / h, edges: [pixel(10, h / 2), pixel(w - 10, h / 2), pixel(w / 2, 10), pixel(w / 2, h - 10)] };
          };
          return [await inspect(capture), await inspect(`data:${uploaded.mimeType};base64,${uploaded.data}`)];
        }, { capture, uploaded });
        for (const image of content) {
          assert.ok(Math.abs(image.ratio - width / height) < .002, 'capture and upload must retain source aspect ratio');
          const colors = [[255, 0, 0], [0, 0, 255], [0, 255, 0], [255, 255, 0]];
          image.edges.forEach((pixel, index) => pixel.forEach((channel, c) => assert.ok(Math.abs(channel - colors[index][c]) < 15, 'capture/upload lost a source edge')));
        }
        release();
        await page.getByRole('heading', { name: '照片範圍測試' }).waitFor();
        const failure = page.locator('.failure-page .vs-polaroid img');
        await failure.evaluate(img => img.decode());
        for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1440, height: 1000 }]) {
          await page.setViewportSize(viewport);
          await assertFullPhoto(failure, `failure ${width}×${height} at ${viewport.width}px`);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          if (reducedMotion === 'reduce' && width === 1600 && viewport.width !== 320) {
            await page.screenshot({ path: `${out}/camera-failure-${viewport.width}.png`, fullPage: true });
          }
        }
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`${reducedMotion} ${width}×${height}: preview, print, capture/upload edges, failure and responsive layout passed`);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
