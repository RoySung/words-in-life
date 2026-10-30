const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({viewport:{width:390,height:844}, reducedMotion});
      // Completion is persisted after the scene appears, so the dialog can arrive
      // after an immediate isVisible check. Dismiss it when it blocks an action.
      await page.addLocatorHandler(page.getByRole('button', { name: '繼續探索照片' }), async button => button.click());
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('https://generativelanguage.googleapis.com/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 300));
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({isRecognizable:false,unrecognizableReason:'測試辨識失敗',items:[]})}]}}]})});
      });
      await page.addInitScript(() => localStorage.setItem('words-in-life-gemini-key-v1', 'test-key'));
      await page.goto(baseURL);
      const sample = async () => {
        await page.getByRole('button',{name:/今日尋寶/}).click();
        await page.getByRole('button',{name:'體驗範例照片',exact:true}).click();
      };
      const print = async () => {
        await page.locator('.home-print-photo').waitFor();
        assert.equal(await page.locator('.developing-page').count(), 0);
        assert.equal(await page.getByRole('dialog').count(), 0, 'sample sheet must close');
        if (reducedMotion === 'no-preference') {
          assert.equal(await page.locator('.home-print-photo').evaluate(el => getComputedStyle(el).animationName), 'print-feed');
        }
      };
      await sample();
      if (reducedMotion === 'no-preference') await print();
      await page.getByRole('heading',{name:/發現了/}).waitFor();
      await page.getByRole('button',{name:'重新辨識',exact:true}).click();
      await print();
      await page.getByRole('heading',{name:'測試辨識失敗'}).waitFor();
      await page.getByRole('button',{name:'重新辨識本圖'}).click();
      await print();
      await page.getByRole('heading',{name:'測試辨識失敗'}).waitFor();
      await page.locator('.sample-gallery button').first().click();
      if (reducedMotion === 'no-preference') {
        await print();
        await page.getByRole('button',{name:'取消辨識'}).click();
        await page.waitForTimeout(2600);
        assert.equal(await page.locator('.scene-page').count(), 0);
        assert.equal(await page.locator('.home-print-photo').count(), 0);
        await sample();
      }
      await page.getByRole('heading',{name:/發現了/}).waitFor();
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${reducedMotion}: sample, scene retry, failure retry, failure sample, cancellation passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
