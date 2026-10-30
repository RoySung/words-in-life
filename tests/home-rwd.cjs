const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

(async () => {
  const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(engine === chromium ? { executablePath: process.env.CHROME_PATH } : {});
  let recoveryContext, profile;
  try {
    for (const [width, height] of [[320, 568], [375, 667], [393, 667], [390, 844], [430, 932], [844, 390], [768, 1024], [1440, 900]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`${baseURL}/design-system/preview?screen=home`);
      await page.locator('.camera-body').waitFor();
      const layout = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect();
        const labels = [...document.querySelectorAll('.camera-control-label > span')];
        return {
          labelsBottom: Math.max(...labels.map(el => el.getBoundingClientRect().bottom)),
          slotTop: box('.camera-print-slot').top,
          slotBottom: box('.camera-print-slot').bottom,
          bodyBottom: box('.camera-body').bottom,
          finderHeight: box('.home-viewfinder').height,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      const context = `${width}x${height}: ${JSON.stringify(layout)}`;
      // Include the 13px raised lip above the slot, not just its border box.
      assert.ok(layout.labelsBottom + 13 <= layout.slotTop, `Labels overlap the print slot: ${context}`);
      assert.ok(layout.slotBottom <= layout.bodyBottom, `Print slot escapes the housing: ${context}`);
      assert.ok(layout.finderHeight >= 220, `Viewfinder is too short: ${context}`);
      assert.equal(layout.overflow, false, `Horizontal overflow: ${context}`);
      await page.getByRole('button', { name: /今日尋寶/ }).click();
      await page.getByRole('dialog').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: '關閉探索' }).click();
      await page.getByRole('button', { name: /我的單字，/ }).click();
      await page.locator('.collection-page').waitFor();
      await page.close();
      console.log(`${width}x${height}: camera layout and navigation passed`);
    }

    // WebKit needs a persistent profile for the production IndexedDB library.
    if (engine === webkit) {
      profile = fs.mkdtempSync(path.join(os.tmpdir(), 'words-rwd-webkit-'));
      recoveryContext = await webkit.launchPersistentContext(profile, { headless: true, viewport: { width: 320, height: 568 } });
    }
    const page = recoveryContext ? await recoveryContext.newPage() : await browser.newPage({ viewport: { width: 320, height: 568 } });
    await page.addInitScript(() => {
      localStorage.setItem('words-in-life-camera-enabled-v1', 'true');
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); } },
      });
    });
    await page.goto(baseURL);
    await page.locator('.home-camera-status .vs-button').first().waitFor();
    const recovery = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      return {
        missionBottom: box('.mission-viewfinder-controls').bottom,
        statusTop: box('.home-camera-status').top,
        statusBottom: box('.home-camera-status').bottom,
        finderBottom: box('.home-viewfinder').bottom,
      };
    });
    assert.ok(recovery.statusTop >= recovery.missionBottom, 'Recovery overlaps missions');
    assert.ok(recovery.statusBottom < recovery.finderBottom, 'Recovery escapes viewfinder');
    await page.getByRole('button', { name: '先體驗範例照片' }).click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    console.log('320x568: camera permission recovery passed');
    await page.close();
  } finally {
    await recoveryContext?.close();
    if (profile) fs.rmSync(profile, { recursive: true, force: true });
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
