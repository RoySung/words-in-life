const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/missing-*.jpg', route => route.fulfill({ status: 404, body: '' }));
    await page.goto(`${baseURL}/design-system/preview?screen=scene`);
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: { flushSync } } = await import('/node_modules/.vite/deps/react-dom.js');
      const { WordDetailModal } = await import('/src/components/WordDetailModal.tsx');
      const { SceneView } = await import('/src/components/SceneView.tsx');
      const { FavoritesView } = await import('/src/components/FavoritesView.tsx');
      const { FlashcardQuiz } = await import('/src/components/FlashcardQuiz.tsx');
      const { PhotoImage } = await import('/src/hooks/usePhotoUrl.tsx');
      const { createPhotoUrls } = await import('/src/repository/photos.ts');
      const { SAMPLE_SCENES } = await import('/src/data/sampleScenes.ts');
      const bytes = new Uint8Array(await (await fetch(SAMPLE_SCENES[0].imageUrl)).arrayBuffer());
      window.photoReads = [];
      const urls = createPhotoUrls({ readPhoto: async id => {
        window.photoReads.push(id);
        if (id === 'missing') throw new Error('Photo record missing');
        return { bytes: id === 'corrupt' ? new Uint8Array([1, 2, 3]) : bytes, mimeType: 'image/jpeg' };
      } });
      const host = document.createElement('div');
      host.className = 'vs-theme words-in-life-app fallback-fixture';
      document.getElementById('root').style.display = 'none';
      document.body.append(host);
      const root = createRoot(host);
      const render = component => flushSync(() => root.render(component));
      window.renderPhotoCase = (mode, surface = 'detail') => {
        window.photoReads.length = 0;
        const scene = SAMPLE_SCENES[0];
        const item = { ...scene.items[0], stickerUrl: '/missing-crop.jpg', originalImageUrl: mode === 'all-missing' ? '/missing-original.jpg' : scene.imageUrl };
        if (mode.startsWith('stored-')) { item.crop = { kind: 'stored', photoId: mode.slice(7) }; item.photo = { kind: 'stored', photoId: 'original' }; delete item.stickerUrl; delete item.originalImageUrl; }
        if (surface === 'scene') render(React.createElement(SceneView, { result: { ...scene, imageUrl: '/missing-original.jpg' }, savedWords: [], onBack() {}, onNewPhoto() {}, onSelectItem() {}, onToggleSave() {} }));
        else if (surface === 'collection') render(React.createElement(FavoritesView, { savedWords: [{ ...item, savedAt: 0 }], photoUrls: urls, onBack() {}, onSelectItem() {}, onRemoveWord() {}, onStartQuiz() {} }));
        else if (surface === 'quiz') render(React.createElement(FlashcardQuiz, { words: [{ ...item, savedAt: 0 }], photoUrls: urls, onClose() {} }));
        else if (surface === 'image') render(React.createElement(PhotoImage, { photo: item.crop, fallbackPhoto: item.photo, src: item.stickerUrl, fallbackSrc: item.originalImageUrl, urls, alt: '測試照片' }));
        else render(React.createElement(WordDetailModal, { item, photoUrls: urls, isSaved: false, onClose() {}, onToggleSave() {} }));
      };
    });
    const fixture = page.locator('.fallback-fixture');
    for (const mode of ['url-missing', 'stored-missing', 'stored-corrupt', 'stored-good']) {
      await page.evaluate(mode => window.renderPhotoCase(mode), mode);
      const image = fixture.locator('.detail-polaroid > img');
      await image.waitFor();
      await page.waitForFunction(() => { const img = document.querySelector('.fallback-fixture .detail-polaroid > img'); return img?.complete && img.naturalWidth > 0; });
      await image.evaluate(img => img.decode());
      const reads = await page.evaluate(() => window.photoReads);
      assert.deepEqual(reads, mode === 'url-missing' ? [] : mode === 'stored-good' ? ['good'] : [mode.slice(7), 'original'], 'original storage should be read only after crop failure');
      assert.equal(await fixture.locator('.photo-unavailable').count(), 0);
    }
    // Reuse the component while changing sources, including recovery after total failure.
    for (const mode of ['all-missing', 'url-missing', 'all-missing']) {
      await page.evaluate(mode => window.renderPhotoCase(mode, 'image'), mode);
      if (mode === 'all-missing') {
        await fixture.getByRole('img', { name: '測試照片：照片無法載入' }).waitFor();
        assert.equal(await fixture.locator('img').count(), 0, 'show a clear placeholder instead of a broken image');
      } else {
        await fixture.locator('img').waitFor();
        await page.waitForFunction(() => document.querySelector('.fallback-fixture img')?.getAttribute('src') === '/sample-images/cafe_scene.jpg');
        await fixture.locator('img').evaluate(img => img.decode());
      }
    }
    for (const surface of ['collection', 'quiz']) {
      await page.evaluate(surface => window.renderPhotoCase('stored-missing', surface), surface);
      const image = fixture.locator(surface === 'collection' ? '.collection-open img' : '.quiz-face--front img');
      await image.waitFor();
      await image.evaluate(img => img.decode());
      assert.deepEqual(await page.evaluate(() => window.photoReads), ['missing', 'original']);
    }
    await page.evaluate(() => window.renderPhotoCase('all-missing'));
    await fixture.locator('.detail-polaroid .photo-unavailable').waitFor();
    await fixture.getByRole('button', { name: '更多用法與發音' }).click();
    await fixture.getByRole('button', { name: '查看拍攝原圖' }).click();
    await fixture.locator('.source-dialog .photo-unavailable').waitFor();
    assert.equal(await fixture.locator('.source-dialog .vs-marker').count(), 0, 'failed original viewer must not show misplaced markers or substitute a crop');
    await fixture.getByRole('button', { name: '關閉原圖' }).click();
    await page.evaluate(() => window.renderPhotoCase('all-missing', 'scene'));
    await fixture.locator('.scene-image .photo-unavailable').waitFor();
    assert.equal(await fixture.locator('.scene-image .vs-marker').count(), 0, 'do not show object markers on an unavailable photo');
    assert.deepEqual(errors, []);
    console.log('Crop URL, missing/corrupt stored crop, lazy original, terminal placeholder, source changes, collection and quiz fallback passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
