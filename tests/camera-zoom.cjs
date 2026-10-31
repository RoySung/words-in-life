const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';
const out = path.resolve(process.env.TEST_OUTPUT_DIR || 'test-results');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const [width, height] of [[1600, 900], [900, 1600], [1200, 1200]]) {
      for (const zoom of [1, 2]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(({ width, height }) => {
          localStorage.setItem('words-in-life-gemini-key-v1', 'test-key');
          window.cameraRequests = 0;
          navigator.mediaDevices.getUserMedia = async () => {
            window.cameraRequests++;
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#e8dac5'; ctx.fillRect(0, 0, width, height);
            // Four colored edges bound exactly the center half of the source.
            ctx.fillStyle = '#ff0000'; ctx.fillRect(width / 4, height / 4, 40, height / 2);
            ctx.fillStyle = '#0000ff'; ctx.fillRect(width * 3 / 4 - 40, height / 4, 40, height / 2);
            ctx.fillStyle = '#00ff00'; ctx.fillRect(width / 4, height / 4, width / 2, 40);
            ctx.fillStyle = '#ffff00'; ctx.fillRect(width / 4, height * 3 / 4 - 40, width / 2, 40);
            return canvas.captureStream(10);
          };
        }, { width, height });
        let submitted;
        let recognitionGate;
        await page.route('https://generativelanguage.googleapis.com/**', async route => {
          submitted = route.request().postDataJSON().contents[0].parts.find(part => part.inlineData).inlineData;
          await recognitionGate;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ isRecognizable: false, unrecognizableReason: '倍率測試', items: [] }) }] } }],
          }) });
        });
        await page.goto(baseURL);
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
        const toggle = page.getByRole('button', { name: /^目前 [12] 倍，切換至 [12] 倍$/ });
        await toggle.waitFor();
        assert.equal(await toggle.count(), 1, 'camera needs one zoom toggle');
        assert.equal(await toggle.textContent(), '1x');
        assert.equal(await toggle.getAttribute('aria-label'), '目前 1 倍，切換至 2 倍');
        await toggle.click();
        assert.equal(await toggle.textContent(), '2x');
        assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
        await toggle.focus(); await page.keyboard.press('Space');
        assert.equal(await toggle.textContent(), '1x', 'Space must toggle back to 1x');
        await page.keyboard.press('Enter');
        assert.equal(await toggle.textContent(), '2x', 'Enter must toggle to 2x');
        if (zoom === 1) await toggle.click();
        assert.equal(await toggle.textContent(), `${zoom}x`);
        assert.equal(await page.evaluate(() => window.cameraRequests), 1, 'zoom must not restart the stream');
        for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
          await page.setViewportSize(viewport);
          await page.waitForFunction(() => {
            const frame = document.querySelector('.camera-preview-frame');
            const video = document.querySelector('video');
            if (!frame || !video.videoHeight) return false;
            const bounds = frame.parentElement.getBoundingClientRect();
            const ratio = video.videoWidth / video.videoHeight;
            const expectedWidth = Math.min(bounds.width, bounds.height * ratio);
            return Math.abs(frame.clientWidth / frame.clientHeight - ratio) < .01
              && Math.abs(frame.getBoundingClientRect().width - expectedWidth) < 1;
          });
          const geometry = await page.locator('.camera-preview-frame').evaluate(frame => {
            const video = frame.querySelector('video');
            const box = frame.getBoundingClientRect(), content = video.getBoundingClientRect();
            return {
              clip: getComputedStyle(frame).overflow,
              scaleX: content.width / box.width, scaleY: content.height / box.height,
              centerX: (content.left + content.right - box.left - box.right) / 2,
              centerY: (content.top + content.bottom - box.top - box.bottom) / 2,
              ratio: box.width / box.height,
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          assert.equal(geometry.clip, 'hidden');
          assert.ok(Math.abs(geometry.scaleX - zoom) < .01 && Math.abs(geometry.scaleY - zoom) < .01, 'preview must magnify both axes equally');
          assert.ok(Math.abs(geometry.centerX) < 1 && Math.abs(geometry.centerY) < 1, 'zoom must stay centered');
          assert.ok(Math.abs(geometry.ratio - width / height) < .01, 'preview crop must retain source aspect ratio');
          assert.equal(geometry.overflow, false);
          if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({ path: `${out}/camera-zoom-${width}-${zoom}x-${viewport.width}.png` });
        }
        await page.getByRole('button', { name: '拍攝照片', exact: true }).click();
        await page.getByRole('heading', { name: '倍率測試' }).waitFor();
        const capture = await page.locator('.failure-page .vs-polaroid img').getAttribute('src');
        const images = await page.evaluate(async ({ capture, submitted }) => {
          const inspect = async source => {
            const img = new Image(); img.src = source; await img.decode();
            const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
            const w = canvas.width, h = canvas.height;
            return { width: w, height: h, edges: [[10, h / 2], [w - 10, h / 2], [w / 2, 10], [w / 2, h - 10]].map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3)) };
          };
          return [await inspect(capture), await inspect(`data:${submitted.mimeType};base64,${submitted.data}`)];
        }, { capture, submitted });
        assert.equal(images[0].width, width / zoom);
        assert.equal(images[0].height, height / zoom);
        for (const image of images) {
          assert.ok(Math.abs(image.width / image.height - width / height) < .002);
          const expected = zoom === 2 ? [[255, 0, 0], [0, 0, 255], [0, 255, 0], [255, 255, 0]] : Array(4).fill([232, 218, 197]);
          image.edges.forEach((pixel, i) => pixel.forEach((channel, c) => assert.ok(Math.abs(channel - expected[i][c]) < 15, `${zoom}x capture/upload must match the selected source region`)));
        }
        await page.getByRole('button', { name: '重新拍攝', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
        assert.equal(await toggle.textContent(), '1x', 'a new capture session defaults to 1x');
        await toggle.click();
        const cameraSwitch = page.getByRole('switch', { name: '鏡頭', exact: true });
        await cameraSwitch.click();
        assert.equal(await toggle.count(), 0, 'zoom controls must disappear while camera is off');
        await cameraSwitch.click();
        await toggle.waitFor();
        assert.equal(await toggle.textContent(), '1x', 'reopening the camera must reset zoom');
        await toggle.click();
        let releaseRecognition;
        recognitionGate = new Promise(resolve => { releaseRecognition = resolve; });
        const request = page.waitForRequest('https://generativelanguage.googleapis.com/**');
        await page.getByRole('button', { name: '拍攝照片', exact: true }).click();
        await request;
        await page.getByRole('button', { name: '取消辨識' }).click();
        releaseRecognition();
        await toggle.waitFor();
        assert.equal(await toggle.textContent(), '1x', 'canceling recognition must reset zoom for the next capture');
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`${width}×${height} ${zoom}x: controls, keyboard, centered preview, capture/upload pixels and new session passed`);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
