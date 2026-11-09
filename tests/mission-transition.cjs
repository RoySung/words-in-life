const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';
const output = process.env.TEST_OUTPUT_DIR || 'test-results';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  const errors = [];
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, reducedMotion });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${baseURL}/design-system/preview?screen=missions&state=loading`);
      await page.getByRole('status').filter({ hasText: '正在更新今天的尋寶任務' }).waitFor();
      const searchStatus = page.locator('.quest-updating--search');
      assert.equal(await searchStatus.textContent(), '正在更新今天的尋寶任務');
      assert.equal(await searchStatus.locator('.quest-search-indicator[aria-hidden="true"]').count(), 1);
      const placement = await searchStatus.evaluate(element => {
        const text = element.firstElementChild.getBoundingClientRect();
        const indicator = element.querySelector('.quest-search-indicator').getBoundingClientRect();
        const textCenter = text.top + text.height / 2;
        const marks = [...element.querySelectorAll('.quest-search-indicator i, .quest-search-indicator circle')];
        const centered = marks.every(mark => { const bounds = mark.getBoundingClientRect(); return Math.abs(bounds.top + bounds.height / 2 - textCenter) < .6; });
        return { centered, textRight: text.right, indicatorLeft: indicator.left, animation: getComputedStyle(element.querySelector('.quest-search-indicator svg')).animationName };
      });
      assert(placement.centered, 'clue dots and magnifier lens align with the vertical center of the text');
      assert(placement.indicatorLeft >= placement.textRight, 'search animation follows the text');
      assert.equal(placement.animation, reducedMotion === 'reduce' ? 'none' : 'quest-search');
      assert.equal(await page.locator('.quest-card-action:disabled').count(), 3);
      assert.equal(await page.locator('.quest-replace:disabled').count(), 3);
      assert.equal(await page.locator('.quest-speaker:disabled').count(), 3);
      assert.equal(await page.locator('.quest-cards button:enabled').count(), 0);
      assert.equal(await page.locator('.quest-loading-light').count(), 0);
      assert.equal(await page.locator('.quest-status-switch').evaluate(element => getComputedStyle(element).marginBottom), '8px');
      assert.equal(await page.locator('.quest-progress').getAttribute('aria-hidden'), 'true');
      assert.equal(await searchStatus.getAttribute('aria-hidden'), 'false');
      const cardTop = await page.locator('.quest-card').first().evaluate(element => element.getBoundingClientRect().top);
      await page.getByRole('button', { name: '全部未完成', exact: true }).click();
      assert.equal(await page.locator('.quest-progress').getAttribute('aria-hidden'), 'false');
      assert.equal(await searchStatus.getAttribute('aria-hidden'), 'true');
      const rowTurn = await page.locator('.quest-status-switch').evaluate(element => element.getAnimations({ subtree: true }).flatMap(animation => animation.effect.getKeyframes()));
      if (reducedMotion === 'no-preference') assert(rowTurn.some(frame => /rotateX/.test(frame.transform || '')), 'shared row turns like a page');
      else assert(!rowTurn.some(frame => /rotateX/.test(frame.transform || '')), 'reduced motion avoids the page turn');
      assert.equal(await page.locator('.quest-card').first().evaluate(element => element.getBoundingClientRect().top), cardTop, 'cards stay in place when the status changes');
      // Rapid toggles settle on the latest state without a stale or stuck page.
      await page.getByRole('button', { name: '更新中', exact: true }).click();
      await page.getByRole('button', { name: '全部未完成', exact: true }).click();
      await page.getByRole('button', { name: '更新中', exact: true }).click();
      await page.waitForFunction(() => {
        const row = document.querySelector('.quest-status-switch');
        return row.dataset.loading === 'true' && !row.getAnimations().length && ![...row.children].some(child => child.getAnimations().length);
      });
      assert.equal(await page.locator('.quest-progress').isVisible(), false);
      assert.equal(await searchStatus.isVisible(), true);
      if (reducedMotion === 'no-preference') {
        await page.screenshot({ path: `${output}/missions-loading-390.png`, fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: `${output}/missions-loading-1440.png`, fullPage: true });
        await page.setViewportSize({ width: 390, height: 1000 });
      }
      await page.locator('.daily-quest').evaluate(element => { element.style.marginTop = '2000px'; });
      await page.waitForFunction(() => document.querySelector('.daily-quest').classList.contains('is-motion-paused'));
      if (reducedMotion === 'no-preference') assert.equal(await page.locator('.quest-search-indicator svg').evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
      await page.locator('.daily-quest').evaluate(element => { element.style.marginTop = ''; });
      await page.waitForFunction(() => !document.querySelector('.daily-quest').classList.contains('is-motion-paused'));
      await page.getByRole('button', { name: '全部完成', exact: true }).click();
      assert.equal(await page.locator('.quest-loading-light').count(), 0);
      assert.equal(await page.locator('.quest-card-action:enabled').count(), 3);
      await page.getByRole('button', { name: '更新中', exact: true }).click();
      await page.getByRole('button', { name: '全部未完成', exact: true }).click();
      assert.equal(await page.locator('.quest-loading-light').count(), 0);
      assert.equal(await page.locator('.quest-card-action:enabled').count(), 3);
      assert.equal(await page.locator('.quest-speaker:enabled').count(), 3);
      assert.equal(await page.locator('.quest-replace:enabled').count(), 3);
      const slot = page.locator('.quest-card-slot').first();
      const original = await slot.locator('.quest-word').textContent();
      await slot.locator('.quest-replace').click();
      await page.waitForFunction(() => document.querySelector('.quest-card-slot')?.getAttribute('aria-busy') === 'true');
      const transition = await slot.evaluate(element => ({
        inert: element.inert,
        frames: element.querySelector('article').getAnimations().flatMap(animation => animation.effect.getKeyframes()),
      }));
      assert(transition.inert, 'flipping card cannot accept pointer or keyboard actions');
      if (reducedMotion === 'no-preference') assert(transition.frames.some(frame => /rotateY/.test(frame.transform || '')), 'normal motion includes a card turn');
      else assert(!transition.frames.some(frame => /rotateY\((?!0deg)/.test(frame.transform || '')), 'reduced motion avoids rotation');
      await page.waitForFunction(original => document.querySelector('.quest-card-slot .quest-word')?.textContent !== original && document.querySelector('.quest-card-slot')?.getAttribute('aria-busy') === 'false', original);
      assert.equal(await slot.locator('.quest-replace').isDisabled(), true);
      assert.equal(await slot.locator('.quest-card-action').isEnabled(), true);
      await page.reload();
      await page.getByRole('status').filter({ hasText: '正在更新今天的尋寶任務' }).waitFor();
      assert.equal(await page.locator('.quest-card-slot[aria-busy="true"]').count(), 0);
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log('Mission preview: loading status, disabled controls, card flip, reduced motion, restored interaction and reload passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
