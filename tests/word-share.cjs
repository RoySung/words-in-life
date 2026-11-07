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
    const exported = await download;
    assert.match(exported.suggestedFilename(), /words-in-life\.png$/);
    await exported.saveAs('/tmp/word-share-export.png');
    const composition = await dialog.locator('.word-share-preview').evaluate(async image => {
      const { wordShareFrames } = await import('/src/utils/wordShareLayout.ts');
      const bounds = image.getBoundingClientRect();
      const frames = wordShareFrames(image);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      return { margin: frames.paper.left - bounds.left, photoInset: frames.photo.left - bounds.left,
        cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3],
        fits: bounds.right <= innerWidth && bounds.left >= 0 };
    });
    assert.ok(composition.margin > 20, 'the Polaroid has visible desk margins');
    assert.ok(composition.photoInset > composition.margin, 'photo flight lands within the paper');
    assert.equal(composition.cornerAlpha, 0, 'the on-screen card floats over the full-screen desk');
    const exportedAlpha = await page.evaluate(async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, 1, 1).data[3];
    }, require('node:fs').readFileSync('/tmp/word-share-export.png').toString('base64'));
    assert.equal(exportedAlpha, 255, 'the saved image retains its opaque wood desk');
    const layout = await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const footer = element.querySelector('footer').getBoundingClientRect();
      const preview = element.querySelector('.word-share-preview').getBoundingClientRect();
      return { fullScreen: bounds.width === innerWidth && bounds.height === innerHeight,
        bottomActions: footer.top > innerHeight / 2 && footer.bottom <= innerHeight,
        clearCard: preview.bottom <= footer.top };
    });
    assert.deepEqual(layout, { fullScreen: true, bottomActions: true, clearCard: true });
    assert.equal(composition.fits, true);
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
    await page.waitForFunction(() => !document.querySelector('.word-share-dialog')?.classList.contains('is-morphing') && !document.querySelector('.word-share-flight-photo'));
    await page.screenshot({ path: '/tmp/word-share-desktop.png', fullPage: true });
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
      const { wordShareFrames } = await import('/src/utils/wordShareLayout.ts');
      const dialog = document.querySelector('.word-share-dialog');
      const origin = document.querySelector('.detail-polaroid img');
      const closing = closeWordShare(dialog, origin);
      const preview = dialog.querySelector('.word-share-preview');
      const flight = dialog.querySelector('.word-share-flight-photo');
      const animations = [...dialog.getAnimations({ subtree: true }), ...origin.closest('.detail-polaroid').getAnimations()];
      animations.forEach(animation => animation.pause());
      const travel = flight.getAnimations().find(animation => animation.effect.getKeyframes().some(frame => frame.transform));
      const duration = travel.effect.getTiming().duration;
      const previewHidden = getComputedStyle(preview).visibility === 'hidden' || Number(getComputedStyle(preview).opacity) === 0;
      const cropHeights = [0, .5, .8].map(progress => {
        animations.forEach(animation => { animation.currentTime = duration * progress; });
        const clip = getComputedStyle(flight).clipPath;
        if (!clip.startsWith('polygon(')) return 100;
        const points = clip.slice(8, -1).split(',').map(point => point.trim().split(/\s+/).map(parseFloat));
        return (points[2][1] + points[3][1]) / 2;
      });
      animations.forEach(animation => { animation.currentTime = duration * .75; });
      const captionNotFaded = Number(getComputedStyle(flight).opacity) > .99;
      animations.forEach(animation => { animation.currentTime = duration * .9; });
      const crossfade = Number(getComputedStyle(flight).opacity) < 1 && getComputedStyle(origin).visibility === 'visible'
        && Number(getComputedStyle(origin.closest('.detail-polaroid')).opacity) > 0;
      animations.forEach(animation => { animation.currentTime = duration; });
      const returningPaper = dialog.querySelector('.word-share-flight-paper');
      let paperHeightMismatch = Infinity;
      if (returningPaper) {
        const style = getComputedStyle(returningPaper);
        const matrix = new DOMMatrix(style.transform);
        const width = parseFloat(style.width), height = parseFloat(style.height);
        const points = style.clipPath.slice(8, -1).split(',').map(point => point.trim().split(/\s+/).map(parseFloat));
        const bottom = Math.max(...points.map(([x, y]) => parseFloat(style.top) + height / 2
          + matrix.b * (x / 100 * width - width / 2) + matrix.d * (y / 100 * height - height / 2) + matrix.f));
        paperHeightMismatch = Math.abs(bottom - origin.closest('.detail-polaroid').getBoundingClientRect().bottom);
      }
      const matrix = new DOMMatrix(getComputedStyle(flight).transform);
      const photo = wordShareFrames(preview).photo;
      const angle = 3 * Math.PI / 180;
      const sizeMismatch = Math.abs(photo.width * Math.hypot(matrix.a, matrix.b) * (Math.cos(angle) + Math.sin(angle)) - origin.getBoundingClientRect().width);
      animations.forEach(animation => animation.finish());
      await closing;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { paperHeightMismatch, cropHeights, captionNotFaded, previewHidden, crossfade, sizeMismatch, open: dialog.open, originVisibility: origin.style.visibility, layers: dialog.querySelectorAll('.word-share-flight-photo, .word-share-flight-paper').length };
    });
    assert.ok(terminal.paperHeightMismatch < 1, `the returning paper must already include the source bottom border: ${terminal.paperHeightMismatch}`);
    assert.equal(terminal.previewHidden, true, 'the static preview must not ghost beneath the returning print');
    assert.ok(terminal.cropHeights[1] < terminal.cropHeights[0] - 5 && terminal.cropHeights[2] < terminal.cropHeights[1], `the print must shorten progressively: ${terminal.cropHeights}`);
    assert.equal(terminal.captionNotFaded, true, 'text is removed by the receding paper edge before the handoff fades');
    assert.equal(terminal.crossfade, true, 'the returning print hands off to the source before the dialog disappears');
    assert.ok(terminal.sizeMismatch < 1, `return photo geometry must match its source: ${terminal.sizeMismatch}`);
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
      const scales = keyframes.map(frame => { const m = new DOMMatrix(frame.transform); return Math.hypot(m.a, m.b); });
      const animation = flight.getAnimations()[0];
      const duration = animation.effect.getTiming().duration;
      const scaleAt = time => { animation.currentTime = time; const m = new DOMMatrix(getComputedStyle(flight).transform); return Math.hypot(m.a, m.b); };
      const speedJumps = [.3, .78].map(offset => {
        const time = duration * offset;
        const before = scaleAt(time - 1), center = scaleAt(time), after = scaleAt(time + 1);
        return Math.abs((after - center) - (center - before)) * 1000;
      });
      const openingHeights = [0, .25, .6, 1].map(progress => {
        flight.getAnimations().forEach(effect => { effect.currentTime = duration * progress; });
        const clip = getComputedStyle(flight).clipPath;
        if (!clip.startsWith('polygon(')) return 100;
        const points = clip.slice(8, -1).split(',').map(point => point.trim().split(/\s+/).map(parseFloat));
        return (points[2][1] + points[3][1]) / 2;
      });
      flight.getAnimations().forEach(effect => { effect.currentTime = duration * .36; });
      return { visible: getComputedStyle(flight).visibility, hiddenOrigin: source.style.visibility,
        lifted: Math.max(...scales) > scales[0] && Math.max(...scales) > scales[scales.length - 1],
        peakScale: Math.max(...scales), speedJumps, openingHeights,
        settled: keyframes[keyframes.length - 1].transform === 'translate(0px, 0px) scale(1) rotate(0deg)',
        transformOnly: keyframes.every(frame => !('width' in frame) && !('left' in frame)) };
    });
    await page.screenshot({ path: '/tmp/word-share-lift.png' });
    assert.ok(motion.speedJumps.every(jump => jump < .5), `scale speed must stay continuous: ${motion.speedJumps}`);
    assert.ok(motion.peakScale <= 1.1, 'the lift stays restrained');
    assert.ok(motion.openingHeights[0] < motion.openingHeights[1] && motion.openingHeights[1] < motion.openingHeights[2] && motion.openingHeights[2] < motion.openingHeights[3], `the caption unfolds progressively: ${motion.openingHeights}`);
    assert.equal(motion.openingHeights[3], 100, 'the fully opened card reveals all its content');
    assert.equal(motion.visible, 'visible');
    assert.equal(motion.hiddenOrigin, 'hidden');
    assert.equal(motion.lifted, true, 'the print grows before shrinking onto the desk');
    assert.equal(motion.settled, true);
    assert.equal(motion.transformOnly, true, 'flight avoids per-frame layout changes');
    const interrupted = await dialog.evaluate(element => {
      const beforeClip = getComputedStyle(element.querySelector('.word-share-flight-photo')).clipPath;
      const before = new DOMMatrix(getComputedStyle(element.querySelector('.word-share-flight-photo')).transform);
      element.querySelector('[aria-label="關閉分享"]').click();
      const after = new DOMMatrix(getComputedStyle(element.querySelector('.word-share-flight-photo')).transform);
      return { jump: Math.abs(before.e - after.e) + Math.abs(before.f - after.f) + Math.abs(before.a - after.a),
        clipContinues: beforeClip === getComputedStyle(element.querySelector('.word-share-flight-photo')).clipPath };
    });
    assert.ok(interrupted.jump < 1, `closing during opening must continue from the visible frame: ${interrupted.jump}`);
    assert.equal(interrupted.clipContinues, true, 'closing mid-unfold preserves the visible paper height');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.detail-polaroid img').evaluate(image => image.style.visibility), '');
    await page.getByRole('button', { name: '分享單字', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.word-share-flight-photo'));
    await page.setViewportSize({ width: 568, height: 320 });
    await page.waitForFunction(() => !document.querySelector('.word-share-flight-photo'));
    const shortLayout = await dialog.evaluate(element => {
      const preview = element.querySelector('.word-share-preview').getBoundingClientRect();
      const footer = element.querySelector('footer').getBoundingClientRect();
      return preview.height > 0 && preview.top >= 64 && preview.bottom <= footer.top && footer.bottom <= innerHeight;
    });
    assert.equal(shortLayout, true, 'short screens keep the print clear of bottom actions');
    await dialog.getByRole('button', { name: '關閉分享' }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '分享單字', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.word-share-flight-photo'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.word-share-flight-photo'));
    assert.equal(await page.locator('.detail-polaroid img').evaluate(image => image.style.visibility), '');
    await dialog.getByRole('button', { name: '關閉分享' }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '分享單字', exact: true }).click();
    await dialog.locator('.word-share-preview').waitFor();
    await page.waitForFunction(() => !document.querySelector('.word-share-dialog')?.classList.contains('is-preparing'));
    assert.equal(await page.locator('.word-share-flight-photo').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Word sharing: PNG preview, download, fallback, cancellation, focus restoration and desktop passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
