const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const scenario of ['mobile', 'desktop', 'reduced', 'resize', 'motion-change', 'retry', 'slow-load', 'module-load']) {
      const context = await browser.newContext({
        viewport: scenario === 'desktop' ? { width: 1280, height: 900 } : { width: 390, height: 844 },
        reducedMotion: scenario === 'reduced' ? 'reduce' : 'no-preference',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ failStorage }) => {
        localStorage.setItem('words-in-life-camera-enabled-v1', 'false');
        window.startupAnimations = [];
        document.addEventListener('animationstart', event => {
          if (event.animationName !== 'startup-print-feed' || !event.target.closest('.startup-transition-overlay')) return;
          const animation = event.target.getAnimations().find(item => item.animationName === 'startup-print-feed');
          if (animation) { animation.pause(); window.startupPaperAnimation = animation; }
        });
        const animate = HTMLElement.prototype.animate;
        HTMLElement.prototype.animate = function (...args) {
          const animation = animate.apply(this, args);
          if (this.matches('.startup-camera, .camera-body')) {
            animation.pause();
            window.startupAnimations.push({ element: this.className, animation });
          }
          return animation;
        };
        if (failStorage) {
          const open = indexedDB.open.bind(indexedDB);
          let first = true;
          indexedDB.open = (...args) => {
            if (first) { first = false; throw new DOMException('Test storage unavailable', 'SecurityError'); }
            return open(...args);
          };
        }
      }, { failStorage: scenario === 'retry' });
      let releasePhotos;
      let releaseModule;
      if (scenario === 'slow-load') {
        const photos = new Promise(resolve => { releasePhotos = resolve; });
        await page.route('**/sample-images/**', async route => { await photos; await route.continue(); });
      }
      if (scenario === 'module-load') {
        const module = new Promise(resolve => { releaseModule = resolve; });
        await page.route('**/src/App.tsx*', async route => { await module; await route.continue(); });
      }
      await page.goto(process.env.TEST_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
      if (scenario === 'module-load') {
        await page.locator('.startup-page[data-phase="boot"]').waitFor();
        await page.waitForFunction(() => !!window.startupPaperAnimation);
        await page.evaluate(() => {
          window.bootPaper = document.querySelector('.startup-print');
          window.bootAnimation = window.startupPaperAnimation;
        });
        releaseModule();
        await page.locator('.startup-page[data-phase="library"]').waitFor();
        assert(await page.evaluate(() => window.bootPaper === document.querySelector('.startup-print')), 'Loading screen remounted between phases');
        assert(await page.evaluate(() => window.bootAnimation === window.startupPaperAnimation), 'Paper animation restarted between phases');
        assert.equal(await page.getByRole('heading', { name: '準備中', exact: true }).count(), 1);
      }
      if (scenario === 'retry') {
        await page.getByRole('heading', { name: '暫時無法開啟單字簿' }).waitFor();
        await page.getByRole('button', { name: '重新載入', exact: true }).click();
      }
      if (scenario !== 'reduced') {
        await page.waitForFunction(() => !!window.startupPaperAnimation);
        if (scenario !== 'slow-load') await page.locator('.camera-body').waitFor({ state: 'attached' });
        assert.equal(await page.evaluate(() => window.startupAnimations.length), 0, 'Camera turned before the paper finished');
        await page.evaluate(() => window.startupPaperAnimation.finish());
        if (scenario === 'slow-load') {
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await page.evaluate(() => window.startupAnimations.length), 0, 'Camera turned before data was ready');
          releasePhotos();
        }
        await page.waitForFunction(() => window.startupAnimations.length === 1);
        assert(await page.locator('.startup-transition-home').evaluate(el => el.inert));
        assert.equal(await page.getByRole('button', { name: /^我的單字/ }).count(), 0, 'Home controls exposed during flip');
        if (scenario === 'resize') {
          await page.setViewportSize({ width: 320, height: 568 });
        } else if (scenario === 'motion-change') {
          await page.emulateMedia({ reducedMotion: 'reduce' });
        } else {
          await page.evaluate(() => window.startupAnimations[0].animation.finish());
          await page.waitForFunction(() => window.startupAnimations.length === 2);
          assert.equal(await page.locator('.startup-transition-overlay').evaluate(el => getComputedStyle(el).visibility), 'hidden');
          assert(await page.locator('.startup-transition-home').evaluate(el => el.inert));
          await page.evaluate(() => {
            const animation = window.startupAnimations[1].animation;
            animation.currentTime = animation.effect.getComputedTiming().activeDuration / 2;
          });
          if (process.env.TEST_OUTPUT_DIR) {
            fs.mkdirSync(process.env.TEST_OUTPUT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.TEST_OUTPUT_DIR, `startup-flip-${scenario}.png`), fullPage: true });
          }
          await page.evaluate(() => window.startupAnimations[1].animation.finish());
        }
      }
      await page.locator('.startup-transition-home[data-entering="false"]').waitFor();
      await page.locator('.startup-transition-overlay').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.startup-transition-light, .startup-transition-shadow').count(), 0, 'Lighting layers remain after startup');
      assert.equal(await page.locator('.startup-transition-home').evaluate(el => el.inert), false);
      assert.equal(await page.locator('.camera-body').evaluate(el => getComputedStyle(el).transform), 'none');
      if (scenario === 'reduced') assert.equal(await page.evaluate(() => window.startupAnimations.length), 0);
      await page.getByRole('button', { name: /^我的單字/ }).click();
      await page.getByRole('heading', { name: /^我的單字/ }).waitFor();
      await page.getByRole('button', { name: '拍攝照片', exact: true }).click();
      await page.getByRole('switch', { name: '鏡頭', exact: true }).waitFor();
      assert.equal(await page.locator('.startup-transition-overlay').count(), 0, 'Startup replayed after navigation');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`${scenario}: startup flip, recovery, interaction, navigation passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
