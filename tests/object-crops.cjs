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
    const smallSubject = await page.evaluate(async () => {
      const { parseRecognitionResponse } = await import('/src/domain/recognition.ts');
      const { createRecognitionUsecases } = await import('/src/usecases/recognition.ts');
      const { batchGenerateStickers } = await import('/src/utils/stickerGenerator.ts');
      const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#805030'; ctx.fillRect(0, 0, 600, 1000); // Wall
      ctx.fillStyle = '#ffffff'; ctx.fillRect(60, 150, 480, 700); // Printed illustration
      ctx.fillStyle = '#0000ff'; ctx.fillRect(240, 300, 120, 400); // Person
      ctx.fillStyle = '#00ff00'; // Small cactus beside the person's hand
      ctx.fillRect(222, 440, 12, 60);
      ctx.fillRect(210, 450, 8, 25); ctx.fillRect(238, 445, 8, 30);
      ctx.fillRect(210, 467, 36, 8);
      const source = canvas.toDataURL();
      const boundingBox = { left: 35, top: 44, right: 41, bottom: 50 };
      const provider = { analyze: async () => parseRecognitionResponse({ isRecognizable: true, items: [
        { word: 'cactus', chinese: '仙人掌', boundingBox, position: { x: 38, y: 47 } },
      ] }) };
      const uc = createRecognitionUsecases(provider, {
        compress: async () => ({ bytes: new Uint8Array(), mimeType: 'image/png' }), crop: batchGenerateStickers,
      }, { now: Date.now, createId: () => 'small-illustrated-cactus' });
      const result = await uc.recognizePhoto(source, new AbortController().signal);
      if (!result.success) throw new Error('Cactus recognition fixture failed');
      const item = result.scene.items[0];
      const image = new Image(); image.src = item.stickerUrl; await image.decode();
      const out = document.createElement('canvas'); out.width = 280; out.height = 280;
      const context = out.getContext('2d'); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, 280, 280).data;
      let green = 0, blue = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 80 && pixels[i + 1] > 180 && pixels[i + 2] < 80) green++;
        if (pixels[i] < 80 && pixels[i + 1] < 80 && pixels[i + 2] > 180) blue++;
      }
      return { green, blue, bounds: item.boundingBox, sourcePreserved: item.originalImageUrl === source };
    });
    assert.ok(smallSubject.green / (280 * 280) > .15, 'a tiny depicted cactus must become recognizable in the thumbnail');
    assert.ok(smallSubject.blue / (280 * 280) < .15, `the person behind the cactus must occupy less than 15% of the crop: ${JSON.stringify(smallSubject)}`);
    assert.deepEqual(smallSubject.bounds, { left: 35, top: 44, right: 41, bottom: 50 });
    assert(smallSubject.sourcePreserved);
    // Exercise the actual provider adapter, not a provider stub with pre-parsed bounds.
    await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        isRecognizable: true, items: [
          { word: 'tennis racket', chinese: '網球拍', box_2d: [160, 300, 440, 534], position: { x: 42, y: 26 } },
          { word: 'sports bag', chinese: '運動包', box_2d: [480, 200, 720, 800], position: { x: 50, y: 60 } },
        ],
      }) }] } }] }),
    }));
    const racket = await page.evaluate(async () => {
      const { createGeminiRepository } = await import('/src/repository/gemini/geminiRepository.ts');
      const { createRecognitionUsecases } = await import('/src/usecases/recognition.ts');
      const { batchGenerateStickers } = await import('/src/utils/stickerGenerator.ts');
      const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#d0b090'; ctx.fillRect(0, 0, 600, 1000);
      ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.ellipse(250, 260, 64, 94, 0, 0, Math.PI * 2); ctx.stroke(); // Racket head
      ctx.fillStyle = '#00ff00'; ctx.fillRect(240, 354, 20, 86); // Visible handle
      ctx.fillStyle = '#0000ff'; ctx.fillRect(120, 480, 360, 240); // Sports bag
      ctx.fillStyle = '#ffff00'; ctx.fillRect(180, 800, 240, 100); // Shoes
      const source = canvas.toDataURL();
      const uc = createRecognitionUsecases(createGeminiRepository(() => 'fixture-key', ['fixture-model']), {
        compress: async () => {
          const blob = await (await fetch(source)).blob();
          return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type };
        }, crop: batchGenerateStickers,
      }, { now: Date.now, createId: () => 'racket-bounds' });
      const result = await uc.recognizePhoto(source, new AbortController().signal);
      if (!result.success) throw new Error('Racket recognition fixture failed');
      const [item, bag] = result.scene.items;
      const image = new Image(); image.src = item.stickerUrl; await image.decode();
      const out = document.createElement('canvas'); out.width = 280; out.height = 280;
      const context = out.getContext('2d'); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, 280, 280).data;
      let head = 0, handle = 0, bagPixels = 0, shoes = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = pixels.slice(i, i + 3);
        if (r > 180 && g < 80 && b < 80) head++;
        if (r < 80 && g > 180 && b < 80) handle++;
        if (r < 80 && g < 80 && b > 180) bagPixels++;
        if (r > 180 && g > 180 && b < 80) shoes++;
      }
      return { head, handle, bagPixels, shoes, bounds: item.boundingBox, distinct: item.stickerUrl !== bag.stickerUrl };
    });
    assert.ok(racket.head > 1000 && racket.handle > 500, `racket thumbnail must preserve its head and visible handle: ${JSON.stringify(racket)}`);
    assert.equal(racket.bagPixels, 0, 'racket crop must exclude the sports bag below it');
    assert.equal(racket.shoes, 0, 'racket crop must exclude the shoes');
    assert.deepEqual(racket.bounds, { left: 30, top: 16, right: 53.4, bottom: 44 });
    assert(racket.distinct, 'different subjects must produce different thumbnails');
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
    console.log('Object bounds, Gemini racket localization, small illustrated cactus focus, long-object endpoints, full-scene corners and legacy missing/invalid-bound fallback passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
