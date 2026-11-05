const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:4179'}/design-system/preview?screen=detail`);
    await page.getByRole('button', { name: '分享單字', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '分享單字', exact: true });
    await dialog.locator('.word-share-preview').waitFor();
    await page.waitForFunction(() => !document.querySelector('.word-share-dialog')?.classList.contains('is-morphing') && !document.querySelector('.word-share-flight-photo'));
    assert.equal(await page.locator('.word-share-flight-photo').count(), 0);
    assert.equal(await page.locator('.detail-polaroid img').evaluate(image => image.style.visibility), '');
    const dimensions = await dialog.locator('.word-share-preview').evaluate(async image => {
      await image.decode(); return [image.naturalWidth, image.naturalHeight];
    });
    assert.equal(dimensions[0], 1080);
    assert.ok(dimensions[1] > 1400);
    await page.screenshot({ path: '/tmp/word-share-mobile.png', fullPage: true });
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: '儲存圖片' }).click();
    assert.match((await download).suggestedFilename(), /words-in-life\.png$/);
    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
    const fallback = page.waitForEvent('download');
    await dialog.getByRole('button', { name: '分享圖片' }).click();
    await fallback;
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
        window.sharedImage = { size: data.files[0].size, type: data.files[0].type };
        throw new DOMException('Cancelled', 'AbortError');
      } });
    });
    await dialog.getByRole('button', { name: '分享圖片' }).click();
    await page.waitForFunction(() => window.sharedImage);
    assert.equal((await page.evaluate(() => window.sharedImage)).type, 'image/png');
    assert.equal(await dialog.getByRole('alert').count(), 0);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: '分享單字', exact: true }).evaluate(e => e === document.activeElement), true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: '分享單字', exact: true }).click();
    await dialog.locator('.word-share-preview').waitFor();
    await page.screenshot({ path: '/tmp/word-share-desktop.png', fullPage: true });
    await page.waitForFunction(() => !document.querySelector('.word-share-dialog')?.classList.contains('is-morphing') && !document.querySelector('.word-share-flight-photo'));
    await dialog.getByRole('button', { name: '關閉分享' }).click();
    await dialog.waitFor({ state: 'detached' });
    // Keep React mounted briefly after the close helper resolves: its terminal
    // frame must already be closed, before cleanup restores faded elements.
    await page.getByRole('button', { name: '分享單字', exact: true }).click();
    await page.waitForFunction(() => {
      const dialog = document.querySelector('.word-share-dialog');
      return dialog?.querySelector('.word-share-preview') && !dialog.classList.contains('is-morphing') && !dialog.classList.contains('is-preparing') && !dialog.querySelector('.word-share-flight-photo');
    });
    const terminal = await page.evaluate(async () => {
      const { closeWordShare } = await import('/src/utils/wordShareMotion.ts');
      const dialog = document.querySelector('.word-share-dialog');
      const origin = document.querySelector('.detail-polaroid img');
      await closeWordShare(dialog, origin);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { open: dialog.open, originVisibility: origin.style.visibility, layers: dialog.querySelectorAll('.word-share-flight-photo, .word-share-flight-paper').length };
    });
    assert.equal(terminal.open, false, 'close must hide the native dialog before restoring faded content');
    assert.equal(terminal.originVisibility, '');
    assert.equal(terminal.layers, 0);
    await page.locator('.word-share-dialog button[aria-label="關閉分享"]').evaluate(button => button.click());
    await dialog.waitFor({ state: 'detached' });
    // Pause the opening animation to verify the moving photo and its actual origin.
    await page.getByRole('button', { name: '分享單字', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.word-share-flight-photo'));
    const motion = await page.evaluate(() => {
      const dialog = document.querySelector('.word-share-dialog');
      for (const element of [dialog, ...dialog.querySelectorAll('*')]) {
        for (const animation of element.getAnimations()) { animation.pause(); animation.currentTime = 180; }
      }
      const flight = dialog.querySelector('.word-share-flight-photo');
      const source = document.querySelector('.detail-polaroid img');
      const keyframes = flight.getAnimations()[0].effect.getKeyframes();
      return { visible: getComputedStyle(flight).visibility, hiddenOrigin: source.style.visibility,
        startLeft: parseFloat(keyframes[0].left), originLeft: source.getBoundingClientRect().left };
    });
    assert.equal(motion.visible, 'visible');
    assert.equal(motion.hiddenOrigin, 'hidden');
    assert.ok(Math.abs(motion.startLeft - motion.originLeft) < 1);
    await dialog.getByRole('button', { name: '關閉分享' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.detail-polaroid img').evaluate(image => image.style.visibility), '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '分享單字', exact: true }).click();
    await dialog.locator('.word-share-preview').waitFor();
    await page.waitForFunction(() => !document.querySelector('.word-share-dialog')?.classList.contains('is-preparing'));
    assert.equal(await page.locator('.word-share-flight-photo').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Word sharing: PNG preview, download, fallback, cancellation, focus restoration and desktop passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
