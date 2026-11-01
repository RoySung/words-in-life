const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/design-system/preview?screen=scene`, { waitUntil: 'domcontentloaded' });
    await page.locator('.scene-image').waitFor();
    const results = await page.evaluate(async () => {
      const { parseRecognitionResponse } = await import('/src/domain/recognition.ts');
      const { createRecognitionUsecases } = await import('/src/usecases/recognition.ts');
      const { batchGenerateStickers } = await import('/src/utils/stickerGenerator.ts');
      const orientations = [];
      for (const landscape of [false, true]) {
        const canvas = document.createElement('canvas'); canvas.width = landscape ? 1000 : 600; canvas.height = landscape ? 600 : 1000;
        const ctx = canvas.getContext('2d');
        if (landscape) ctx.transform(0, 1, 1, 0, 0, 0);
        ctx.fillStyle = '#a08060'; ctx.fillRect(0, 0, 600, 1000);
        // A long object with distinct ends: a point crop loses both ends.
        ctx.fillStyle = '#ffffff'; ctx.fillRect(240, 100, 120, 800);
        ctx.fillStyle = '#ff0000'; ctx.fillRect(240, 100, 120, 80);
        ctx.fillStyle = '#00ff00'; ctx.fillRect(240, 820, 120, 80);
        ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 0, 80, 80);
        ctx.fillRect(520, 920, 80, 80);
        const source = canvas.toDataURL();
        const boxes = [
          { left: 40, top: 10, right: 60, bottom: 90 },
          { left: 0, top: 0, right: 100, bottom: 100 },
          undefined,
          { left: 70, top: 0, right: 30, bottom: 100 },
          { left: -10, top: 0, right: 100, bottom: 100 },
        ];
        const provider = { analyze: async () => parseRecognitionResponse({ isRecognizable: true, items: boxes.map((boundingBox, i) => ({ word: `object ${i}`, chinese: '物品', position: { x: 50, y: 50 }, boundingBox: landscape && boundingBox ? { left: boundingBox.top, top: boundingBox.left, right: boundingBox.bottom, bottom: boundingBox.right } : boundingBox })) }) };
        const uc = createRecognitionUsecases(provider, { compress: async () => ({ bytes: new Uint8Array(), mimeType: 'image/png' }), crop: batchGenerateStickers }, { now: Date.now, createId: () => 'crop-test' });
        const result = await uc.recognizePhoto(source, new AbortController().signal);
        if (!result.success) throw new Error('Fixture recognition failed');
        orientations.push(...await Promise.all(result.scene.items.map(async item => {
          const image = new Image(); image.src = item.stickerUrl; await image.decode();
          const out = document.createElement('canvas'); out.width = image.naturalWidth; out.height = image.naturalHeight;
          const context = out.getContext('2d'); context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, out.width, out.height).data;
          let red = 0, green = 0, blue = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 180 && data[i+1] < 80 && data[i+2] < 80) red++;
            if (data[i] < 80 && data[i+1] > 180 && data[i+2] < 80) green++;
            if (data[i] < 80 && data[i+1] < 80 && data[i+2] > 180) blue++;
          }
          return { red, green, blue, sourcePreserved: item.originalImageUrl === source, boundingBox: item.boundingBox };
        })));
      }
      return orientations;
    });
    for (const [i, result] of results.entries()) {
      assert.ok(result.red > 100 && result.green > 100, `crop ${i} must preserve both ends of the large object: ${JSON.stringify(result)}`);
      assert(result.sourcePreserved);
      if (i % 5 > 0) assert.ok(result.blue > 100, `scene/unknown bounds ${i} must preserve full-photo corners`);
    }
    assert.deepEqual(results[0].boundingBox, { left: 40, top: 10, right: 60, bottom: 90 }, 'provider bounds must survive recognition parsing');
    fs.mkdirSync('test-results/object-crops', { recursive: true });
    for (const screen of ['scene', 'collection', 'detail', 'quiz']) {
      await page.goto(`${baseURL}/design-system/preview?screen=${screen}`, { waitUntil: 'domcontentloaded' });
      const selector = { scene: '.discovery-open img', collection: '.collection-open img', detail: '.detail-polaroid > img', quiz: '.quiz-card-turn .quiz-face--front > img' }[screen];
      const photo = page.locator(selector).first();
      await photo.waitFor();
      await photo.evaluate(img => img.decode());
      for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }]]) {
        await page.setViewportSize(viewport);
        assert.equal(await photo.evaluate(img => getComputedStyle(img).objectFit), 'contain', `${screen} must not crop images again at ${name} size`);
        await page.screenshot({ path: `test-results/object-crops/${screen}-${name}.png` });
      }
    }
    console.log('Object bounds, long-object endpoints, full-scene corners and missing/invalid-bound fallback passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
