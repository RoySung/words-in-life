const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.setItem('words-in-life-camera-enabled-v1', 'false');
      localStorage.setItem('words-in-life-gemini-key-v1', 'private-fixture-key');
    });
    page.setDefaultTimeout(10000);
    let status = 200;
    const requests = [];
    await page.route('https://generativelanguage.googleapis.com/**', route => {
      requests.push({ body: route.request().postDataJSON(), key: route.request().headers()['x-goog-api-key'] });
      return route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(status === 200
        ? { candidates: [{ content: { parts: [{ text: '{broken json' }] } }] }
        : { error: { code: status, message: 'Fixture upstream failure key=private-fixture-key' } }),
      });
    });
    await page.goto(baseURL);
    await page.getByRole('button', { name: /^我的單字/ }).waitFor();
    await page.locator('input[type=file]').setInputFiles('public/sample-images/cafe_scene.jpg');
    await page.getByRole('heading', { name: '這次辨識結果不完整' }).waitFor();
    await page.getByText('先重新辨識這張照片；若持續失敗，再靠近單一物品重拍。', { exact: true }).waitFor();
    const message = page.locator('.failure-message');
    for (let i = 0; i < 4; i++) await message.click();
    assert.equal(await page.getByRole('heading', { name: 'Dev mode · Error log' }).count(), 0);
    await message.click();
    await page.getByRole('heading', { name: 'Dev mode · Error log' }).waitFor();
    assert.match(await page.locator('.failure-diagnostics pre').textContent(), /InvalidResponse/);
    assert.match(await page.locator('.failure-diagnostics pre').textContent(), /SyntaxError/);
    assert.doesNotMatch(await page.locator('.failure-diagnostics pre').textContent(), /private-fixture-key|data:image|base64/);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedLog = text; } } }));
    await page.getByRole('button', { name: '複製 error log' }).click();
    await page.getByRole('status').filter({ hasText: '已複製' }).waitFor();
    assert.equal(await page.evaluate(() => window.copiedLog), await page.locator('.failure-diagnostics pre').textContent());
    for (const width of [320, 1100]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow at ${width}`);
      await page.screenshot({ path: `/tmp/words-recognition-error-${width}.png`, fullPage: true });
    }
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); }; });
    await page.getByRole('button', { name: '複製 error log' }).click();
    await page.getByRole('status').filter({ hasText: '無法複製' }).waitFor();
    await page.getByRole('button', { name: '收合 error log' }).click();
    assert.equal(await page.locator('.failure-diagnostics pre').count(), 0);
    for (const [code, title] of [[403, '無法使用辨識服務'], [429, '辨識額度不足或請求過於頻繁'], [503, '辨識服務暫時無法使用']]) {
      status = code;
      await page.getByRole('button', { name: '重新辨識本圖' }).click();
      await page.getByRole('heading', { name: title }).waitFor();
      assert.equal(await page.locator('.failure-diagnostics').count(), 0, 'new failures must hide logs');
      if (code === 403) {
        const photo = await page.getByAltText('未能順利辨識的照片').getAttribute('src');
        const failedRequest = requests.at(-1);
        await page.getByRole('button', { name: /檢查.*設定/ }).click();
        await page.getByRole('heading', { name: '設定', exact: true }).waitFor();
        // Leaving settings without saving also keeps the original photo.
        await page.getByRole('button', { name: '返回辨識結果' }).click();
        assert.equal(await page.getByAltText('未能順利辨識的照片').getAttribute('src'), photo);
        await page.getByRole('button', { name: /檢查.*設定/ }).click();
        await page.getByRole('button', { name: '清除 API key', exact: true }).click();
        await page.getByRole('button', { name: '返回辨識結果' }).click();
        const beforeRetry = requests.length;
        await page.getByRole('button', { name: '重新辨識本圖' }).click();
        await page.getByRole('heading', { name: '設定', exact: true }).waitFor();
        assert.equal(requests.length, beforeRetry, 'missing key must not send a request');
        await page.getByLabel('API key', { exact: true }).fill('replacement-fixture-key');
        await page.getByRole('button', { name: '儲存設定' }).click();
        await page.getByText('已儲存 API key，可以返回辨識結果重試原照片。', { exact: true }).waitFor();
        await page.getByRole('button', { name: '返回辨識結果' }).click();
        assert.equal(await page.getByAltText('未能順利辨識的照片').getAttribute('src'), photo);
        await page.getByRole('button', { name: '重新辨識本圖' }).click();
        await page.getByRole('heading', { name: title }).waitFor();
        assert.equal(requests.at(-1).key, 'replacement-fixture-key');
        assert.deepEqual(requests.at(-1).body, failedRequest.body, 'retry sends the original photo');
      }
      for (let i = 0; i < 5; i++) await message.click();
      const log = await page.locator('.failure-diagnostics pre').textContent();
      assert.match(log, new RegExp(`"status": ${code}`));
      assert.doesNotMatch(log, /private-fixture-key|data:image|base64/);
    }
    console.log('Recognition error guidance, settings recovery with original photo and updated credentials, five-click diagnostics, copy, reset, redaction and responsive layout passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
