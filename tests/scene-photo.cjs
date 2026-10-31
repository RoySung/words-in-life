const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const [width, height] of [[1600, 900], [900, 1600], [1200, 1200]]) {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Distinct edges make unintended cropping visible in screenshots, too.
      await page.route('**/sample-images/cafe_scene.jpg', route => route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path fill="#e8dac5" d="M0 0h${width}v${height}H0z"/><path fill="#426775" d="M0 0h${width}v40H0z"/><path fill="#a64016" d="M0 ${height - 40}h${width}v40H0z"/><path fill="#466744" d="M0 0h40v${height}H0z"/></svg>`,
      }));
      await page.goto(`${baseURL}/design-system/preview?screen=scene`);
      await page.locator('.scene-image > img').evaluate(img => img.decode());
      for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1440, height: 1000 }]) {
        await page.setViewportSize(viewport);
        const dimensions = await page.locator('.scene-image').evaluate(frame => {
          const image = frame.querySelector('img');
          const box = getComputedStyle(image);
          const marker = frame.querySelector('[aria-label="查看 laptop"]');
          return {
            width: parseFloat(box.width), height: parseFloat(box.height),
            naturalRatio: image.naturalWidth / image.naturalHeight,
            frameHeight: frame.clientHeight, frameWidth: frame.clientWidth,
            markerX: marker.style.getPropertyValue('--marker-x'),
            markerY: marker.style.getPropertyValue('--marker-y'),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.ok(Math.abs(dimensions.width / dimensions.height - dimensions.naturalRatio) < .01,
          `Full ${width}×${height} photo must retain its ratio at ${viewport.width}px: ${JSON.stringify(dimensions)}`);
        assert.ok(Math.abs(dimensions.frameHeight - dimensions.height) <= 1, 'marker frame must match photo height');
        assert.ok(Math.abs(dimensions.frameWidth - dimensions.width) <= 1, 'marker frame must match photo width');
        assert.equal(dimensions.markerX, '33%', 'marker x must stay in original photo coordinates');
        assert.equal(dimensions.markerY, '52%', 'marker y must stay in original photo coordinates');
        assert.equal(dimensions.overflow, false, 'photo must not cause horizontal overflow');
      }
      await page.getByRole('button', { name: '隱藏標記' }).click();
      assert.equal(await page.locator('.scene-image .vs-marker').count(), 0);
      await page.getByRole('button', { name: '顯示標記' }).click();
      await page.getByRole('button', { name: '查看 laptop', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${width}×${height}: full photo, marker coordinates, resizing and controls passed`);
    }
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const out = require('node:path').resolve(process.env.TEST_OUTPUT_DIR || 'test-results');
    require('node:fs').mkdirSync(out, { recursive: true });
    await page.goto(`${baseURL}/design-system/preview?screen=scene`);
    await page.locator('.scene-image > img').evaluate(img => img.decode());
    for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }]]) {
      await page.setViewportSize(viewport);
      await page.screenshot({ path: `${out}/scene-photo-${name}.png`, fullPage: true });
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
