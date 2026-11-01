const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(`${baseURL}/design-system/preview?screen=scene`);
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(() => { const layer = document.querySelector('.photo-markers'); return layer && Number(layer.dataset.layoutWidth) === layer.clientWidth; });
      const labels = await page.locator('.scene-image .vs-marker-label').evaluateAll(labels => labels.map(label => {
        const rect = label.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('button')?.getAttribute('aria-label'), expected: label.closest('button').getAttribute('aria-label') };
      }));
      for (const label of labels) assert.equal(label.hit, label.expected, `label text must remain clickable at ${viewport.width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '查看 coffee', exact: true }).locator('.vs-marker-label').click({ timeout: 2000 });
    assert.equal(await page.getByRole('dialog').getAttribute('aria-label'), 'coffee 單字詳情', 'label text must open its own word, even beside another label');
    await page.getByRole('button', { name: '關閉單字詳情' }).click();
    await page.getByRole('button', { name: '查看 laptop', exact: true }).click();
    const preview = await page.locator('.detail-polaroid > img').evaluate(img => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 }));
    assert.ok(preview.src, 'clicking a marker must retain the source photo URL without a stored photo ref');
    await page.locator('.detail-polaroid > img').evaluate(img => img.decode());
    await page.getByRole('button', { name: '關閉單字詳情' }).click();

    // Exercise production components with nearby objects and an object near the right edge.
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { SceneView } = await import('/src/components/SceneView.tsx');
      const { WordDetailModal } = await import('/src/components/WordDetailModal.tsx');
      const { batchGenerateStickers } = await import('/src/utils/stickerGenerator.ts');
      const { SAMPLE_SCENES } = await import('/src/data/sampleScenes.ts');
      const scene = SAMPLE_SCENES[0];
      const items = await batchGenerateStickers(scene.imageUrl, scene.items.slice(0, 3).map((item, i) => ({ ...item, boundingBox: [{ left: 35, top: 10, right: 65, bottom: 90 }, { left: 0, top: 30, right: 100, bottom: 60 }, { left: 80, top: 70, right: 100, bottom: 100 }][i], position: [{ x: 50, y: 50 }, { x: 55, y: 52 }, { x: 92, y: 88 }][i] })));
      const host = document.createElement('div');
      host.className = 'vs-theme words-in-life-app';
      document.getElementById('root').style.display = 'none';
      document.body.append(host);
      function Fixture() {
        const [selected, setSelected] = React.useState(null);
        return React.createElement(React.Fragment, null,
          React.createElement(SceneView, { result: { ...scene, items }, savedWords: [], onBack() {}, onNewPhoto() {}, onSelectItem: setSelected, onToggleSave() {} }),
          selected && React.createElement(WordDetailModal, { item: selected, imageUrl: scene.imageUrl, isSaved: false, onClose: () => setSelected(null), onToggleSave() {} }));
      }
      createRoot(host).render(React.createElement(Fixture));
    });
    const frame = page.locator('body > .words-in-life-app .scene-image');
    await frame.locator('img').evaluate(img => img.decode());
    const coordinates = await frame.locator('.vs-marker').evaluateAll(markers => markers.map(marker => [marker.style.getPropertyValue('--marker-x'), marker.style.getPropertyValue('--marker-y')]));
    assert.deepEqual(coordinates, [['50%', '50%'], ['55%', '52%'], ['92%', '88%']], 'nearby markers and edge markers must retain recognition coordinates');
    await frame.evaluate(frame => { frame.closest('figure').style.transform = 'none'; });
    for (const [i, position] of [[50, 50], [55, 52], [92, 88]].entries()) {
      const geometry = await frame.locator('.vs-marker').nth(i).evaluate(marker => {
        const frame = marker.parentElement.getBoundingClientRect();
        const dot = marker.querySelector('span').getBoundingClientRect();
        const label = marker.querySelector('.vs-marker-label')?.getBoundingClientRect() || marker.getBoundingClientRect();
        return { x: (dot.left + dot.width / 2 - frame.left) / frame.width * 100, y: (dot.top + dot.height / 2 - frame.top) / frame.height * 100, right: label.right, frameRight: frame.right };
      });
      assert.ok(Math.abs(geometry.x - position[0]) < 1 && Math.abs(geometry.y - position[1]) < 1, `dot center must match object coordinates: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.right <= geometry.frameRight + 1, 'edge labels must remain within the photo');
    }
    const fixture = page.locator('body > .words-in-life-app');
    for (let i = 0; i < 3; i++) {
      const expectedCrop = await fixture.locator('.discovery-open img').nth(i).getAttribute('src');
      assert.ok(expectedCrop.startsWith('data:image/jpeg'), 'fixture must exercise generated crops');
      await frame.locator('.vs-marker').nth(i).locator('.vs-marker-label').click();
      await fixture.locator('.detail-polaroid > img').evaluate(img => img.decode());
      assert.equal(await fixture.locator('.detail-polaroid > img').getAttribute('src'), expectedCrop, 'clicked marker detail must show the same crop as its result row');
      await fixture.getByRole('button', { name: '更多用法與發音' }).click();
      await fixture.getByRole('button', { name: '查看拍攝原圖' }).click();
      const sourceMarker = fixture.locator('.source-dialog .vs-marker');
      assert.deepEqual(await sourceMarker.evaluate(marker => [marker.style.getPropertyValue('--marker-x'), marker.style.getPropertyValue('--marker-y')]), coordinates[i], 'source viewer must preserve the same object coordinates');
      await fixture.getByRole('button', { name: '關閉原圖' }).click();
      await fixture.getByRole('button', { name: '關閉單字詳情' }).click();
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await frame.evaluate(frame => { frame.style.width = '80px'; frame.style.height = '140px'; });
    await frame.locator('.photo-markers--compact').waitFor();
    assert.equal(await frame.locator('.vs-marker').count(), 3, 'small photos must preserve all object dots');
    assert.equal(await frame.locator('.vs-marker-label').first().isVisible(), false, 'hide labels when no collision-free layout fits');
    const compactMarker = frame.locator('.vs-marker').last();
    await compactMarker.focus();
    await page.keyboard.press('Enter');
    await fixture.getByRole('dialog', { name: 'latte art 單字詳情' }).waitFor();
    await fixture.getByRole('button', { name: '關閉單字詳情' }).click();
    await frame.evaluate(frame => { frame.style.width = ''; frame.style.height = ''; });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !document.querySelector('body > .words-in-life-app .photo-markers--compact'));
    console.log('Recognition detail image, nearby marker coordinates, dot centers and edge labels passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
