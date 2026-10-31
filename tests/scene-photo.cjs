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
        await page.evaluate(() => window.scrollTo(0, 0));
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
        const composition = await page.evaluate(() => {
          const box = selector => document.querySelector(selector).getBoundingClientRect();
          return { photo: box('.scene-polaroid').toJSON(), heading: box('.discovery-sheet h1').toJSON(), shutter: box('.scene-capture').toJSON(), height: innerHeight, width: innerWidth };
        });
        assert.ok(composition.heading.bottom < composition.height,
          'discovery heading must appear in the first viewport');
        assert.ok(composition.photo.left >= 8 && composition.photo.right <= composition.width - 8,
          'tilted photo must keep safe horizontal margins');
        assert.ok(composition.photo.bottom + 12 < composition.shutter.top,
          'floating camera action must not overlap the photo controls');
        const content = await page.locator('.scene-page > main').evaluate(main => ({
          height: main.clientHeight, scrollHeight: main.scrollHeight,
        }));
        assert.ok(content.height >= content.scrollHeight - 1,
          'results must expand with the full word list instead of clipping into a nested scroll region');
        // A swipe anywhere on the result should move the document, including over the photo.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const lastWord = page.locator('.discovery-row').last();
        const lastBox = await lastWord.boundingBox();
        const shutterBox = await page.locator('.scene-capture').boundingBox();
        assert.ok(lastBox.y >= 0 && lastBox.y + lastBox.height + 8 <= shutterBox.y,
          'the last word and its controls must scroll fully above the camera button');
        assert.ok(shutterBox.y + shutterBox.height <= viewport.height,
          'the camera button must remain reachable at the end of the page');
        await lastWord.getByRole('button', { name: /移除|收藏/ }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
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
    for (const cameraEnabled of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
      await page.addInitScript(enabled => {
        localStorage.setItem('words-in-life-camera-enabled-v1', String(enabled));
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          value: async () => { throw new DOMException('Test denied camera', 'NotAllowedError'); },
        });
      }, cameraEnabled);
      await page.addLocatorHandler(page.getByRole('button', { name: '繼續探索照片' }), button => button.click());
      await page.goto(baseURL);
      await page.getByRole('button', { name: /今日尋寶/ }).click();
      await page.getByRole('button', { name: '體驗範例照片', exact: true }).click();
      await page.locator('.scene-page').waitFor();
      await page.getByRole('button', { name: '再拍一張', exact: true }).scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => window.scrollY > 0), 'the scene must be scrolled before returning');
      await page.getByRole('button', { name: '再拍一張', exact: true }).click();
      await page.locator('.home-page').waitFor();
      assert.equal(await page.evaluate(() => window.scrollY), 0,
        `returning to the camera must reset document scroll (camera enabled: ${cameraEnabled})`);
      const toggle = await page.locator('.camera-toggle').boundingBox();
      assert.ok(toggle.y >= 0 && toggle.y + toggle.height <= 568, 'camera power switch must be visible');
      await page.close();
    }
    console.log('Small-screen return to camera: camera off and permission denied passed');
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
