const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage();
    await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:4179'}/design-system/preview?screen=detail`);
    const result = await page.evaluate(async () => {
      const { createWordSharePhoto } = await import('/src/utils/wordShareSource.ts');
      const { createPhotoUrls } = await import('/src/repository/photos.ts');
      const source = document.createElement('canvas');
      source.width = 1600; source.height = 1200;
      const ctx = source.getContext('2d');
      ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 1600, 1200);
      // Fine stripes distinguish an original crop from an enlarged thumbnail.
      for (let x = 400; x < 1200; x += 2) {
        ctx.fillStyle = x % 4 === 0 ? '#000' : '#fff';
        ctx.fillRect(x, 300, 2, 600);
      }
      const original = source.toDataURL();
      const thumb = document.createElement('canvas'); thumb.width = thumb.height = 280;
      const thumbCtx = thumb.getContext('2d'); thumbCtx.fillStyle = '#ff0000'; thumbCtx.fillRect(0, 0, 280, 280);
      const thumbnail = thumb.toDataURL();
      const item = { originalImageUrl: original, stickerUrl: thumbnail, boundingBox: { left: 25, top: 25, right: 75, bottom: 75 } };
      const inspect = async url => {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const row = context.getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1).data;
        let transitions = 0;
        for (let x = 200; x < canvas.width - 200; x++) if (Math.abs(row[x * 4] - row[(x - 1) * 4]) > 80) transitions++;
        return { width: canvas.width, height: canvas.height, transitions,
          center: Array.from(context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data),
          padding: Array.from(context.getImageData(canvas.width / 2, 0, 1, 1).data) };
      };
      const high = await inspect(await createWordSharePhoto(item));
      const originalBytes = new Uint8Array(await (await fetch(original)).arrayBuffer());
      const thumbnailBytes = new Uint8Array(await (await fetch(thumbnail)).arrayBuffer());
      const reads = [];
      const urls = createPhotoUrls({ readPhoto: async id => {
        reads.push(id);
        if (id === 'missing') throw new Error('Missing original');
        return { bytes: id === 'original' ? originalBytes : thumbnailBytes, mimeType: 'image/png' };
      } });
      const stored = await inspect(await createWordSharePhoto({ ...item, originalImageUrl: undefined, photo: { kind: 'stored', photoId: 'original' }, crop: { kind: 'stored', photoId: 'thumbnail' } }, urls));
      const fallback = await inspect(await createWordSharePhoto({ photo: { kind: 'stored', photoId: 'missing' }, crop: { kind: 'stored', photoId: 'thumbnail' }, boundingBox: item.boundingBox }, urls));
      const legacy = await inspect(await createWordSharePhoto({ stickerUrl: thumbnail, boundingBox: item.boundingBox }));
      const withoutBounds = [];
      for (const boundingBox of [undefined, { left: 75, top: 25, right: 25, bottom: 75 }]) {
        withoutBounds.push(await inspect(await createWordSharePhoto({ ...item, boundingBox })));
        withoutBounds.push(await inspect(await createWordSharePhoto({ boundingBox, photo: { kind: 'asset', path: original }, crop: { kind: 'asset', path: thumbnail } })));
        withoutBounds.push(await inspect(await createWordSharePhoto({ boundingBox, stickerUrl: thumbnail }, undefined, original)));
      }
      const legacyReads = [];
      const legacyUrls = createPhotoUrls({ readPhoto: async id => {
        legacyReads.push(id);
        return { bytes: id === 'original' ? originalBytes : thumbnailBytes, mimeType: 'image/png' };
      } });
      withoutBounds.push(await inspect(await createWordSharePhoto({ photo: { kind: 'stored', photoId: 'original' }, crop: { kind: 'stored', photoId: 'thumbnail' } }, legacyUrls)));
      legacyUrls.close();
      const originalOnly = await inspect(await createWordSharePhoto({ originalImageUrl: original }));
      const missingCrop = await inspect(await createWordSharePhoto({ originalImageUrl: original, stickerUrl: '/missing-legacy-crop.png' }));
      const scene = await inspect(await createWordSharePhoto({ boundingBox: item.boundingBox }, undefined, original));
      const asset = await inspect(await createWordSharePhoto({ photo: { kind: 'asset', path: original }, boundingBox: item.boundingBox }));
      const controller = new AbortController(); controller.abort();
      const cancelled = await createWordSharePhoto(item, undefined, undefined, controller.signal).then(() => false, error => error.name === 'AbortError');
      const missing = await createWordSharePhoto({}).then(() => false, () => true);
      urls.close();
      return { high, stored, fallback, legacy, withoutBounds, legacyReads, originalOnly, missingCrop, scene, asset, reads, cancelled, missing };
    });
    assert.equal(result.high.width, 968);
    assert.ok(result.high.transitions > 300, 'fine original detail must survive export preparation');
    assert.deepEqual(result.high.padding, [255, 249, 239, 255], 'preserve the existing fit and padding around non-square crops');
    assert.deepEqual(result.stored, result.high);
    assert.deepEqual(result.scene, result.high);
    assert.deepEqual(result.asset, result.high);
    assert.deepEqual(result.reads, ['original', 'missing', 'thumbnail'], 'only acquire the thumbnail after the original fails');
    for (const crop of result.withoutBounds) {
      assert.deepEqual(crop, result.legacy, 'missing or invalid bounds must preserve the existing crop even when an original is available');
    }
    assert.deepEqual(result.legacyReads, ['thumbnail'], 'without bounds, do not acquire the original when a crop is available');
    assert.equal(result.originalOnly.width, 968, 'an original remains usable when no crop is available');
    assert.deepEqual(result.missingCrop, result.originalOnly, 'a failed legacy crop falls back to the full scene');
    for (const fallback of [result.fallback, result.legacy]) {
      assert.equal(fallback.width, 280);
      assert.deepEqual(fallback.center, [255, 0, 0, 255], 'fallback crops stay intact and readable after leases release');
    }
    assert.equal(result.cancelled, true);
    assert.equal(result.missing, true);
    console.log('Share photo resolution, fine detail, crop geometry, source variants, legacy fallback and cancellation passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
